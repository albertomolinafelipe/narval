//go:build integration

package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/narval/server/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBoostStartup_Success(t *testing.T) {
	truncateTables(t)

	// Create a startup to boost.
	startupID := createTestStartup(t, "startup-owner-boost1", "owner@boost1.io", "Boost Test Startup", "https://boost1.io")

	// Create a user who will boost it.
	const userID = "boost-user-1"
	const userEmail = "booster@test.io"
	createTestUser(t, userID, userEmail)

	// Boost the startup.
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
	req.Header.Set("Authorization", authHeader(userID, userEmail))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Equal(t, "startup boosted", body["message"])

	// Verify boost exists in DB and expires after the configured lifetime.
	var boost models.StartupBoost
	err = testDB.Where("user_id = ? AND startup_id = ?", userID, startupID).First(&boost).Error
	require.NoError(t, err)
	assert.Equal(t, userID, boost.UserID)
	assert.Equal(t, startupID, boost.StartupID)

	expectedExpiry := time.Now().Add(models.BoostLifetime)
	assert.WithinDuration(t, expectedExpiry, boost.ExpiresAt, 5*time.Second)
}

func TestBoostStartup_AlreadyBoosted(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-boost2", "owner@boost2.io", "Already Boosted Startup", "https://boost2.io")

	const userID = "boost-user-2"
	const userEmail = "booster2@test.io"
	createTestUser(t, userID, userEmail)

	// Boost once.
	req1, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
	req1.Header.Set("Authorization", authHeader(userID, userEmail))
	resp1, _ := http.DefaultClient.Do(req1)
	resp1.Body.Close()
	require.Equal(t, http.StatusCreated, resp1.StatusCode)

	// Try to boost again - should get 409 Conflict.
	req2, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
	req2.Header.Set("Authorization", authHeader(userID, userEmail))
	resp2, err := http.DefaultClient.Do(req2)
	require.NoError(t, err)
	defer resp2.Body.Close()

	assert.Equal(t, http.StatusConflict, resp2.StatusCode)

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp2.Body).Decode(&body))
	assert.Equal(t, "ALREADY_BOOSTED", body["code"])
}

func TestBoostStartup_Unauthorized(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-boost3", "owner@boost3.io", "Unauth Boost Startup", "https://boost3.io")

	// Try to boost without auth.
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestBoostStartup_NotFound(t *testing.T) {
	truncateTables(t)

	const userID = "boost-user-notfound"
	const userEmail = "boosternotfound@test.io"
	createTestUser(t, userID, userEmail)

	// Try to boost non-existent startup.
	fakeID := "00000000-0000-0000-0000-000000000000"
	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+fakeID+"/boost", nil)
	req.Header.Set("Authorization", authHeader(userID, userEmail))
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestStartupDetail_BoostCount(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-boost4", "owner@boost4.io", "Count Boost Startup", "https://boost4.io")

	// Create multiple users and have them boost.
	user1ID := "boost-count-user-1"
	user2ID := "boost-count-user-2"
	user3ID := "boost-count-user-3"
	createTestUser(t, user1ID, "boostcount1@test.io")
	createTestUser(t, user2ID, "boostcount2@test.io")
	createTestUser(t, user3ID, "boostcount3@test.io")

	// Boost from 3 users.
	for _, uid := range []string{user1ID, user2ID, user3ID} {
		req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
		req.Header.Set("Authorization", authHeader(uid, "test@test.io"))
		resp, _ := http.DefaultClient.Do(req)
		resp.Body.Close()
		require.Equal(t, http.StatusCreated, resp.StatusCode)
	}

	// Get startup detail - should show boost_count = 3.
	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+startupID, nil)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	var body map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

	// boost_count should be present and equal to 3
	assert.NotNil(t, body["boost_count"])
	assert.Equal(t, float64(3), body["boost_count"])
}

