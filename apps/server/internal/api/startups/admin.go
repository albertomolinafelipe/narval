package startups

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/common"
	"github.com/narval/server/internal/api/gen"
	"github.com/narval/server/internal/logging"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/models"
)

// newClaimToken returns an unguessable, URL-safe bearer token for a claim link.
func newClaimToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// CreateAdminStartup lets a whitelisted admin seed an unclaimed shell owned by
// the admin (the adminAuth middleware has already checked the whitelist). The
// admin then fills it in via the normal edit page and hands the claim link to
// the startup. Skips the public one-per-owner / account-type / website rules —
// those only apply to real self-service registrations.
func (h *Handler) CreateAdminStartup(c *gin.Context) {
	var req gen.CreateAdminStartupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	token, err := newClaimToken()
	if err != nil {
		logging.From(c).Error("CreateAdminStartup: token generation failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create shell"})
		return
	}

	// Owner is the admin's DB user id so the existing owner-gated edit handlers
	// accept them until the startup claims it.
	s := models.Startup{
		Name:       req.Name,
		OwnerID:    middleware.GetDBUserID(c),
		OwnerEmail: middleware.GetUserEmail(c),
		Claimed:    false,
		ClaimToken: token,
	}
	if err := h.DB.Create(&s).Error; err != nil {
		if common.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"code": "CONFLICT", "message": "startup name already taken"})
			return
		}
		logging.From(c).Error("CreateAdminStartup: db create failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to create shell"})
		return
	}

	id, _ := uuid.Parse(s.ID)
	c.JSON(http.StatusCreated, gen.CreateAdminStartupResponse{
		Id:         id,
		Name:       s.Name,
		ClaimToken: s.ClaimToken,
	})
}

// GetClaimLink returns the claim token for an unclaimed shell, to its owner only.
// The admin uses it to (re)copy the claim link from the edit page. A claimed
// profile returns an empty token.
func (h *Handler) GetClaimLink(c *gin.Context, id openapi_types.UUID) {
	var st models.Startup
	if err := h.DB.Where("id = ?", id.String()).First(&st).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}
	if st.OwnerID != middleware.GetDBUserID(c) {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "not the owner"})
		return
	}

	c.JSON(http.StatusOK, gen.ClaimLinkResponse{
		Claimed:    st.Claimed,
		ClaimToken: st.ClaimToken,
	})
}

// GetClaimStartup returns an unclaimed shell by its claim token so the public
// claim page can preview the profile. The token itself is the capability, so no
// session is required.
func (h *Handler) GetClaimStartup(c *gin.Context, token string) {
	var st models.Startup
	if err := h.DB.Where("claim_token = ? AND claimed = ?", token, false).First(&st).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "no unclaimed startup for this link"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}
	c.JSON(http.StatusOK, h.startupResponse(c, st))
}
