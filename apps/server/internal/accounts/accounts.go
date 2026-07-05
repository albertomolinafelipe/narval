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

// ErrInvalidClaim is returned when a claim intent references a token that is
// unknown or already claimed.
var ErrInvalidClaim = errors.New("invalid or already-claimed claim token")

// Intent carries the data a registration needs. It is nil for a plain sign-in.
type Intent struct {
	AccountType models.AccountType
	Nickname    string // display name stored on the user
	Name        string // startup name (account_type == startup)

	// ClaimToken, when set, turns this login into a claim: instead of creating a
	// fresh startup, bind the existing unclaimed shell with this token to the user.
	ClaimToken string
}

// LinkOrCreate matches the email to a local user and links this SuperTokens
// identity to it. When the user does not exist it creates one from intent (and a
// startup profile for startup accounts); if intent is nil it returns ErrNoAccount.
func LinkOrCreate(db *gorm.DB, email, authUserID string, intent *Intent) (models.User, error) {
	var user models.User
	err := db.Where("email = ?", email).First(&user).Error
	switch {
	case err == nil:
		// Existing account: point it at whichever identity just authenticated.
		if user.AuthUserID != authUserID {
			user.AuthUserID = authUserID
			if err := db.Save(&user).Error; err != nil {
				return user, err
			}
		}
	case errors.Is(err, gorm.ErrRecordNotFound):
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
		// A normal startup registration gets its own claimed profile (owner
		// verifies the domain later). A claim skips this and attaches the
		// existing shell below instead.
		if accountType == models.AccountTypeStartup && intent.ClaimToken == "" {
			startup := models.Startup{
				Name:       intent.Name,
				OwnerID:    user.ID,
				OwnerEmail: user.Email,
				Claimed:    true,
			}
			if err := db.Create(&startup).Error; err != nil {
				return user, err
			}
		}
	default:
		return user, err
	}

	// A claim intent binds an existing unclaimed shell to whoever just
	// authenticated — new or existing user alike.
	if intent != nil && intent.ClaimToken != "" {
		if err := bindClaim(db, &user, intent.ClaimToken); err != nil {
			return user, err
		}
	}
	return user, nil
}

// bindClaim reassigns the unclaimed shell identified by token to user, marks it
// claimed, and burns the token — atomically. The partial unique index on
// (owner_id) WHERE claimed enforces that the claimant ends up with at most one
// claimed profile; a second claim by the same owner fails on that constraint.
func bindClaim(db *gorm.DB, user *models.User, token string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var s models.Startup
		if err := tx.Where("claim_token = ? AND claimed = ?", token, false).First(&s).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvalidClaim
			}
			return err
		}
		s.OwnerID = user.ID
		s.OwnerEmail = user.Email
		s.Claimed = true
		s.ClaimToken = ""
		if err := tx.Save(&s).Error; err != nil {
			return err
		}
		if user.AccountType != models.AccountTypeStartup {
			user.AccountType = models.AccountTypeStartup
			return tx.Save(user).Error
		}
		return nil
	})
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
