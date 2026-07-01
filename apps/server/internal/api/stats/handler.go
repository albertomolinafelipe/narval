package stats

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/narval/server/models"
)

// Handler serves aggregate directory counts.
type Handler struct {
	db *gorm.DB
}

// NewHandler creates a new stats handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{db: db}
}

// GetStats returns public directory counts (startups + users).
func (h *Handler) GetStats(c *gin.Context) {
	var totalStartups, publishedStartups, verifiedStartups, totalUsers int64

	h.db.Model(&models.Startup{}).Count(&totalStartups)
	h.db.Model(&models.Startup{}).Where("profile_setup = ?", true).Count(&publishedStartups)
	h.db.Model(&models.Startup{}).Where("verified = ?", true).Count(&verifiedStartups)
	h.db.Model(&models.User{}).Count(&totalUsers)

	c.JSON(http.StatusOK, gin.H{
		"total_startups":     totalStartups,
		"published_startups": publishedStartups,
		"verified_startups":  verifiedStartups,
		"total_users":        totalUsers,
	})
}
