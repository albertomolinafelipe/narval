package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InstagramVerification is a startup's claim to an Instagram handle, proven
// out-of-band: the startup DMs Code from the handle they claim to the company
// Instagram account, and an admin matches the DM in the console and confirms.
//
// The handle is locked to the startup once created (StartupID is unique); only
// an admin can reset it. Code is a plaintext correlation token — not a secret —
// since the admin must read it to match the incoming DM.
type InstagramVerification struct {
	ID        string    `gorm:"type:uuid;primaryKey"   json:"id"`
	StartupID string    `gorm:"not null;uniqueIndex"   json:"startup_id"`
	Handle    string    `gorm:"not null"               json:"handle"`
	Code      string    `gorm:"not null"               json:"code"`
	Verified  bool      `gorm:"not null;default:false" json:"verified"`
	CreatedAt time.Time `                              json:"created_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (v *InstagramVerification) BeforeCreate(tx *gorm.DB) error {
	if v.ID == "" {
		v.ID = uuid.NewString()
	}
	return nil
}
