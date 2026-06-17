package supertokens

import (
	"fmt"
	"log"

	"github.com/resend/resend-go/v2"
	"github.com/supertokens/supertokens-golang/ingredients/emaildelivery"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/plessmodels"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/supertokens"

	"github.com/narval/server/internal/config"
)

func Init(cfg *config.Config) error {
	apiBasePath := "/api/v1/auth"
	websiteBasePath := "/auth"

	sendEmail := func(input emaildelivery.EmailType, userContext supertokens.UserContext) error {
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

	err := supertokens.Init(supertokens.TypeInput{
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
		RecipeList: []supertokens.Recipe{
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
		},
	})

	return err
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
