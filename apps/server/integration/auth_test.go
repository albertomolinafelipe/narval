//go:build integration

package integration_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/narval/server/models"
)

// The OTP happy paths (register/login/claim → verify) require a live SuperTokens
// core to create and consume codes, which this suite does not run. They are
// covered by the request-validation tests below up to the SuperTokens boundary;
// full-flow coverage belongs to an e2e suite against the compose stack.

func TestRegister_InvalidPayload(t *testing.T) {
	truncateTables(t)

	cases := []struct {
		name    string
		payload string
	}{
		{"missing account type", `{"email":"a@b.io","nickname":"al"}`},
		{"bad account type", `{"account_type":"investor","email":"a@b.io","nickname":"al"}`},
		{"user without nickname", `{"account_type":"user","email":"a@b.io"}`},
		{"startup without name", `{"account_type":"startup","email":"a@b.io"}`},
		{"invalid email format", `{"account_type":"user","email":"not-an-email","nickname":"al"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/register", strings.NewReader(tc.payload))
			req.Header.Set("Content-Type", "application/json")
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		})
	}
}

func TestRegister_ExistingEmail(t *testing.T) {
	truncateTables(t)

	user := models.User{
		AuthUserID:  "existing-auth-id",
		Email:       "taken@example.com",
		Nickname:    "taken",
		AccountType: models.AccountTypeUser,
	}
	require.NoError(t, testDB.Create(&user).Error)

	payload := `{"account_type":"user","email":"taken@example.com","nickname":"someone"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/register", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "EMAIL_EXISTS", body["code"])
}

func TestLogin_UnknownEmail(t *testing.T) {
	truncateTables(t)

	payload := `{"email":"nobody@example.com"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/login", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "USER_NOT_FOUND", body["code"])
}

func TestStartClaim_InvalidToken(t *testing.T) {
	truncateTables(t)

	payload := `{"email":"claimer@example.com","token":"no-such-token"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/claim", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "INVALID_CLAIM", body["code"])
}

func TestLogin_RateLimited(t *testing.T) {
	truncateTables(t)

	// otpPerEmail allows 3 requests per window; the 4th with the same email is
	// throttled before the user lookup, so an unknown email yields 404 three
	// times and then 429.
	const payload = `{"email":"spammer@example.com"}`
	send := func() *http.Response {
		req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/login", strings.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		return resp
	}

	for i := 0; i < 3; i++ {
		resp := send()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "request %d should pass rate limiting", i+1)
		resp.Body.Close()
	}

	resp := send()
	defer resp.Body.Close()
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
	assert.NotEmpty(t, resp.Header.Get("Retry-After"))

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "RATE_LIMITED", body["code"])
}

func TestGetMe_Unauthenticated(t *testing.T) {
	truncateTables(t)

	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/auth/me", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestGetMe_StartupAccount(t *testing.T) {
	truncateTables(t)

	const authID = "me-startup-user"
	const email = "me@startup.io"
	user := models.User{
		AuthUserID:  authID,
		Email:       email,
		Nickname:    "Me Startup",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	claimed := models.Startup{
		Name:       "My Claimed Startup",
		Website:    "https://claimed.io",
		OwnerID:    user.ID,
		OwnerEmail: email,
		Claimed:    true,
	}
	require.NoError(t, testDB.Create(&claimed).Error)

	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/auth/me", nil)
	req.Header.Set("Authorization", authHeader(authID, email))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, email, body["email"])
	assert.Equal(t, "startup", body["account_type"])
	assert.Equal(t, claimed.ID, body["profile_id"])
}

func TestGetMe_UnclaimedShellIsNotProfile(t *testing.T) {
	truncateTables(t)

	const authID = "me-admin-user"
	const email = "admin@narval.io"
	user := models.User{
		AuthUserID:  authID,
		Email:       email,
		Nickname:    "Admin",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	shell := models.Startup{
		Name:       "Seeded Shell",
		OwnerID:    user.ID,
		OwnerEmail: email,
		Claimed:    false,
		ClaimToken: "shell-token",
	}
	require.NoError(t, testDB.Create(&shell).Error)

	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/auth/me", nil)
	req.Header.Set("Authorization", authHeader(authID, email))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Nil(t, body["profile_id"], "an unclaimed shell must not surface as the user's profile")
}
