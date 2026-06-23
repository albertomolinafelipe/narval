package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/redis/go-redis/v9"
	"github.com/supertokens/supertokens-golang/supertokens"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/auth"
	"github.com/narval/server/internal/api/health"
	"github.com/narval/server/internal/api/startups"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/internal/storage"
)

// StorageClient is the router-level interface for blob storage.
// It embeds storage.Interface so handlers and tests can use it.
type StorageClient interface {
	storage.Interface
}

// server combines all handler groups and implements ServerInterface.
type server struct {
	auth     *auth.Handler
	health   *health.Handler
	startups *startups.Handler
}

func (s *server) Login(c *gin.Context)        { s.auth.Login(c) }
func (s *server) Register(c *gin.Context)     { s.auth.Register(c) }
func (s *server) Verify(c *gin.Context)       { s.auth.Verify(c) }
func (s *server) Logout(c *gin.Context)       { s.auth.Logout(c) }
func (s *server) RefreshToken(c *gin.Context) { s.auth.Refresh(c) }
func (s *server) GetMe(c *gin.Context)        { s.auth.GetMe(c) }
func (s *server) GetHealth(c *gin.Context)    { s.health.GetHealth(c) }

func (s *server) ListStartups(c *gin.Context)  { s.startups.ListStartups(c) }
func (s *server) CreateStartup(c *gin.Context) { s.startups.CreateStartup(c) }
func (s *server) GetStartup(c *gin.Context, id openapi_types.UUID) {
	s.startups.GetStartup(c, id)
}
func (s *server) CheckStartupWebsite(c *gin.Context, params CheckStartupWebsiteParams) {
	s.startups.CheckStartupWebsite(c)
}
func (s *server) UpdateStartup(c *gin.Context, id openapi_types.UUID) {
	s.startups.UpdateStartup(c, id)
}
func (s *server) UploadStartupLogo(c *gin.Context, id openapi_types.UUID) {
	s.startups.UploadStartupLogo(c, id)
}
func (s *server) UploadStartupBanner(c *gin.Context, id openapi_types.UUID) {
	s.startups.UploadStartupBanner(c, id)
}
func (s *server) DeleteStartupLogo(c *gin.Context, id openapi_types.UUID) {
	s.startups.DeleteStartupLogo(c, id)
}
func (s *server) DeleteStartupBanner(c *gin.Context, id openapi_types.UUID) {
	s.startups.DeleteStartupBanner(c, id)
}
func (s *server) FavoriteStartup(c *gin.Context, id openapi_types.UUID) {
	s.startups.FavoriteStartup(c, id)
}
func (s *server) UnfavoriteStartup(c *gin.Context, id openapi_types.UUID) {
	s.startups.UnfavoriteStartup(c, id)
}
func (s *server) BoostStartup(c *gin.Context, id openapi_types.UUID) {
	s.startups.BoostStartup(c, id)
}

func NewRouter(cfg *config.Config, db *gorm.DB, store StorageClient, rdb *redis.Client) *gin.Engine {
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// CORS — must be registered before routes so OPTIONS preflight is handled.
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "anti-csrf", "rid", "fdi-version", "st-auth-mode"},
		ExposeHeaders:    []string{"Content-Length", "front-token", "id-refresh-token", "anti-csrf", "st-access-token", "st-refresh-token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// SuperTokens middleware - handles SuperTokens routes automatically
	r.Use(func(c *gin.Context) {
		supertokens.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c.Next()
		})).ServeHTTP(c.Writer, c.Request)
	})

	authMiddleware := middleware.Auth(cfg)
	optionalAuthMiddleware := middleware.OptionalAuth(cfg)

	v1 := r.Group("/api/v1")

	srv := &server{
		auth:     auth.NewHandler(cfg, db, rdb),
		health:   &health.Handler{},
		startups: startups.NewHandler(db, store),
	}

	RegisterHandlersWithOptions(v1, srv, GinServerOptions{
		Middlewares: []MiddlewareFunc{
			// Apply optional auth to all routes first (extracts user if token present).
			func(c *gin.Context) {
				optionalAuthMiddleware(c)
			},
			// Routes that have BearerAuthScopes set by the wrapper need strict auth.
			func(c *gin.Context) {
				if _, exists := c.Get(BearerAuthScopes); exists {
					authMiddleware(c)
				}
			},
		},
	})

	// Founder photo upload (not in OpenAPI spec — returns {url} for client to store in founders JSON)
	v1.POST("/startups/:id/founder-photo", authMiddleware, srv.startups.UploadFounderPhoto)

	// TODO: Test endpoint for SuperTokens - need to query SuperTokens DB for codes
	// SuperTokens stores codes in its own database, not in RegistrationDraft
	// For now, tests will need to use actual email or mock SuperTokens API

	return r
}
