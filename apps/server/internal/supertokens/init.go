package supertokens

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"

	"github.com/resend/resend-go/v2"
	"github.com/supertokens/supertokens-golang/ingredients/emaildelivery"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/plessmodels"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty"
	"github.com/supertokens/supertokens-golang/recipe/thirdparty/tpmodels"
	"github.com/supertokens/supertokens-golang/supertokens"
	"gorm.io/gorm"

	"github.com/narval/server/internal/accounts"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/models"
)

func Init(cfg *config.Config, db *gorm.DB) error {
	apiBasePath := "/api/v1/auth"
	websiteBasePath := "/auth"

	sendEmail := func(input emaildelivery.EmailType, _ supertokens.UserContext) error {
		otp := ""
		if input.PasswordlessLogin.UserInputCode != nil {
			otp = *input.PasswordlessLogin.UserInputCode
		}
		to := input.PasswordlessLogin.Email

		log.Printf("Resend: sending OTP email to %s", to)

		client := resend.NewClient(cfg.ResendAPIKey)
		params := &resend.SendEmailRequest{
			From:    fmt.Sprintf("%s <%s>", cfg.EmailFromName, cfg.EmailFrom),
			To:      []string{to},
			Subject: "Your Narval login code",
			Html:    otpEmailHTML(otp),
		}

		_, err := client.Emails.Send(params)
		if err != nil {
			log.Printf("Resend ERROR: failed to send to %s: %v", to, err)
			return err
		}

		log.Printf("Resend: email sent to %s", to)
		return nil
	}

	recipeList := []supertokens.Recipe{
		passwordless.Init(plessmodels.TypeInput{
			FlowType: "USER_INPUT_CODE",
			ContactMethodEmail: plessmodels.ContactMethodEmailConfig{
				Enabled: true,
			},
			EmailDelivery: &emaildelivery.TypeInput{
				Service: &emaildelivery.EmailDeliveryInterface{
					SendEmail: &sendEmail,
				},
			},
		}),
		session.Init(&sessmodels.TypeInput{
			CookieSameSite: &sameSiteLax,
		}),
	}

	// Google sign-in is optional: only enabled when configured, so local dev
	// works without it.
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		recipeList = append(recipeList, googleRecipe(cfg, db))
	}

	return supertokens.Init(supertokens.TypeInput{
		Supertokens: &supertokens.ConnectionInfo{
			ConnectionURI: cfg.SuperTokensConnectionURI,
			APIKey:        cfg.SuperTokensAPIKey,
		},
		AppInfo: supertokens.AppInfo{
			AppName:         "Narval",
			APIDomain:       "http://localhost:8080",
			WebsiteDomain:   "http://localhost:3000",
			APIBasePath:     &apiBasePath,
			WebsiteBasePath: &websiteBasePath,
		},
		RecipeList: recipeList,
	})
}

// googleRecipe wires the Google provider and overrides sign-in/up so it flows
// through the same local-account reconciliation as passwordless.
func googleRecipe(cfg *config.Config, db *gorm.DB) supertokens.Recipe {
	return thirdparty.Init(&tpmodels.TypeInput{
		SignInAndUpFeature: tpmodels.TypeInputSignInAndUp{
			Providers: []tpmodels.ProviderInput{
				{
					Config: tpmodels.ProviderConfig{
						ThirdPartyId: "google",
						Clients: []tpmodels.ProviderClientConfig{
							{
								ClientID:     cfg.GoogleClientID,
								ClientSecret: cfg.GoogleClientSecret,
							},
						},
					},
				},
			},
		},
		Override: &tpmodels.OverrideStruct{
			APIs: func(original tpmodels.APIInterface) tpmodels.APIInterface {
				originalSignInUp := *original.SignInUpPOST
				*original.SignInUpPOST = func(
					provider *tpmodels.TypeProvider,
					input tpmodels.TypeSignInUpInput,
					tenantId string,
					options tpmodels.APIOptions,
					userContext supertokens.UserContext,
				) (tpmodels.SignInUpPOSTResponse, error) {
					// Registration intent (account type/name) is carried in a cookie
					// set by the frontend before redirecting to Google. Absent on
					// plain sign-in.
					intent := readIntentCookie(options.Req)

					resp, err := originalSignInUp(provider, input, tenantId, options, userContext)
					if err != nil || resp.OK == nil {
						return resp, err
					}

					user, lerr := accounts.LinkOrCreate(db, resp.OK.User.Email, resp.OK.User.ID, intent)
					if lerr != nil {
						// Roll back the session SuperTokens just created.
						_ = resp.OK.Session.RevokeSession()
						if lerr == accounts.ErrNoAccount {
							return tpmodels.SignInUpPOSTResponse{
								GeneralError: &supertokens.GeneralErrorResponse{Message: "NO_ACCOUNT"},
							}, nil
						}
						log.Printf("google sign-in: reconcile failed: %v", lerr)
						return tpmodels.SignInUpPOSTResponse{}, lerr
					}

					clearIntentCookie(options.Res)
					if err := resp.OK.Session.MergeIntoAccessTokenPayload(accounts.SessionPayload(user)); err != nil {
						log.Printf("google sign-in: failed to set session payload: %v", err)
					}
					return resp, nil
				}
				return original
			},
		},
	})
}

// intentCookieName holds the pending registration's account type + name while the
// user is away at Google. It is not a secret (no auth value), so it is a plain
// short-lived cookie.
const intentCookieName = "narval_reg_intent"

func readIntentCookie(r *http.Request) *accounts.Intent {
	c, err := r.Cookie(intentCookieName)
	if err != nil || c.Value == "" {
		return nil
	}
	raw, err := url.QueryUnescape(c.Value)
	if err != nil {
		return nil
	}
	var data struct {
		AccountType string `json:"account_type"`
		Name        string `json:"name"`
	}
	if json.Unmarshal([]byte(raw), &data) != nil || data.AccountType == "" {
		return nil
	}
	return &accounts.Intent{
		AccountType: models.AccountType(data.AccountType),
		Nickname:    data.Name,
		Name:        data.Name,
	}
}

func clearIntentCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     intentCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: false,
	})
}

func otpEmailHTML(otp string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <h2 style="margin-bottom:8px">Your Narval login code</h2>
  <p style="color:#555;margin-bottom:32px">Use the code below to sign in. It expires in 15 minutes.</p>
  <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f5;border-radius:8px">%s</div>
  <p style="color:#999;font-size:13px;margin-top:32px">If you didn't request this, ignore this email.</p>
</body>
</html>`, otp)
}

var sameSiteLax = "lax"
