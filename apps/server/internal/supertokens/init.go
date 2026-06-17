package supertokens

import (
	"log"
	"strconv"

	"github.com/supertokens/supertokens-golang/ingredients/emaildelivery"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/emaildelivery/smtpService"
	"github.com/supertokens/supertokens-golang/recipe/passwordless/plessmodels"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/supertokens"

	"github.com/narval/server/internal/config"
)

// Init initializes SuperTokens SDK with passwordless authentication.
func Init(cfg *config.Config) error {
	apiBasePath := "/api/v1/auth"
	websiteBasePath := "/auth"

	// Parse SMTP port
	smtpPort, err := strconv.Atoi(cfg.SMTPPort)
	if err != nil {
		return err
	}

	// Configure SMTP settings for email delivery
	smtpSettings := emaildelivery.SMTPSettings{
		Host: cfg.SMTPHost,
		From: emaildelivery.SMTPFrom{
			Name:  cfg.SMTPFromName,
			Email: cfg.SMTPFrom,
		},
		Port:     smtpPort,
		Username: &cfg.SMTPUsername,
		Password: cfg.SMTPPassword,
		Secure:   smtpPort == 465, // Use TLS if port is 465, otherwise STARTTLS
	}

	err = supertokens.Init(supertokens.TypeInput{
		Supertokens: &supertokens.ConnectionInfo{
			ConnectionURI: cfg.SuperTokensConnectionURI,
			APIKey:        cfg.SuperTokensAPIKey,
		},
		AppInfo: supertokens.AppInfo{
			AppName:         "Narval",
			APIDomain:       "http://localhost:8080", // TODO: Make configurable
			WebsiteDomain:   "http://localhost:3000", // TODO: Make configurable
			APIBasePath:     &apiBasePath,
			WebsiteBasePath: &websiteBasePath,
		},
		RecipeList: []supertokens.Recipe{
			passwordless.Init(plessmodels.TypeInput{
				FlowType: "USER_INPUT_CODE", // OTP flow (not magic link)
				ContactMethodEmail: plessmodels.ContactMethodEmailConfig{
					Enabled: true,
				},
				EmailDelivery: &emaildelivery.TypeInput{
					Service: smtpService.MakeSMTPService(emaildelivery.SMTPServiceConfig{
						Settings: smtpSettings,
						Override: func(originalImplementation emaildelivery.SMTPInterface) emaildelivery.SMTPInterface {
							originalSendRawEmail := *originalImplementation.SendRawEmail

							newSendRawEmail := func(input emaildelivery.EmailContent, userContext supertokens.UserContext) error {
								log.Printf("SMTP: Attempting to send email to %s from %s via %s:%d",
									input.ToEmail, smtpSettings.From.Email, smtpSettings.Host, smtpSettings.Port)

								err := originalSendRawEmail(input, userContext)
								if err != nil {
									log.Printf("SMTP ERROR: Failed to send email to %s: %v", input.ToEmail, err)
									return err
								}

								log.Printf("SMTP: Email sent successfully to %s", input.ToEmail)
								return nil
							}

							originalImplementation.SendRawEmail = &newSendRawEmail
							return originalImplementation
						},
					}),
				},
			}),
			session.Init(&sessmodels.TypeInput{
				// Session configuration
				CookieSameSite: &sameSiteLax,
			}),
		},
	})

	return err
}

var sameSiteLax = "lax"
