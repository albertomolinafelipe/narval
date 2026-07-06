package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DomainVerification is a pending challenge proving that a startup owner
// controls a company domain. The owner requests a code sent to an address at
// the domain (e.g. you@acme.com); consuming the code marks the startup verified.
//
// At most one live challenge exists per startup (StartupID is unique); starting
// a new challenge replaces any previous one.
type DomainVerification struct {
	ID        string    `gorm:"type:uuid;primaryKey"   json:"id"`
	StartupID string    `gorm:"type:uuid;not null;uniqueIndex" json:"startup_id"`
	Domain    string    `gorm:"not null"               json:"domain"`
	Email     string    `gorm:"not null"               json:"email"`
	CodeHash  string    `gorm:"not null"               json:"-"`
	Attempts  int       `gorm:"not null;default:0"     json:"-"`
	ExpiresAt time.Time `gorm:"not null"               json:"expires_at"`
	CreatedAt time.Time `                              json:"created_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (d *DomainVerification) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.NewString()
	}
	return nil
}
