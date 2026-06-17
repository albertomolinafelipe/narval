package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AccountType distinguishes regular users from startups.
type AccountType string

const (
	AccountTypeUser    AccountType = "user"
	AccountTypeStartup AccountType = "startup"
)

// User stores the local profile for every registered account.
// Identity (password, email verification, sessions) is managed by SuperTokens;
// this table only holds app-level data.
type User struct {
	ID          string      `gorm:"type:uuid;primaryKey"          json:"id"`
	AuthUserID  string      `gorm:"not null;uniqueIndex"          json:"auth_user_id"`
	Email       string      `gorm:"not null;uniqueIndex"          json:"email"`
	Nickname    string      `gorm:"not null"                      json:"nickname"`
	AccountType AccountType `gorm:"not null;default:'user'"       json:"account_type"`
	CreatedAt   time.Time   `                                     json:"created_at"`
	UpdatedAt   time.Time   `                                     json:"updated_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	return nil
}
