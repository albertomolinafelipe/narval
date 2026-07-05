package startups_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/narval/server/internal/api/startups"
	"github.com/narval/server/models"
)

// fakeStorage satisfies StorageClient without a real MinIO.
type fakeStorage struct{}

func (f *fakeStorage) UploadLogo(_ context.Context, objectName string, _ io.Reader, _ int64, _ string) (string, error) {
	return "http://minio/narval/" + objectName, nil
}

// buildHandler creates an in-memory SQLite DB, runs migrations, and returns a Handler.
func buildHandler(t *testing.T) (*startups.Handler, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.Startup{}, &models.User{}))
	return startups.NewHandlerWithStorage(db, &fakeStorage{}), db
}

// setUserContext injects the fake auth claims the middleware normally provides.
func setUserContext(c *gin.Context, id, email string) {
	c.Set("userID", id)
	c.Set("dbUserID", id)
	c.Set("userEmail", email)
}

// seedUser inserts a user row so GetAccountType can resolve the auth_user_id.
func seedUser(t *testing.T, db *gorm.DB, authUserID, email string, accountType models.AccountType) {
	t.Helper()
	u := models.User{
		AuthUserID:  authUserID,
		Email:       email,
		Nickname:    authUserID,
		AccountType: accountType,
	}
	require.NoError(t, db.Create(&u).Error)
}

func TestListStartups_Empty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, _ := buildHandler(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/startups", nil)
	setUserContext(c, "user-1", "user1@example.com")

	h.ListStartups(c)

	require.Equal(t, http.StatusOK, w.Code)
	var body []any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Empty(t, body)
}

// startupResp mirrors the JSON shape the handler returns.
// Founders is json.RawMessage because the handler returns it as a parsed array,
// while models.Startup stores it as a raw JSON string.
type startupResp struct {
	models.Startup
	BannerImages []string        `json:"banner_images"`
	Founders     json.RawMessage `json:"founders"`
}

func TestCreateStartup_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	seedUser(t, db, "owner-1", "owner@acme.io", models.AccountTypeStartup)

	payload := `{"name":"Acme Inc","description":"A cool startup","website":"https://acme.io"}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	setUserContext(c, "owner-1", "owner@acme.io")

	h.CreateStartup(c)

	require.Equal(t, http.StatusCreated, w.Code)

	var s startupResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &s))
	assert.Equal(t, "Acme Inc", s.Name)
	assert.Equal(t, "owner-1", s.OwnerID)
	assert.NotEmpty(t, s.ID)

	// Verify persisted in DB.
	var count int64
	db.Model(&models.Startup{}).Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestCreateStartup_MissingName(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, _ := buildHandler(t)

	payload := `{"description":"no name"}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	setUserContext(c, "owner-1", "owner@example.com")

	h.CreateStartup(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateStartup_Duplicate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	seedUser(t, db, "owner-2", "owner2@example.com", models.AccountTypeStartup)

	// Pre-insert a startup with a different owner but the same name.
	existing := models.Startup{
		ID:         "existing-id",
		Name:       "Taken Name",
		OwnerID:    "u1",
		OwnerEmail: "u@e.com",
		CreatedAt:  time.Now(),
	}
	require.NoError(t, db.Create(&existing).Error)

	payload := `{"name":"Taken Name","website":"taken.io"}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	setUserContext(c, "owner-2", "owner2@example.com")

	h.CreateStartup(c)

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestListStartups_ReturnsAll(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	for i := 0; i < 3; i++ {
		s := models.Startup{
			ID:           fmt.Sprintf("id-%d", i),
			Name:         fmt.Sprintf("Startup %d", i),
			OwnerID:      "u1",
			OwnerEmail:   "u@e.com",
			ProfileSetup: true,
			Claimed:      true,
			CreatedAt:    time.Now(),
		}
		require.NoError(t, db.Create(&s).Error)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/v1/startups", nil)
	setUserContext(c, "u1", "u@e.com")

	h.ListStartups(c)

	require.Equal(t, http.StatusOK, w.Code)
	var body []startupResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Len(t, body, 3)
}

func TestUploadStartupLogo_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, _ := buildHandler(t)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("logo", "logo.png")
	fw.Write([]byte("fakepngdata"))
	mw.Close()

	unknownID := uuid.MustParse("00000000-0000-0000-0000-000000000000")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups/"+unknownID.String()+"/logo", &body)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())
	c.Params = gin.Params{{Key: "id", Value: unknownID.String()}}
	setUserContext(c, "any-user", "any@user.com")

	h.UploadStartupLogo(c, unknownID)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestUploadStartupLogo_Forbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	startupID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	s := models.Startup{
		ID:         startupID.String(),
		Name:       "Owned Startup",
		OwnerID:    "real-owner",
		OwnerEmail: "owner@s.com",
		CreatedAt:  time.Now(),
	}
	require.NoError(t, db.Create(&s).Error)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("logo", "logo.png")
	fw.Write([]byte("fakepngdata"))
	mw.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups/"+startupID.String()+"/logo", &body)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())
	c.Params = gin.Params{{Key: "id", Value: startupID.String()}}
	setUserContext(c, "not-the-owner", "other@user.com")

	h.UploadStartupLogo(c, startupID)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestUploadStartupLogo_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	const ownerID = "owner-logo-test"
	startupID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	s := models.Startup{
		ID:         startupID.String(),
		Name:       "Logo Startup",
		OwnerID:    ownerID,
		OwnerEmail: "logo@s.com",
		CreatedAt:  time.Now(),
	}
	require.NoError(t, db.Create(&s).Error)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("logo", "logo.png")
	fw.Write([]byte("fakepngdata"))
	mw.Close()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups/"+startupID.String()+"/logo", &body)
	c.Request.Header.Set("Content-Type", mw.FormDataContentType())
	c.Params = gin.Params{{Key: "id", Value: startupID.String()}}
	setUserContext(c, ownerID, "logo@s.com")

	h.UploadStartupLogo(c, startupID)

	require.Equal(t, http.StatusOK, w.Code)

	var updated startupResp
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &updated))
	assert.NotEmpty(t, updated.LogoURL)
	assert.Contains(t, updated.LogoURL, startupID.String())
}

func TestCreateStartup_WrongAccountType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	seedUser(t, db, "plain-user", "user@example.com", models.AccountTypeUser)

	payload := `{"name":"Should Fail Inc"}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	setUserContext(c, "plain-user", "user@example.com")

	h.CreateStartup(c)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestCreateStartup_AlreadyHasProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)

	seedUser(t, db, "startup-owner", "startup@example.com", models.AccountTypeStartup)

	// Pre-insert an existing profile for this owner.
	existing := models.Startup{
		ID:         "first-profile-id",
		Name:       "First Startup",
		OwnerID:    "startup-owner",
		OwnerEmail: "startup@example.com",
		CreatedAt:  time.Now(),
	}
	require.NoError(t, db.Create(&existing).Error)

	payload := `{"name":"Second Startup"}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/startups", strings.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	setUserContext(c, "startup-owner", "startup@example.com")

	h.CreateStartup(c)

	assert.Equal(t, http.StatusConflict, w.Code)
}
