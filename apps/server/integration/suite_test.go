//go:build integration

package integration_test

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/narval/server/internal/api"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/db"
	"github.com/narval/server/internal/testutil"
	"github.com/redis/go-redis/v9"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Package-level globals shared by all integration tests.
var (
	testServer *httptest.Server
	testDB     *gorm.DB
	testRDB    *redis.Client
)

// adminEmail is whitelisted via cfg.AdminEmails so tests can exercise
// adminAuth routes.
const adminEmail = "admin@narval.test"

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	ctx := context.Background()

	// ── Start Postgres container ───────────────────────────────────────────
	pgContainer, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("narval_test"),
		tcpostgres.WithUsername("narval"),
		tcpostgres.WithPassword("narval"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to start postgres container: %v\n", err)
		os.Exit(1)
	}
	defer pgContainer.Terminate(ctx) //nolint:errcheck

	dsn, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get postgres DSN: %v\n", err)
		os.Exit(1)
	}

	// ── Start Redis container ──────────────────────────────────────────────
	redisContainer, err := tcredis.Run(ctx, "redis:7-alpine")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to start redis container: %v\n", err)
		os.Exit(1)
	}
	defer redisContainer.Terminate(ctx) //nolint:errcheck

	redisURL, err := redisContainer.ConnectionString(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get redis address: %v\n", err)
		os.Exit(1)
	}
	// ConnectionString returns "redis://host:port" but go-redis Addr expects "host:port".
	redisAddr := strings.TrimPrefix(redisURL, "redis://")

	// ── Wire up dependencies ───────────────────────────────────────────────
	testDB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to connect to postgres: %v\n", err)
		os.Exit(1)
	}

	// Same migration set as production startup, so the schema can't drift.
	if err := db.Migrate(testDB); err != nil {
		fmt.Fprintf(os.Stderr, "failed to run migrations: %v\n", err)
		os.Exit(1)
	}

	testRDB = redis.NewClient(&redis.Options{Addr: redisAddr})
	if err := testRDB.Ping(ctx).Err(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to ping redis: %v\n", err)
		os.Exit(1)
	}

	cfg := &config.Config{
		Env:         "test",
		CORSOrigins: []string{"*"},
		AdminEmails: []string{adminEmail},
	}

	router := api.NewRouter(cfg, testDB, &testutil.FakeStorage{}, testRDB)
	testServer = httptest.NewServer(router)
	defer testServer.Close()

	os.Exit(m.Run())
}

// truncateTables clears all data rows between tests for isolation.
func truncateTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		tables := []string{"startup_boosts", "startup_favorites", "registration_drafts", "domain_verifications", "instagram_verifications", "startups", "users"}
		for _, tbl := range tables {
			if err := testDB.Exec("TRUNCATE TABLE " + tbl + " CASCADE").Error; err != nil {
				t.Logf("warning: truncate %s: %v", tbl, err)
			}
		}
		// Also flush Redis.
		testRDB.FlushDB(context.Background()) //nolint:errcheck
	})
}

// authHeader returns the dev bypass Authorization header for the given user.
func authHeader(userID, email string) string {
	return fmt.Sprintf("Bearer dev:%s:%s", userID, email)
}
