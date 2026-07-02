// Package email sends transactional email via Resend, independent of the
// SuperTokens auth flow (which has its own passwordless-code delivery).
package email

import (
	"fmt"
	"log"

	"github.com/resend/resend-go/v2"

	"github.com/narval/server/internal/config"
)

// Sender delivers transactional email.
type Sender interface {
	SendDomainVerificationCode(to, domain, code string) error
}

// resendSender is the production Sender backed by Resend.
type resendSender struct {
	apiKey   string
	from     string
	fromName string
}

// New returns a Resend-backed Sender built from config.
func New(cfg *config.Config) Sender {
	return &resendSender{
		apiKey:   cfg.ResendAPIKey,
		from:     cfg.EmailFrom,
		fromName: cfg.EmailFromName,
	}
}

func (s *resendSender) SendDomainVerificationCode(to, domain, code string) error {
	log.Printf("Resend: sending domain verification code to %s", to)
	client := resend.NewClient(s.apiKey)
	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.from),
		To:      []string{to},
		Subject: fmt.Sprintf("Verify %s on Narval", domain),
		Html:    domainVerificationHTML(domain, code),
	})
	if err != nil {
		log.Printf("Resend ERROR: failed to send domain verification to %s: %v", to, err)
		return err
	}
	return nil
}

func domainVerificationHTML(domain, code string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <h2 style="margin-bottom:8px">Verify %s</h2>
  <p style="color:#555;margin-bottom:32px">Enter the code below on Narval to verify that you control this domain. It expires in 15 minutes.</p>
  <div style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f5;border-radius:8px">%s</div>
  <p style="color:#999;font-size:13px;margin-top:32px">If you didn't request this, ignore this email.</p>
</body>
</html>`, domain, code)
}
