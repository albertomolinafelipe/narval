//go:build integration

package integration_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/narval/server/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createTestStartup creates a startup and returns its ID.
func createTestStartup(t *testing.T, ownerID, ownerEmail, name, website string) string {
	t.Helper()

	// Ensure user exists with startup account type.
	user := models.User{
		AuthUserID:  ownerID,
		Email:       ownerEmail,
		Nickname:    name + " Owner",
		AccountType: models.AccountTypeStartup,
	}
	testDB.FirstOrCreate(&user, "auth_user_id = ?", ownerID)

	payload := `{"name":"` + name + `","website":"` + website + `"}`
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authHeader(ownerID, ownerEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	id := body["id"].(string)

	// Publish the profile — the public list only contains profile_setup = true.
	require.NoError(t, testDB.Model(&models.Startup{}).Where("id = ?", id).
		Update("profile_setup", true).Error)
	return id
}

// createTestUser creates a user and returns their ID and email.
func createTestUser(t *testing.T, userID, email string) {
	t.Helper()
	user := models.User{
		AuthUserID:  userID,
		Email:       email,
		Nickname:    "Test User",
		AccountType: models.AccountTypeUser,
	}
	require.NoError(t, testDB.Create(&user).Error)
}

func TestFavoriteStartup_Success(t *testing.T) {
	truncateTables(t)

	// Create a startup to favorite.
	startupID := createTestStartup(t, "startup-owner-bm1", "owner@bm1.io", "Favorite Test Startup", "https://bm1.io")

	// Create a user who will favorite it.
	const userID = "favorite-user-1"
	const userEmail = "favoriter@test.io"
	createTestUser(t, userID, userEmail)

	// Favorite the startup.
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req.Header.Set("Authorization", authHeader(userID, userEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "startup favorited", body["message"])

	// Verify favorite exists in DB.
	var count int64
	testDB.Model(&models.StartupFavorite{}).Where("user_id = ? AND startup_id = ?", userID, startupID).Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestFavoriteStartup_AlreadyFavorited(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-bm2", "owner@bm2.io", "Already Favorited Startup", "https://bm2.io")

	const userID = "favorite-user-2"
	const userEmail = "favoriter2@test.io"
	createTestUser(t, userID, userEmail)

	// Favorite once.
	req1, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req1.Header.Set("Authorization", authHeader(userID, userEmail))
	resp1, _ := http.DefaultClient.Do(req1)
	resp1.Body.Close()
	require.Equal(t, http.StatusCreated, resp1.StatusCode)

	// Favorite again — should be idempotent.
	req2, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req2.Header.Set("Authorization", authHeader(userID, userEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&body))
	assert.Equal(t, "already favorited", body["message"])
}

func TestFavoriteStartup_Unauthorized(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-bm3", "owner@bm3.io", "Unauth Favorite Test", "https://bm3.io")

	// No auth header.
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestFavoriteStartup_NotFound(t *testing.T) {
	truncateTables(t)

	const userID = "favorite-user-notfound"
	const userEmail = "favoriter-notfound@test.io"
	createTestUser(t, userID, userEmail)

	// Non-existent startup UUID.
	fakeID := "00000000-0000-0000-0000-000000000000"
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+fakeID+"/bookmark", nil)
	req.Header.Set("Authorization", authHeader(userID, userEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestUnfavoriteStartup_Success(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-unbm1", "owner@unbm1.io", "Unfavorite Test Startup", "https://unbm1.io")

	const userID = "unfavorite-user-1"
	const userEmail = "unfavoriter@test.io"
	createTestUser(t, userID, userEmail)

	// Favorite first.
	req1, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req1.Header.Set("Authorization", authHeader(userID, userEmail))
	resp1, _ := http.DefaultClient.Do(req1)
	resp1.Body.Close()
	require.Equal(t, http.StatusCreated, resp1.StatusCode)

	// Unfavorite.
	req2, _ := http.NewRequest(http.MethodDelete, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req2.Header.Set("Authorization", authHeader(userID, userEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusNoContent, resp2.StatusCode)

	// Verify favorite is removed.
	var count int64
	testDB.Model(&models.StartupFavorite{}).Where("user_id = ? AND startup_id = ?", userID, startupID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func TestUnfavoriteStartup_Unauthorized(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-unbm2", "owner@unbm2.io", "Unauth Unfavorite Test", "https://unbm2.io")

	// No auth header.
	req, _ := http.NewRequest(http.MethodDelete, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestUnfavoriteStartup_Idempotent(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-unbm3", "owner@unbm3.io", "Idempotent Unfavorite Test", "https://unbm3.io")

	const userID = "unfavorite-user-idempotent"
	const userEmail = "unfavoriter-idem@test.io"
	createTestUser(t, userID, userEmail)

	// Unfavorite without ever favoriting — should still return 204.
	req, _ := http.NewRequest(http.MethodDelete, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	req.Header.Set("Authorization", authHeader(userID, userEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
}

func TestGetStartup_IsFavoritedField(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-isbm", "owner@isbm.io", "IsFavorited Field Test", "https://isbm.io")

	const userID = "isfavorited-user"
	const userEmail = "isfavorited@test.io"
	createTestUser(t, userID, userEmail)

	// Get startup without favoriting — is_favorited should be false.
	req1, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+startupID, nil)
	req1.Header.Set("Authorization", authHeader(userID, userEmail))
	resp1, err := http.DefaultClient.Do(req1)
	require.NoError(t, err)
	defer resp1.Body.Close()
	require.Equal(t, http.StatusOK, resp1.StatusCode)

	var body1 map[string]any
	require.NoError(t, json.NewDecoder(resp1.Body).Decode(&body1))
	assert.Equal(t, false, body1["is_favorited"])

	// Now favorite.
	reqFav, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/bookmark", nil)
	reqFav.Header.Set("Authorization", authHeader(userID, userEmail))
	respFav, _ := http.DefaultClient.Do(reqFav)
	respFav.Body.Close()
	require.Equal(t, http.StatusCreated, respFav.StatusCode)

	// Get startup again — is_favorited should be true.
	req2, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+startupID, nil)
	req2.Header.Set("Authorization", authHeader(userID, userEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()
	require.Equal(t, http.StatusOK, resp2.StatusCode)

	var body2 map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&body2))
	assert.Equal(t, true, body2["is_favorited"])
}

func TestListStartups_FavoritedFilter(t *testing.T) {
	truncateTables(t)

	// Create two startups.
	startup1ID := createTestStartup(t, "startup-owner-list1", "owner@list1.io", "List Startup One", "https://list1.io")
	startup2ID := createTestStartup(t, "startup-owner-list2", "owner@list2.io", "List Startup Two", "https://list2.io")

	const userID = "list-favorited-user"
	const userEmail = "list-favorited@test.io"
	createTestUser(t, userID, userEmail)

	// Favorite only the first startup.
	reqFav, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startup1ID+"/bookmark", nil)
	reqFav.Header.Set("Authorization", authHeader(userID, userEmail))
	respFav, _ := http.DefaultClient.Do(reqFav)
	respFav.Body.Close()
	require.Equal(t, http.StatusCreated, respFav.StatusCode)

	// List all startups (no filter).
	reqAll, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups", nil)
	reqAll.Header.Set("Authorization", authHeader(userID, userEmail))
	respAll, err := http.DefaultClient.Do(reqAll)
	require.NoError(t, err)
	defer respAll.Body.Close()
	require.Equal(t, http.StatusOK, respAll.StatusCode)

	var allStartups []map[string]any
	require.NoError(t, json.NewDecoder(respAll.Body).Decode(&allStartups))
	assert.Len(t, allStartups, 2)

	// List only favorited startups.
	reqFavorited, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups?favorited=true", nil)
	reqFavorited.Header.Set("Authorization", authHeader(userID, userEmail))
	respFavorited, err := http.DefaultClient.Do(reqFavorited)
	require.NoError(t, err)
	defer respFavorited.Body.Close()
	require.Equal(t, http.StatusOK, respFavorited.StatusCode)

	var favoritedStartups []map[string]any
	require.NoError(t, json.NewDecoder(respFavorited.Body).Decode(&favoritedStartups))
	assert.Len(t, favoritedStartups, 1)
	assert.Equal(t, startup1ID, favoritedStartups[0]["id"])
	assert.Equal(t, true, favoritedStartups[0]["is_favorited"])

	// Verify the second startup is not in the favorited list.
	for _, s := range favoritedStartups {
		assert.NotEqual(t, startup2ID, s["id"])
	}
}

func TestListStartups_FavoritedFilter_Unauthorized(t *testing.T) {
	truncateTables(t)

	// No auth header with favorited filter — should return 401.
	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups?favorited=true", nil)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
