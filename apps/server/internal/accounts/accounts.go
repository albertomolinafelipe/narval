// Package accounts reconciles a SuperTokens identity (auth user id + verified
// email) with the app's local User record. It is the single place where a login
// creates or links an account, shared by every auth method (passwordless OTP and
// third-party OAuth) so they behave identically.
package accounts

import (
	"errors"

	"gorm.io/gorm"

	"github.com/narval/server/models"
)

// ErrNoAccount is returned when a sign-in refers to an email with no local
// account and no registration intent was supplied. Callers surface this as
// "no account — please register" rather than silently creating one.
var ErrNoAccount = errors.New("no account for email")

// Intent carries the data a registration needs. It is nil for a plain sign-in.
type Intent struct {
	AccountType models.AccountType
	Nickname    string // display name stored on the user
	Name        string // startup name (account_type == startup)
}

// LinkOrCreate matches the email to a local user and links this SuperTokens
// identity to it. When the user does not exist it creates one from intent (and a
// startup profile for startup accounts); if intent is nil it returns ErrNoAccount.
func LinkOrCreate(db *gorm.DB, email, authUserID string, intent *Intent) (models.User, error) {
	var user models.User
	err := db.Where("email = ?", email).First(&user).Error
	if err == nil {
		// Existing account: point it at whichever identity just authenticated.
		if user.AuthUserID != authUserID {
			user.AuthUserID = authUserID
			if err := db.Save(&user).Error; err != nil {
				return user, err
			}
		}
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return user, err
	}
	if intent == nil {
		return user, ErrNoAccount
	}

	accountType := intent.AccountType
	if accountType == "" {
		accountType = models.AccountTypeUser
	}
	user = models.User{
		AuthUserID:  authUserID,
		Email:       email,
		Nickname:    intent.Nickname,
		AccountType: accountType,
	}
	if err := db.Create(&user).Error; err != nil {
		return user, err
	}

	// Startups get an unverified profile; the owner verifies the domain later.
	if accountType == models.AccountTypeStartup {
		startup := models.Startup{
			Name:       intent.Name,
			OwnerID:    user.ID,
			OwnerEmail: user.Email,
		}
		if err := db.Create(&startup).Error; err != nil {
			return user, err
		}
	}
	return user, nil
}

// SessionPayload is the access-token payload the auth middleware expects on every
// session, regardless of how the user signed in.
func SessionPayload(user models.User) map[string]interface{} {
	return map[string]interface{}{
		"email":        user.Email,
		"account_type": user.AccountType,
		"user_id":      user.ID, // internal user id, not the SuperTokens auth id
	}
}
