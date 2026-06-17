package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StartupFavorite represents a user's favorite of a startup.
// This is a many-to-many relationship between users and startups.
// UserID stores the Keycloak ID (not a UUID)
type StartupFavorite struct {
	ID        string    `gorm:"type:uuid;primaryKey"                                      json:"id"`
	UserID    string    `gorm:"type:varchar(255);not null;uniqueIndex:idx_user_startup"  json:"user_id"`
	StartupID string    `gorm:"type:uuid;not null;uniqueIndex:idx_user_startup"          json:"startup_id"`
	CreatedAt time.Time `                                                                 json:"created_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (f *StartupFavorite) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.NewString()
	}
	return nil
}
