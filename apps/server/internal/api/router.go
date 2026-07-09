package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/redis/go-redis/v9"
	"github.com/supertokens/supertokens-golang/supertokens"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/auth"
	"github.com/narval/server/internal/api/gen"
	"github.com/narval/server/internal/api/health"
	"github.com/narval/server/internal/api/startups"
	"github.com/narval/server/internal/api/stats"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/email"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/internal/storage"
)

// StorageClient is the router-level interface for blob storage.
// It embeds storage.Interface so handlers and tests can use it.
type StorageClient interface {
	storage.Interface
}

// server combines all handler groups and implements gen.ServerInterface.
type server struct {
	auth     *auth.Handler
	health   *health.Handler
	startups *startups.Handler
	stats    *stats.Handler
}

func (s *server) Login(c *gin.Context)      { s.auth.Login(c) }
func (s *server) Register(c *gin.Context)   { s.auth.Register(c) }
func (s *server) Verify(c *gin.Context)     { s.auth.Verify(c) }
func (s *server) Logout(c *gin.Context)     { s.auth.Logout(c) }
func (s *server) GetMe(c *gin.Context)      { s.auth.GetMe(c) }
func (s *server) StartClaim(c *gin.Context) { s.auth.StartClaim(c) }
func (s *server) GetHealth(c *gin.Context)  { s.health.GetHealth(c) }
func (s *server) GetStats(c *gin.Context)   { s.stats.GetStats(c) }

func (s *server) ListStartups(c *gin.Context, params gen.ListStartupsParams) {
	s.startups.ListStartups(c, params)
}
func (s *server) CreateStartup(c *gin.Context) { s.startups.CreateStartup(c) }
func (s *server) GetStartup(c *gin.Context, id string) {
	s.startups.GetStartup(c, id)
}
func (s *server) CheckStartupWebsite(c *gin.Context, params gen.CheckStartupWebsiteParams) {
	s.startups.CheckStartupWebsite(c, params)
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
func (s *server) UploadFounderPhoto(c *gin.Context, id openapi_types.UUID) {
	s.startups.UploadFounderPhoto(c, id)
}
func (s *server) UploadStartupScreenshot(c *gin.Context, id openapi_types.UUID) {
	s.startups.UploadStartupScreenshot(c, id)
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
func (s *server) StartDomainVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.StartDomainVerification(c, id)
}
func (s *server) ConfirmDomainVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.ConfirmDomainVerification(c, id)
}
func (s *server) StartInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.StartInstagramVerification(c, id)
}
func (s *server) GetInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.GetInstagramVerification(c, id)
}
func (s *server) ListInstagramVerifications(c *gin.Context, params gen.ListInstagramVerificationsParams) {
	status := ""
	if params.Status != nil {
		status = string(*params.Status)
	}
	s.startups.ListInstagramVerifications(c, status)
}
func (s *server) ConfirmInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.ConfirmInstagramVerification(c, id)
}
func (s *server) ResetInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	s.startups.ResetInstagramVerification(c, id)
}

func (s *server) CreateAdminStartup(c *gin.Context) { s.startups.CreateAdminStartup(c) }
func (s *server) GetClaimLink(c *gin.Context, id openapi_types.UUID) {
	s.startups.GetClaimLink(c, id)
}
func (s *server) GetClaimStartup(c *gin.Context, token string) {
	s.startups.GetClaimStartup(c, token)
}

// requestValidator validates every request against the embedded OpenAPI spec:
// body shape, enums, string lengths, required params. Handlers can trust that
// a bound request satisfies its schema.
func requestValidator() gen.MiddlewareFunc {
	spec, err := gen.GetSwagger()
	if err != nil {
		panic(fmt.Sprintf("api: loading embedded OpenAPI spec: %v", err))
	}
	// Match on the path prefix only; the spec's servers entry carries a host
	// that would otherwise have to match the request's Host header.
	spec.Servers = openapi3.Servers{&openapi3.Server{URL: "/api/v1"}}

	return gen.MiddlewareFunc(ginmiddleware.OapiRequestValidatorWithOptions(spec, &ginmiddleware.Options{
		Options: openapi3filter.Options{
			// Auth (sessions + admin whitelist) is enforced by the middlewares
			// above, not by the validator.
			AuthenticationFunc: openapi3filter.NoopAuthenticationFunc,
		},
		ErrorHandler: func(c *gin.Context, message string, statusCode int) {
			c.AbortWithStatusJSON(statusCode, gin.H{"code": "BAD_REQUEST", "message": message})
		},
	}))
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

	// SuperTokens middleware - handles SuperTokens routes automatically.
	// Skipped in the test env: integration tests never call supertokens.Init and
	// authenticate via the dev bearer shortcut in middleware.Auth instead.
	if cfg.Env != "test" {
		r.Use(func(c *gin.Context) {
			supertokens.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				c.Next()
			})).ServeHTTP(c.Writer, c.Request)
		})
	}

	authMiddleware := middleware.Auth(cfg)
	optionalAuthMiddleware := middleware.OptionalAuth(cfg)
	adminMiddleware := middleware.RequireAdmin(cfg.AdminEmails)

	v1 := r.Group("/api/v1")

	srv := &server{
		auth:     auth.NewHandler(cfg, db, rdb),
		health:   &health.Handler{},
		startups: startups.NewHandler(db, store, email.New(cfg)),
		stats:    stats.NewHandler(db),
	}

	gen.RegisterHandlersWithOptions(v1, srv, gen.GinServerOptions{
		Middlewares: []gen.MiddlewareFunc{
			// Apply optional auth to all routes first (extracts user if a session is present).
			func(c *gin.Context) {
				optionalAuthMiddleware(c)
			},
			// Routes with a security requirement (bearerAuth or adminAuth scopes
			// set by the generated wrapper) need strict auth.
			func(c *gin.Context) {
				_, needsAuth := c.Get(gen.BearerAuthScopes)
				_, needsAdmin := c.Get(gen.AdminAuthScopes)
				if needsAuth || needsAdmin {
					authMiddleware(c)
				}
			},
			// adminAuth routes additionally require the whitelist.
			func(c *gin.Context) {
				if _, needsAdmin := c.Get(gen.AdminAuthScopes); needsAdmin {
					adminMiddleware(c)
				}
			},
			// Spec validation runs last so a missing session yields 401 before a
			// malformed body yields 400.
			requestValidator(),
		},
	})

	return r
}
