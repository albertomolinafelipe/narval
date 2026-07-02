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
