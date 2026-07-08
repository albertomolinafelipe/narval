package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"gorm.io/gorm"

	"github.com/narval/server/internal/config"
	"github.com/narval/server/models"
)

const userIDKey = "userID"
const userEmailKey = "userEmail"
const accountTypeKey = "accountType"
const dbUserIDKey = "dbUserID"

// Auth validates SuperTokens sessions.
// In test environments it also accepts "Bearer dev:<authUserID>:<email>" for automated testing.
// Note: This middleware does NOT call c.Next() because the generated oapi-codegen
// wrapper handles the middleware chain directly.
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Dev shortcut: "dev:<user_id>:<email>" — accepted in test environments only.
		// The id doubles as auth user id and DB user id; tests create users with both
		// set to the same value.
		if cfg.Env == "test" && authHeader != "" && strings.HasPrefix(authHeader, "Bearer dev:") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			parts := strings.SplitN(token, ":", 3)
			if len(parts) == 3 {
				c.Set(userIDKey, parts[1])
				c.Set(dbUserIDKey, parts[1])
				c.Set(userEmailKey, parts[2])
				return
			}
		}

		// Validate SuperTokens session
		sessionContainer, err := session.GetSession(c.Request, c.Writer, nil)

		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "invalid or expired session",
			})
			return
		}

		// Get SuperTokens user ID from session
		authUserID := sessionContainer.GetUserID()

		// Extract user metadata from access token payload
		accessTokenPayload := sessionContainer.GetAccessTokenPayload()

		// Store user context in gin context
		c.Set(userIDKey, authUserID)

		if email, ok := accessTokenPayload["email"].(string); ok {
			c.Set(userEmailKey, email)
		}

		if accountType, ok := accessTokenPayload["account_type"].(string); ok {
			c.Set(accountTypeKey, models.AccountType(accountType))
		}

		if dbUserID, ok := accessTokenPayload["user_id"].(string); ok {
			c.Set(dbUserIDKey, dbUserID)
		}
	}
}

func boolPtr(b bool) *bool {
	return &b
}

func GetUserID(c *gin.Context) string {
	v, _ := c.Get(userIDKey)
	s, _ := v.(string)
	return s
}

func GetUserEmail(c *gin.Context) string {
	v, _ := c.Get(userEmailKey)
	s, _ := v.(string)
	return s
}

func GetDBUserID(c *gin.Context) string {
	v, _ := c.Get(dbUserIDKey)
	s, _ := v.(string)
	return s
}

// OptionalAuth extracts user identity from the SuperTokens session if present,
// but does NOT reject requests without valid auth. This is used for public endpoints
// that want to personalize responses (e.g., is_bookmarked) when a user is logged in.
// Note: This middleware does NOT call c.Next() because the generated oapi-codegen
// wrapper handles the middleware chain directly.
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Dev shortcut: "dev:<user_id>:<email>" — accepted in test environments only.
		if cfg.Env == "test" && authHeader != "" && strings.HasPrefix(authHeader, "Bearer dev:") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			parts := strings.SplitN(token, ":", 3)
			if len(parts) == 3 {
				c.Set(userIDKey, parts[1])
				c.Set(dbUserIDKey, parts[1])
				c.Set(userEmailKey, parts[2])
			}
			return
		}

		// Try to validate SuperTokens session — but don't reject if it fails.
		sessionContainer, err := session.GetSession(c.Request, c.Writer, nil)

		if err != nil || sessionContainer == nil {
			// No valid session — continue without setting user context.
			return
		}

		// Get SuperTokens user ID from session
		authUserID := sessionContainer.GetUserID()
		c.Set(userIDKey, authUserID)

		// Extract user metadata from access token payload
		accessTokenPayload := sessionContainer.GetAccessTokenPayload()

		if email, ok := accessTokenPayload["email"].(string); ok {
			c.Set(userEmailKey, email)
		}

		if accountType, ok := accessTokenPayload["account_type"].(string); ok {
			c.Set(accountTypeKey, models.AccountType(accountType))
		}

		if dbUserID, ok := accessTokenPayload["user_id"].(string); ok {
			c.Set(dbUserIDKey, dbUserID)
		}
	}
}

// GetAccountType returns the account_type for the currently authenticated user.
// It first checks the gin context cache (populated by Auth/OptionalAuth middleware),
// and only falls back to a database lookup if not found. The result is cached on
// the gin context so repeated calls within a single request are free.
func GetAccountType(c *gin.Context, db *gorm.DB) (models.AccountType, error) {
	// Return cached value if already loaded.
	if v, exists := c.Get(accountTypeKey); exists {
		if at, ok := v.(models.AccountType); ok {
			return at, nil
		}
	}

	authUserID := GetUserID(c)
	if authUserID == "" {
		return "", errors.New("no authenticated user")
	}

	// Fallback to DB lookup (should rarely happen if middleware is working correctly)
	var u models.User
	if err := db.Where("auth_user_id = ?", authUserID).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("user not found: %s", authUserID)
		}
		return "", fmt.Errorf("db error looking up account type: %w", err)
	}

	c.Set(accountTypeKey, u.AccountType)
	return u.AccountType, nil
}
