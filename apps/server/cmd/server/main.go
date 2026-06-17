package main

import (
	"log"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api"
	"github.com/narval/server/internal/cache"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/db"
	"github.com/narval/server/internal/storage"
	"github.com/narval/server/internal/supertokens"
	"github.com/narval/server/models"
)

func main() {
	// Load .env if present (dev convenience)
	// In production env vars are injected directly
	_ = godotenv.Load()

	cfg := config.Load()

	// Validate configuration - fails fast in production if secrets are missing/insecure
	if err := cfg.Validate(); err != nil {
		log.Fatalf("configuration error: %v", err)
	}

	// Initialize SuperTokens
	if err := supertokens.Init(cfg); err != nil {
		log.Fatalf("failed to initialize SuperTokens: %v", err)
	}

	database, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	if err := db.Migrate(database); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	store, err := storage.New(cfg)
	if err != nil {
		log.Fatalf("failed to connect to storage: %v", err)
	}

	rdb, err := cache.New(cfg)
	if err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}

	// Background goroutine: purge expired registration drafts every hour.
	go runDraftCleanup(database)

	// Background goroutine: purge expired boosts every hour.
	go runBoostCleanup(database)

	router := api.NewRouter(cfg, database, store, rdb)

	log.Printf("server starting on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// runDraftCleanup deletes RegistrationDraft rows older than 7 days.
// SuperTokens handles OTP expiry (10 minutes), so we only need to clean up abandoned drafts.
// It runs once immediately on startup, then every hour thereafter.
func runDraftCleanup(database *gorm.DB) {
	logger := log.New(log.Writer(), "draft-cleanup: ", log.LstdFlags)
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	cleanup := func() {
		cutoff := time.Now().Add(-7 * 24 * time.Hour) // 7 days ago
		result := database.Where("created_at < ?", cutoff).Delete(&models.RegistrationDraft{})
		if result.Error != nil {
			logger.Printf("error purging old drafts: %v", result.Error)
		} else if result.RowsAffected > 0 {
			logger.Printf("purged %d old registration draft(s)", result.RowsAffected)
		}
	}

	cleanup() // run once at startup
	for range ticker.C {
		cleanup()
	}
}

// runBoostCleanup deletes StartupBoost rows whose expires_at is in the past.
// It runs once immediately on startup, then every hour thereafter.
func runBoostCleanup(database *gorm.DB) {
	logger := log.New(log.Writer(), "boost-cleanup: ", log.LstdFlags)
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()

	cleanup := func() {
		result := database.Where("expires_at < ?", time.Now()).Delete(&models.StartupBoost{})
		if result.Error != nil {
			logger.Printf("error purging expired boosts: %v", result.Error)
		} else if result.RowsAffected > 0 {
			logger.Printf("purged %d expired boost(s)", result.RowsAffected)
		}
	}

	cleanup() // run once at startup
	for range ticker.C {
		cleanup()
	}
}
