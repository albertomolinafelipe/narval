//go:build integration

package integration_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRegisterVerify_PlainUser exercises the register → pending-code → verify
// flow for a plain "user" account type.
func TestRegisterVerify_PlainUser(t *testing.T) {
	truncateTables(t)

	const email = "alice@example.com"

	// 1. Register.
	regPayload := `{"email":"alice@example.com","nickname":"alice","password":"password123","account_type":"user"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/register", strings.NewReader(regPayload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.Equal(t, http.StatusAccepted, resp.StatusCode)

	// 2. Fetch the code via the test-only endpoint.
	codeReq, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/auth/test/pending-code?email="+email, nil)
	codeResp, err := http.DefaultClient.Do(codeReq)
	require.NoError(t, err)
	defer codeResp.Body.Close()
	require.Equal(t, http.StatusOK, codeResp.StatusCode)

	var codeBody map[string]any
	require.NoError(t, json.NewDecoder(codeResp.Body).Decode(&codeBody))
	code, ok := codeBody["code"].(string)
	require.True(t, ok, "response should contain a string code field")
	require.Len(t, code, 6, "verification code should be 6 digits")

	// 3. Verify — this normally creates a Keycloak user, but the Verify handler
	// will fail at the Keycloak step since Keycloak isn't running.
	// We verify the code lookup path works by checking for a non-400 error
	// about the code itself; a 500/upstream error means the code was correct.
	verifyPayload := `{"email":"alice@example.com","code":"` + code + `"}`
	vReq, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/verify", strings.NewReader(verifyPayload))
	vReq.Header.Set("Content-Type", "application/json")
	vResp, err := http.DefaultClient.Do(vReq)
	require.NoError(t, err)
	defer vResp.Body.Close()

	// We expect either 201 (if Keycloak is up) or 500 UPSTREAM_ERROR (Keycloak
	// not running in test env). Either way, it must NOT be 400 INVALID_CODE.
	var verifyBody map[string]any
	json.NewDecoder(vResp.Body).Decode(&verifyBody) //nolint:errcheck
	assert.NotEqual(t, "INVALID_CODE", verifyBody["code"],
		"should not receive INVALID_CODE — the correct code was sent")
}

// TestRegisterVerify_Startup exercises the register → pending-code → verify
// flow for a startup account type.
func TestRegisterVerify_Startup(t *testing.T) {
	truncateTables(t)

	// 1. Register startup with name + email. Domain verification is no longer
	// part of signup — it happens later from the profile.
	draftPayload := `{
		"account_type":  "startup",
		"name":          "Draft Corp",
		"email":         "hello@draftcorp.io"
	}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/register", strings.NewReader(draftPayload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	derivedEmail := "hello@draftcorp.io"

	// 2. Fetch code via test-only endpoint.
	codeReq, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/auth/test/pending-code?email="+derivedEmail, nil)
	codeResp, err := http.DefaultClient.Do(codeReq)
	require.NoError(t, err)
	defer codeResp.Body.Close()
	require.Equal(t, http.StatusOK, codeResp.StatusCode)

	var codeBody map[string]any
	require.NoError(t, json.NewDecoder(codeResp.Body).Decode(&codeBody))
	code, ok := codeBody["code"].(string)
	require.True(t, ok, "response should contain a string code field")
	require.Len(t, code, 6)

	// 3. Verify — Keycloak is not running so we expect upstream error,
	// but NOT an INVALID_CODE error.
	verifyPayload := `{"email":"` + derivedEmail + `","code":"` + code + `"}`
	vReq, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/verify", strings.NewReader(verifyPayload))
	vReq.Header.Set("Content-Type", "application/json")
	vResp, err := http.DefaultClient.Do(vReq)
	require.NoError(t, err)
	defer vResp.Body.Close()

	var verifyBody map[string]any
	json.NewDecoder(vResp.Body).Decode(&verifyBody) //nolint:errcheck
	assert.NotEqual(t, "INVALID_CODE", verifyBody["code"],
		"should not receive INVALID_CODE — the correct code was sent")
}

// TestRegisterVerify_WrongCode ensures a bad code returns 400 INVALID_CODE.
func TestRegisterVerify_WrongCode(t *testing.T) {
	truncateTables(t)

	// Register a plain user.
	regPayload := `{"email":"bob@example.com","nickname":"bob","password":"password123","account_type":"user"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/register", strings.NewReader(regPayload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	// Submit wrong code.
	verifyPayload := `{"email":"bob@example.com","code":"000000"}`
	vReq, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/verify", strings.NewReader(verifyPayload))
	vReq.Header.Set("Content-Type", "application/json")
	vResp, err := http.DefaultClient.Do(vReq)
	require.NoError(t, err)
	defer vResp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, vResp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(vResp.Body).Decode(&body))
	assert.Equal(t, "INVALID_CODE", body["code"])
}

// TestRefreshToken_MissingRefreshToken ensures missing refresh_token returns 400 BAD_REQUEST.
func TestRefreshToken_MissingRefreshToken(t *testing.T) {
	// Empty body.
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/refresh", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "BAD_REQUEST", body["code"])
	assert.Contains(t, body["message"], "refresh_token is required")
}

// TestRefreshToken_EmptyRefreshToken ensures empty refresh_token returns 400 BAD_REQUEST.
func TestRefreshToken_EmptyRefreshToken(t *testing.T) {
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/refresh", strings.NewReader(`{"refresh_token":""}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "BAD_REQUEST", body["code"])
}

// TestRefreshToken_InvalidRefreshToken tests behavior with an invalid token.
// Since Keycloak is not running in tests, we expect an UPSTREAM_ERROR.
// This verifies the handler correctly processes the request and attempts
// to communicate with Keycloak.
func TestRefreshToken_InvalidRefreshToken(t *testing.T) {
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/auth/refresh", strings.NewReader(`{"refresh_token":"invalid-token"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Keycloak is not running, so we expect either:
	// - 500 UPSTREAM_ERROR (Keycloak unreachable), or
	// - 401 UNAUTHORIZED (if Keycloak were running and rejected the token)
	// Either way, it must NOT be 400 BAD_REQUEST (validation passed).
	assert.NotEqual(t, http.StatusBadRequest, resp.StatusCode,
		"should not return 400 — the request body was valid")

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	// The code should be either UPSTREAM_ERROR or UNAUTHORIZED.
	code, ok := body["code"].(string)
	require.True(t, ok, "response should contain a string code field")
	assert.True(t, code == "UPSTREAM_ERROR" || code == "UNAUTHORIZED",
		"expected UPSTREAM_ERROR or UNAUTHORIZED, got: %s", code)
}
