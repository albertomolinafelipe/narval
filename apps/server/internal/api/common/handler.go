package common

import (
	"log"

	"gorm.io/gorm"

	"github.com/narval/server/internal/storage"
)

// BaseHandler contains the common dependencies shared by all API handlers.
type BaseHandler struct {
	DB      *gorm.DB
	Storage storage.Interface
	Logger  *log.Logger
}

// NewBaseHandler creates a new base handler with common dependencies.
func NewBaseHandler(db *gorm.DB, storage storage.Interface, logger *log.Logger) *BaseHandler {
	return &BaseHandler{
		DB:      db,
		Storage: storage,
		Logger:  logger,
	}
}
