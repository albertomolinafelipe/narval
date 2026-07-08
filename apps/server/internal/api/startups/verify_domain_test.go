package startups_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/narval/server/models"
)

// captureMailer records the plaintext code so tests can complete the flow.
type captureMailer struct {
	to, domain, code string
	calls            int
}

func (m *captureMailer) SendDomainVerificationCode(to, domain, code string) error {
	m.to, m.domain, m.code = to, domain, code
	m.calls++
	return nil
}

func postJSON(t *testing.T, path, body string, auth func(*gin.Context)) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if auth != nil {
		auth(c)
	}
	return w, c
}

func TestDomainVerification_HappyPath(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)
	require.NoError(t, db.AutoMigrate(&models.DomainVerification{}))
	mailer := &captureMailer{}
	h.Mailer = mailer
	st := models.Startup{Name: "Acme", OwnerID: "owner-1", OwnerEmail: "owner@acme.io"}
	require.NoError(t, db.Create(&st).Error)
	id := uuid.MustParse(st.ID)

	// Start
	w, c := postJSON(t, "/verify-domain", `{"website":"acme.io","email_prefix":"you"}`,
		func(c *gin.Context) { setUserContext(c, "owner-1", "owner@acme.io") })
	h.StartDomainVerification(c, id)
	require.Equal(t, http.StatusAccepted, w.Code)
	require.Equal(t, 1, mailer.calls)
	assert.Equal(t, "you@acme.io", mailer.to)
	require.Len(t, mailer.code, 6)

	// Confirm with the captured code
	w2, c2 := postJSON(t, "/verify-domain/confirm", `{"code":"`+mailer.code+`"}`,
		func(c *gin.Context) { setUserContext(c, "owner-1", "owner@acme.io") })
	h.ConfirmDomainVerification(c2, id)
	require.Equal(t, http.StatusOK, w2.Code)

	var updated models.Startup
	require.NoError(t, db.First(&updated, "id = ?", st.ID).Error)
	assert.True(t, updated.Verified)
	assert.Equal(t, "acme.io", updated.VerifiedDomain)

	// Challenge is consumed
	var n int64
	db.Model(&models.DomainVerification{}).Where("startup_id = ?", st.ID).Count(&n)
	assert.Zero(t, n)
}

func TestDomainVerification_WrongCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)
	require.NoError(t, db.AutoMigrate(&models.DomainVerification{}))
	h.Mailer = &captureMailer{}
	st := models.Startup{Name: "Acme", OwnerID: "owner-1", OwnerEmail: "owner@acme.io"}
	require.NoError(t, db.Create(&st).Error)
	id := uuid.MustParse(st.ID)

	_, c := postJSON(t, "/verify-domain", `{"website":"acme.io","email_prefix":"you"}`,
		func(c *gin.Context) { setUserContext(c, "owner-1", "owner@acme.io") })
	h.StartDomainVerification(c, id)

	w, c2 := postJSON(t, "/verify-domain/confirm", `{"code":"000000"}`,
		func(c *gin.Context) { setUserContext(c, "owner-1", "owner@acme.io") })
	h.ConfirmDomainVerification(c2, id)
	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var updated models.Startup
	require.NoError(t, db.First(&updated, "id = ?", st.ID).Error)
	assert.False(t, updated.Verified)
}

func TestDomainVerification_Guards(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)
	require.NoError(t, db.AutoMigrate(&models.DomainVerification{}))
	h.Mailer = &captureMailer{}
	st := models.Startup{Name: "Acme", OwnerID: "owner-1", OwnerEmail: "owner@acme.io"}
	require.NoError(t, db.Create(&st).Error)
	id := uuid.MustParse(st.ID)

	cases := []struct {
		name, body string
		asOwner    bool
		want       int
	}{
		{"subdomain", `{"website":"app.acme.io","email_prefix":"you"}`, true, http.StatusBadRequest},
		{"public domain", `{"website":"gmail.com","email_prefix":"you"}`, true, http.StatusBadRequest},
		{"not owner", `{"website":"acme.io","email_prefix":"you"}`, false, http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			owner := "owner-1"
			if !tc.asOwner {
				owner = "someone-else"
			}
			w, c := postJSON(t, "/verify-domain", tc.body,
				func(c *gin.Context) { setUserContext(c, owner, "x@x.io") })
			h.StartDomainVerification(c, id)
			assert.Equal(t, tc.want, w.Code)
		})
	}
}

func TestDomainVerification_DomainTakenByOther(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h, db := buildHandler(t)
	require.NoError(t, db.AutoMigrate(&models.DomainVerification{}))
	h.Mailer = &captureMailer{}

	// Another startup already verified acme.io.
	other := models.Startup{Name: "Other", OwnerID: "owner-2", OwnerEmail: "o@x.io", Verified: true, VerifiedDomain: "acme.io"}
	require.NoError(t, db.Create(&other).Error)
	st := models.Startup{Name: "Acme", OwnerID: "owner-1", OwnerEmail: "owner@acme.io"}
	require.NoError(t, db.Create(&st).Error)
	id := uuid.MustParse(st.ID)

	w, c := postJSON(t, "/verify-domain", `{"website":"acme.io","email_prefix":"you"}`,
		func(c *gin.Context) { setUserContext(c, "owner-1", "owner@acme.io") })
	h.StartDomainVerification(c, id)
	assert.Equal(t, http.StatusConflict, w.Code)
}
