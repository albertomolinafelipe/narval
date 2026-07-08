package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BoostLifetime is how long a boost counts as active before it expires and is
// purged by the hourly cleanup.
const BoostLifetime = 7 * 24 * time.Hour

// StartupBoost represents a user's boost of a startup.
// Boosts are temporary signals of interest/attention that expire after BoostLifetime.
// UserID stores the local users.id.
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
		b.ExpiresAt = time.Now().Add(BoostLifetime)
	}
	return nil
}
