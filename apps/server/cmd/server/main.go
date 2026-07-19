package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api"
	"github.com/narval/server/internal/cache"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/db"
	"github.com/narval/server/internal/logging"
	"github.com/narval/server/internal/storage"
	"github.com/narval/server/internal/supertokens"
	"github.com/narval/server/models"
)

func main() {
	// Load .env if present (dev convenience)
	// In production env vars are injected directly
	_ = godotenv.Load()

	cfg := config.Load()
	logger := logging.Setup(cfg.Env)

	// Validate configuration - fails fast in production if secrets are missing/insecure
	if err := cfg.Validate(); err != nil {
		logger.Error("configuration error", "err", err)
		os.Exit(1)
	}

	database, err := db.Connect(cfg)
	if err != nil {
		logger.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}

	// Initialize SuperTokens (needs the DB so third-party sign-in can reconcile
	// local accounts).
	if err := supertokens.Init(cfg, database); err != nil {
		logger.Error("failed to initialize SuperTokens", "err", err)
		os.Exit(1)
	}

	if err := db.Migrate(database); err != nil {
		logger.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}

	store, err := storage.New(cfg)
	if err != nil {
		logger.Error("failed to connect to storage", "err", err)
		os.Exit(1)
	}

	rdb, err := cache.New(cfg)
	if err != nil {
		logger.Error("failed to connect to redis", "err", err)
		os.Exit(1)
	}

	// Root context is cancelled on the first SIGINT/SIGTERM, which unblocks the
	// shutdown sequence below and stops the background cleanup goroutines.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Background goroutines: purge expired registration drafts and boosts hourly.
	// Tracked so shutdown waits for an in-progress purge to finish.
	var cleanupWG sync.WaitGroup
	cleanupWG.Add(2)
	go func() { defer cleanupWG.Done(); runDraftCleanup(ctx, database) }()
	go func() { defer cleanupWG.Done(); runBoostCleanup(ctx, database) }()

	router := api.NewRouter(cfg, database, store, rdb)
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: router}

	go func() {
		logger.Info("server starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	stop() // restore default signal handling so a second Ctrl-C force-quits
	logger.Info("shutdown signal received, draining connections")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
	}

	cleanupWG.Wait() // let the cleanup goroutines observe ctx.Done and return
	logger.Info("shutdown complete")
}

// runDraftCleanup deletes RegistrationDraft rows older than 7 days.
// SuperTokens handles OTP expiry (10 minutes), so we only need to clean up abandoned drafts.
// It runs once immediately on startup, then every hour thereafter.
func runDraftCleanup(ctx context.Context, database *gorm.DB) {
	logger := slog.Default().With("component", "draft-cleanup")
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	cleanup := func() {
		cutoff := time.Now().Add(-7 * 24 * time.Hour) // 7 days ago
		result := database.Where("created_at < ?", cutoff).Delete(&models.RegistrationDraft{})
		if result.Error != nil {
			logger.Error("error purging old drafts", "err", result.Error)
		} else if result.RowsAffected > 0 {
			logger.Info("purged old registration drafts", "count", result.RowsAffected)
		}
	}

	cleanup() // run once at startup
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanup()
		}
	}
}

// runBoostCleanup deletes StartupBoost rows whose expires_at is in the past.
// It runs once immediately on startup, then every hour thereafter.
func runBoostCleanup(ctx context.Context, database *gorm.DB) {
	logger := slog.Default().With("component", "boost-cleanup")
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	cleanup := func() {
		result := database.Where("expires_at < ?", time.Now()).Delete(&models.StartupBoost{})
		if result.Error != nil {
			logger.Error("error purging expired boosts", "err", result.Error)
		} else if result.RowsAffected > 0 {
			logger.Info("purged expired boosts", "count", result.RowsAffected)
		}
	}

	cleanup() // run once at startup
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cleanup()
		}
	}
}