func TestStartupDetail_HasBoosted(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-boost5", "owner@boost5.io", "Has Boosted Startup", "https://boost5.io")

	const userID = "has-boosted-user"
	const userEmail = "hasboosted@test.io"
	createTestUser(t, userID, userEmail)

	// Initially, has_boosted should be false.
	req1, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+startupID, nil)
	req1.Header.Set("Authorization", authHeader(userID, userEmail))
	resp1, err := http.DefaultClient.Do(req1)
	require.NoError(t, err)
	defer resp1.Body.Close()

	var body1 map[string]any
	require.NoError(t, json.NewDecoder(resp1.Body).Decode(&body1))
	assert.Equal(t, false, body1["has_boosted"])

	// Boost the startup.
	req2, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startupID+"/boost", nil)
	req2.Header.Set("Authorization", authHeader(userID, userEmail))
	resp2, _ := http.DefaultClient.Do(req2)
	resp2.Body.Close()

	// Now has_boosted should be true.
	req3, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups/"+startupID, nil)
	req3.Header.Set("Authorization", authHeader(userID, userEmail))
	resp3, err := http.DefaultClient.Do(req3)
	require.NoError(t, err)
	defer resp3.Body.Close()

	var body2 map[string]any
	require.NoError(t, json.NewDecoder(resp3.Body).Decode(&body2))
	assert.Equal(t, true, body2["has_boosted"])
}

func TestBoostCleanup_ExpiredBoosts(t *testing.T) {
	truncateTables(t)

	startupID := createTestStartup(t, "startup-owner-boost6", "owner@boost6.io", "Cleanup Boost Startup", "https://boost6.io")

	const userID = "cleanup-user"
	const userEmail = "cleanup@test.io"
	createTestUser(t, userID, userEmail)

	// Create a boost manually with an expired timestamp.
	expiredBoost := models.StartupBoost{
		UserID:    userID,
		StartupID: startupID,
		ExpiresAt: time.Now().Add(-1 * time.Hour), // Expired 1 hour ago.
	}
	require.NoError(t, testDB.Create(&expiredBoost).Error)

	// Verify boost exists.
	var countBefore int64
	testDB.Model(&models.StartupBoost{}).Where("user_id = ? AND startup_id = ?", userID, startupID).Count(&countBefore)
	assert.Equal(t, int64(1), countBefore)

	// Manually trigger cleanup (simulating the cron job).
	result := testDB.Where("expires_at < ?", time.Now()).Delete(&models.StartupBoost{})
	require.NoError(t, result.Error)
	assert.Equal(t, int64(1), result.RowsAffected)

	// Verify boost was deleted.
	var countAfter int64
	testDB.Model(&models.StartupBoost{}).Where("user_id = ? AND startup_id = ?", userID, startupID).Count(&countAfter)
	assert.Equal(t, int64(0), countAfter)
}

func TestListStartups_BoostCounts(t *testing.T) {
	truncateTables(t)

	// Create multiple startups.
	startup1ID := createTestStartup(t, "owner1", "owner1@test.io", "Startup One", "https://one.io")
	startup2ID := createTestStartup(t, "owner2", "owner2@test.io", "Startup Two", "https://two.io")

	// Create users and boost.
	user1ID := "list-user-1"
	user2ID := "list-user-2"
	createTestUser(t, user1ID, "listuser1@test.io")
	createTestUser(t, user2ID, "listuser2@test.io")

	// Boost startup1 twice, startup2 once.
	for _, uid := range []string{user1ID, user2ID} {
		req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startup1ID+"/boost", nil)
		req.Header.Set("Authorization", authHeader(uid, "test@test.io"))
		resp, _ := http.DefaultClient.Do(req)
		resp.Body.Close()
	}

	req, _ := http.NewRequest(http.MethodPost, testServer.URL+"/api/v1/startups/"+startup2ID+"/boost", nil)
	req.Header.Set("Authorization", authHeader(user1ID, "test@test.io"))
	resp, _ := http.DefaultClient.Do(req)
	resp.Body.Close()

	// List startups.
	reqList, _ := http.NewRequest(http.MethodGet, testServer.URL+"/api/v1/startups", nil)
	respList, err := http.DefaultClient.Do(reqList)
	require.NoError(t, err)
	defer respList.Body.Close()

	var startups []map[string]any
	require.NoError(t, json.NewDecoder(respList.Body).Decode(&startups))

	// Find the startups and check boost counts.
	for _, s := range startups {
		if s["id"] == startup1ID {
			assert.Equal(t, float64(2), s["boost_count"])
		}
		if s["id"] == startup2ID {
			assert.Equal(t, float64(1), s["boost_count"])
		}
	}
}
