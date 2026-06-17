package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StartupBoost represents a user's boost of a startup.
// Boosts are temporary signals of interest/attention that expire after 30 days.
// UserID stores the Keycloak ID (not a UUID)
type StartupBoost struct {
	ID        string    `gorm:"type:uuid;primaryKey"                                             json:"id"`
	UserID    string    `gorm:"type:varchar(255);not null;index:idx_user_startup_boost"         json:"user_id"`
	StartupID string    `gorm:"type:uuid;not null;index:idx_startup_boost"                      json:"startup_id"`
	CreatedAt time.Time `gorm:"not null;index:idx_created_at"                                   json:"created_at"`
	ExpiresAt time.Time `gorm:"not null;index:idx_expires_at"                                   json:"expires_at"`
}

// BeforeCreate sets a UUID primary key and ExpiresAt timestamp when none is provided.
func (b *StartupBoost) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	if b.ExpiresAt.IsZero() {
		b.ExpiresAt = time.Now().Add(30 * 24 * time.Hour)
	}
	return nil
}
