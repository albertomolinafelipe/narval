//go:build integration

package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/narval/server/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// postAdminStartup hits POST /admin/startups as the given identity.
func postAdminStartup(t *testing.T, userID, email, payload string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/admin/startups", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if userID != "" {
		req.Header.Set("Authorization", authHeader(userID, email))
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func TestCreateAdminStartup_Unauthenticated(t *testing.T) {
	truncateTables(t)

	resp := postAdminStartup(t, "", "", `{"name":"Shell Co"}`)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestCreateAdminStartup_NonAdminForbidden(t *testing.T) {
	truncateTables(t)

	resp := postAdminStartup(t, "regular-user", "regular@user.io", `{"name":"Shell Co"}`)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "FORBIDDEN", body["code"])
}

func TestCreateAdminStartup_NameTooShortRejected(t *testing.T) {
	truncateTables(t)

	// Enforced by the spec validator (minLength 2), not handler code.
	resp := postAdminStartup(t, "admin-1", adminEmail, `{"name":"X"}`)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

// TestAdminClaimFlow walks the seeded-shell lifecycle: admin creates a shell,
// re-reads its claim link as owner, and the public claim page resolves the
// token; a bogus token 404s.
func TestAdminClaimFlow(t *testing.T) {
	truncateTables(t)

	resp := postAdminStartup(t, "admin-1", adminEmail, `{"name":"Seeded Shell"}`)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created struct {
		Id         string `json:"id"`
		Name       string `json:"name"`
		ClaimToken string `json:"claim_token"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	assert.Equal(t, "Seeded Shell", created.Name)
	require.NotEmpty(t, created.ClaimToken)

	// Owner (the admin) can re-read the claim link from the edit page.
	linkReq, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+created.Id+"/claim-link", nil)
	linkReq.Header.Set("Authorization", authHeader("admin-1", adminEmail))
	linkResp, err := http.DefaultClient.Do(linkReq)
	require.NoError(t, err)
	defer linkResp.Body.Close()
	require.Equal(t, http.StatusOK, linkResp.StatusCode)

	var link struct {
		Claimed    bool   `json:"claimed"`
		ClaimToken string `json:"claim_token"`
	}
	require.NoError(t, json.NewDecoder(linkResp.Body).Decode(&link))
	assert.False(t, link.Claimed)
	assert.Equal(t, created.ClaimToken, link.ClaimToken)

	// A non-owner gets 403 for the same link.
	otherReq, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+created.Id+"/claim-link", nil)
	otherReq.Header.Set("Authorization", authHeader("someone-else", "other@user.io"))
	otherResp, err := http.DefaultClient.Do(otherReq)
	require.NoError(t, err)
	otherResp.Body.Close()
	assert.Equal(t, http.StatusForbidden, otherResp.StatusCode)

	// The public claim page can preview the shell by token, without a session.
	claimResp, err := http.Get(testServer.URL + "/api/v1/claim/" + created.ClaimToken)
	require.NoError(t, err)
	defer claimResp.Body.Close()
	require.Equal(t, http.StatusOK, claimResp.StatusCode)

	var preview map[string]any
	require.NoError(t, json.NewDecoder(claimResp.Body).Decode(&preview))
	assert.Equal(t, "Seeded Shell", preview["name"])
	assert.Equal(t, false, preview["claimed"])

	// Bogus tokens 404.
	bogusResp, err := http.Get(testServer.URL + "/api/v1/claim/not-a-real-token")
	require.NoError(t, err)
	bogusResp.Body.Close()
	assert.Equal(t, http.StatusNotFound, bogusResp.StatusCode)
}

// TestUpdateStartup_InvalidEnumRejected proves enum validation is spec-driven:
// the handler no longer has hand-coded enum tables.
func TestUpdateStartup_InvalidEnumRejected(t *testing.T) {
	truncateTables(t)

	const ownerID = "enum-owner"
	const ownerEmail = "enum@startup.io"
	user := models.User{
		AuthUserID:  ownerID,
		Email:       ownerEmail,
		Nickname:    "Enum Owner",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	createPayload := `{"name":"Enum Co","website":"https://enum.io"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(createPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	id, _ := created["id"].(string)
	require.NotEmpty(t, id)

	for _, tc := range []struct{ field, value string }{
		{"stage", "warp-speed"},
		{"industry", "Time Travel"},
		{"current_round", "series-z"},
	} {
		payload := fmt.Sprintf(`{"%s":%q}`, tc.field, tc.value)
		upd, _ := http.NewRequest(http.MethodPut, testServer.URL+"/api/v1/startups/"+id, strings.NewReader(payload))
		upd.Header.Set("Content-Type", "application/json")
		upd.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
		updResp, err := http.DefaultClient.Do(upd)
		require.NoError(t, err)
		updResp.Body.Close()
		assert.Equalf(t, http.StatusBadRequest, updResp.StatusCode, "invalid %s should be rejected", tc.field)
	}

	// A valid enum still goes through.
	upd, _ := http.NewRequest(http.MethodPut, testServer.URL+"/api/v1/startups/"+id, strings.NewReader(`{"stage":"seed"}`))
	upd.Header.Set("Content-Type", "application/json")
	upd.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	updResp, err := http.DefaultClient.Do(upd)
	require.NoError(t, err)
	defer updResp.Body.Close()
	assert.Equal(t, http.StatusOK, updResp.StatusCode)
}
