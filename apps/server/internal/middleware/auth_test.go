package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/middleware"
)

func TestAuth_MissingHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "development"}

	w := httptest.NewRecorder()
	r, _ := gin.CreateTestContext(w)
	r.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	middleware.Auth(cfg)(r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_DevToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{Env: "test"}

	w := httptest.NewRecorder()
	c, engine := gin.CreateTestContext(w)

	var capturedID, capturedEmail string
	engine.GET("/test", middleware.Auth(cfg), func(ctx *gin.Context) {
		capturedID = middleware.GetUserID(ctx)
		capturedEmail = middleware.GetUserEmail(ctx)
		ctx.Status(http.StatusOK)
	})

	c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
	c.Request.Header.Set("Authorization", "Bearer dev:user-123:test@narval.io")
	engine.ServeHTTP(w, c.Request)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user-123", capturedID)
	assert.Equal(t, "test@narval.io", capturedEmail)
}
