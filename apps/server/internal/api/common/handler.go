package common

import (
	"context"
	"log"
	"strings"

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

// DeleteOwnedImage best-effort removes the blob behind a stored image URL, but
// only when the URL is one of ours (under our storage base) and the object is
// filed under the given startup's id. Failures are logged, never returned, so
// orphan cleanup can never break the request that triggered it. Call it only
// after the DB reference has been dropped, so a live image is never deleted.
func (h *BaseHandler) DeleteOwnedImage(ctx context.Context, startupID, imageURL string) {
	if imageURL == "" {
		return
	}
	name, ok := h.Storage.ObjectNameFromURL(imageURL)
	if !ok {
		return
	}
	// Guard: only touch objects filed under this startup's id (e.g.
	// logos/<id>/...), so a stray URL can't delete another startup's image.
	if !strings.Contains(name, "/"+startupID+"/") {
		return
	}
	if err := h.Storage.Delete(ctx, name); err != nil {
		h.Logger.Printf("orphan cleanup: failed to delete %s: %v", name, err)
	}
}
