//go:build integration

package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"

	"github.com/narval/server/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateStartup_Success(t *testing.T) {
	truncateTables(t)

	// Seed a user with startup account type.
	const ownerID = "startup-owner-1"
	const ownerEmail = "owner1@acme.io"
	user := models.User{
		AuthUserID:  ownerID,
		Email:       ownerEmail,
		Nickname:    "Owner One",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	payload := `{"name":"Acme Inc","description":"A cool startup","website":"https://acme.io"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(ownerID, ownerEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "Acme Inc", body["name"])
	assert.Equal(t, ownerID, body["owner_id"])
	assert.NotEmpty(t, body["id"])
}

func TestCreateStartup_DuplicateName(t *testing.T) {
	truncateTables(t)

	// Two different startup users try to register with the same name.
	for i, ownerID := range []string{"owner-dup-1", "owner-dup-2"} {
		email := fmt.Sprintf("dup%d@acme.io", i)
		user := models.User{
			AuthUserID:  ownerID,
			Email:       email,
			Nickname:    ownerID,
			AccountType: models.AccountTypeStartup,
		}
		require.NoError(t, testDB.Create(&user).Error)
	}

	// First creation succeeds.
	payload := `{"name":"Taken Name","website":"https://taken.io"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader("owner-dup-1", "dup0@acme.io"))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	// Second creation with same name should conflict.
	payload2 := `{"name":"Taken Name","website":"https://taken2.io"}`
	req2, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(payload2))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", authHeader("owner-dup-2", "dup1@acme.io"))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	resp2.Body.Close()
	assert.Equal(t, http.StatusConflict, resp2.StatusCode)
}

func TestUpdateStartup_Success(t *testing.T) {
	truncateTables(t)

	const ownerID = "startup-update-owner"
	const ownerEmail = "update@startup.io"
	user := models.User{
		AuthUserID:  ownerID,
		Email:       ownerEmail,
		Nickname:    "Updater",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	// Create startup first.
	createPayload := `{"name":"Original Name","website":"https://original.io"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(createPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	startupID := created["id"].(string)

	// Now patch it.
	updatePayload := `{"tagline":"We build things"}`
	req2, _ := http.NewRequest(http.MethodPut, testServer.URL+"/api/v1/startups/"+startupID, strings.NewReader(updatePayload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()
	require.Equal(t, http.StatusOK, resp2.StatusCode)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&updated))
	assert.Equal(t, "We build things", updated["tagline"])
}

func TestUploadStartupLogo_Success(t *testing.T) {
	truncateTables(t)

	const ownerID = "startup-logo-owner"
	const ownerEmail = "logo@startup.io"
	user := models.User{
		AuthUserID:  ownerID,
		Email:       ownerEmail,
		Nickname:    "LogoOwner",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user).Error)

	// Create startup.
	createPayload := `{"name":"Logo Startup","website":"https://logo.io"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(createPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	startupID := created["id"].(string)

	// Upload logo.
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, _ := mw.CreateFormFile("logo", "logo.png")
	fw.Write([]byte("fakepngdata")) //nolint:errcheck
	mw.Close()

	req2, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/logo", &body)
	req2.Header.Set("Content-Type", mw.FormDataContentType())
	req2.Header.Set("Authorization", authHeader(ownerID, ownerEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()
	require.Equal(t, http.StatusOK, resp2.StatusCode)

	var updated map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&updated))
	assert.NotEmpty(t, updated["logo_url"])
	assert.Contains(t, updated["logo_url"].(string), startupID)
}

func TestListStartups_ProfileSetupFilter(t *testing.T) {
	truncateTables(t)

	// Create two startup users and profiles
	const owner1ID = "startup-filter-1"
	const owner2ID = "startup-filter-2"
	user1 := models.User{
		KeycloakID:  owner1ID,
		Email:       "owner1@filter.io",
		Nickname:    "Owner 1",
		AccountType: models.AccountTypeStartup,
	}
	user2 := models.User{
		KeycloakID:  owner2ID,
		Email:       "owner2@filter.io",
		Nickname:    "Owner 2",
		AccountType: models.AccountTypeStartup,
	}
	require.NoError(t, testDB.Create(&user1).Error)
	require.NoError(t, testDB.Create(&user2).Error)

	// Create startup 1 (profile_setup = false - incomplete)
	startup1 := models.Startup{
		Name:         "Incomplete Startup",
		Website:      "https://incomplete.io",
		OwnerID:      owner1ID,
		OwnerEmail:   "owner1@filter.io",
		ProfileSetup: false,
	}
	require.NoError(t, testDB.Create(&startup1).Error)

	// Create startup 2 (profile_setup = true - complete)
	startup2 := models.Startup{
		Name:         "Complete Startup",
		Website:      "https://complete.io",
		OwnerID:      owner2ID,
		OwnerEmail:   "owner2@filter.io",
		ProfileSetup: true,
	}
	require.NoError(t, testDB.Create(&startup2).Error)

	// List startups without authentication - should only see the complete one
	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var startups []map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&startups))
	assert.Len(t, startups, 1, "unauthenticated users should only see complete profiles")
	assert.Equal(t, "Complete Startup", startups[0]["name"])

	// List startups as owner1 - should see both (their own incomplete + complete)
	req2, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups", nil)
	req2.Header.Set("Authorization", authHeader(owner1ID, "owner1@filter.io"))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()
	require.Equal(t, http.StatusOK, resp2.StatusCode)

	var startupsAuth []map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&startupsAuth))
	assert.Len(t, startupsAuth, 2, "owners should see their own incomplete profile + all complete profiles")
}
