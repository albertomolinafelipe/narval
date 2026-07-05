package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RegistrationDraft holds metadata collected during registration until the email is verified via SuperTokens OTP.
// SuperTokens handles the OTP codes and expiry, so we only store account metadata here.
type RegistrationDraft struct {
	ID               string      `gorm:"type:uuid;primaryKey"    json:"id"`
	AccountType      AccountType `gorm:"not null"                json:"account_type"`
	Email            string      `gorm:"not null;uniqueIndex"    json:"email"`
	Nickname         string      `gorm:"not null"                json:"nickname"` // User's display name
	PreAuthSessionID string      `gorm:"not null"                json:"pre_auth_session_id"`
	DeviceID         string      `gorm:"not null"                json:"device_id"`

	// Name is required for startup registration, empty for plain users.
	Name string `json:"name"`

	// ClaimToken is set when this OTP flow is a startup claiming an admin-seeded
	// shell; it is carried into the account reconciliation on verify.
	ClaimToken string `json:"claim_token"`

	CreatedAt time.Time `json:"created_at"`
}

func (d *RegistrationDraft) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}
