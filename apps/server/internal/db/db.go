package db

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/narval/server/internal/config"
	"github.com/narval/server/models"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	return db, nil
}

// Migrate runs auto-migrations for all models.
// Add new models here as they are created.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Startup{},
		&models.RegistrationDraft{},
		&models.StartupFavorite{},
		&models.StartupBoost{},
		&models.DomainVerification{},
		&models.InstagramVerification{},
	)
}
