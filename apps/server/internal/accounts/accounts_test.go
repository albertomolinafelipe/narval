package accounts_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/narval/server/internal/accounts"
	"github.com/narval/server/models"
)

func newDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Startup{}))
	return db
}

func TestLinkOrCreate_NewUser(t *testing.T) {
	db := newDB(t)
	u, err := accounts.LinkOrCreate(db, "a@b.com", "auth-1", &accounts.Intent{
		AccountType: models.AccountTypeUser,
		Nickname:    "Alice",
	})
	require.NoError(t, err)
	assert.Equal(t, models.AccountTypeUser, u.AccountType)
	assert.Equal(t, "auth-1", u.AuthUserID)

	var n int64
	db.Model(&models.Startup{}).Count(&n)
	assert.Zero(t, n, "user account should not create a startup")
}

func TestLinkOrCreate_NewStartupCreatesProfile(t *testing.T) {
	db := newDB(t)
	u, err := accounts.LinkOrCreate(db, "founder@acme.io", "auth-2", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		Name:        "Acme",
	})
	require.NoError(t, err)

	var st models.Startup
	require.NoError(t, db.Where("owner_id = ?", u.ID).First(&st).Error)
	assert.Equal(t, "Acme", st.Name)
	assert.Equal(t, "founder@acme.io", st.OwnerEmail)
	assert.False(t, st.Verified)
}

func TestLinkOrCreate_ExistingUserRelinks(t *testing.T) {
	db := newDB(t)
	_, err := accounts.LinkOrCreate(db, "a@b.com", "auth-old", &accounts.Intent{
		AccountType: models.AccountTypeUser,
		Nickname:    "Alice",
	})
	require.NoError(t, err)

	// Signing in via a different identity (e.g. Google) relinks, no duplicate.
	u, err := accounts.LinkOrCreate(db, "a@b.com", "auth-new", nil)
	require.NoError(t, err)
	assert.Equal(t, "auth-new", u.AuthUserID)

	var count int64
	db.Model(&models.User{}).Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestLinkOrCreate_UnknownSignInRejected(t *testing.T) {
	db := newDB(t)
	_, err := accounts.LinkOrCreate(db, "nobody@b.com", "auth-x", nil)
	assert.ErrorIs(t, err, accounts.ErrNoAccount)
}

// seedShell inserts an admin-owned unclaimed shell and returns its token.
func seedShell(t *testing.T, db *gorm.DB, name string) (models.Startup, string) {
	t.Helper()
	token := "tok-" + name
	shell := models.Startup{
		Name:       name,
		OwnerID:    "admin-user-id",
		OwnerEmail: "admin@narval.com",
		Claimed:    false,
		ClaimToken: token,
	}
	require.NoError(t, db.Create(&shell).Error)
	return shell, token
}

func TestLinkOrCreate_ClaimByNewUser(t *testing.T) {
	db := newDB(t)
	shell, token := seedShell(t, db, "Acme")

	u, err := accounts.LinkOrCreate(db, "founder@acme.io", "auth-claim", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		Nickname:    "Founder",
		ClaimToken:  token,
	})
	require.NoError(t, err)
	assert.Equal(t, models.AccountTypeStartup, u.AccountType)

	// Ownership transferred onto the existing shell — no second startup created.
	var count int64
	db.Model(&models.Startup{}).Count(&count)
	assert.Equal(t, int64(1), count)

	var st models.Startup
	require.NoError(t, db.First(&st, "id = ?", shell.ID).Error)
	assert.Equal(t, u.ID, st.OwnerID)
	assert.Equal(t, "founder@acme.io", st.OwnerEmail)
	assert.True(t, st.Claimed)
	assert.Empty(t, st.ClaimToken, "token is burned on claim")
}

func TestLinkOrCreate_ClaimByExistingUser(t *testing.T) {
	db := newDB(t)
	_, token := seedShell(t, db, "Acme")

	// A plain user already exists, then claims.
	_, err := accounts.LinkOrCreate(db, "person@x.com", "auth-1", &accounts.Intent{
		AccountType: models.AccountTypeUser,
		Nickname:    "Person",
	})
	require.NoError(t, err)

	u, err := accounts.LinkOrCreate(db, "person@x.com", "auth-1", &accounts.Intent{
		ClaimToken: token,
	})
	require.NoError(t, err)
	assert.Equal(t, models.AccountTypeStartup, u.AccountType, "claiming promotes to a startup account")

	var st models.Startup
	require.NoError(t, db.Where("owner_id = ?", u.ID).First(&st).Error)
	assert.True(t, st.Claimed)
}

func TestLinkOrCreate_ClaimRejectedWhenAlreadyHasProfile(t *testing.T) {
	db := newDB(t)

	// Registered as a startup — this account already owns a claimed profile.
	_, err := accounts.LinkOrCreate(db, "dup@acme.io", "auth-1", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		Name:        "Acme",
	})
	require.NoError(t, err)

	// Claiming a shell with the same account is rejected — one profile per account.
	_, token := seedShell(t, db, "Shell")
	_, err = accounts.LinkOrCreate(db, "dup@acme.io", "auth-1", &accounts.Intent{
		ClaimToken: token,
	})
	assert.ErrorIs(t, err, accounts.ErrAlreadyHasProfile)

	// The shell is left untouched.
	var shell models.Startup
	require.NoError(t, db.Where("claim_token = ?", token).First(&shell).Error)
	assert.False(t, shell.Claimed)
}

func TestLinkOrCreate_ClaimInvalidToken(t *testing.T) {
	db := newDB(t)
	_, err := accounts.LinkOrCreate(db, "founder@acme.io", "auth-claim", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		ClaimToken:  "does-not-exist",
	})
	assert.ErrorIs(t, err, accounts.ErrInvalidClaim)
}

func TestLinkOrCreate_ClaimAlreadyClaimed(t *testing.T) {
	db := newDB(t)
	_, token := seedShell(t, db, "Acme")

	_, err := accounts.LinkOrCreate(db, "first@acme.io", "auth-1", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		ClaimToken:  token,
	})
	require.NoError(t, err)

	// The token was burned; a second attempt is rejected.
	_, err = accounts.LinkOrCreate(db, "second@acme.io", "auth-2", &accounts.Intent{
		AccountType: models.AccountTypeStartup,
		ClaimToken:  token,
	})
	assert.ErrorIs(t, err, accounts.ErrInvalidClaim)
}
