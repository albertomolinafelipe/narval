package startups

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/common"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/internal/storage"
	"github.com/narval/server/models"
)

const maxLogoSize = 5 << 20    // 5 MiB
const maxBannerSize = 10 << 20 // 10 MiB

// Controlled enum values

var validStages = map[string]bool{
	"idea": true, "pre-seed": true, "seed": true,
	"series-a": true, "series-b": true, "growth": true, "profitable": true,
}

var validRounds = map[string]bool{
	"pre-seed": true, "seed": true,
	"series-a": true, "series-b": true, "bridge": true,
}

var validIndustries = map[string]bool{
	"AI/ML": true, "FinTech": true, "HealthTech": true, "Climate Tech": true,
	"EdTech": true, "SaaS": true, "Marketplace": true, "Developer Tools": true,
	"Hardware": true, "Consumer": true, "Deep Tech": true, "Logistics": true,
	"Legal Tech": true, "HR Tech": true, "Other": true,
}

// Handler handles all /startups routes.
type Handler struct {
	*common.BaseHandler
}

// NewHandler creates a new startups handler.
func NewHandler(db *gorm.DB, s storage.Interface) *Handler {
	return &Handler{
		BaseHandler: common.NewBaseHandler(db, s, log.New(log.Writer(), "startups: ", log.LstdFlags)),
	}
}

// NewHandlerWithStorage is an alias used in tests to pass a fake storage client.
func NewHandlerWithStorage(db *gorm.DB, s storage.Interface) *Handler {
	return &Handler{
		BaseHandler: common.NewBaseHandler(db, s, log.New(log.Writer(), "startups: ", log.LstdFlags)),
	}
}

// validateWebsite returns an error if the normalized website is not a valid
// domain (must be non-empty, contain at least one dot, and have a non-empty TLD).
func validateWebsite(raw string) error {
	normalized := common.NormalizeWebsite(raw)
	if normalized == "" {
		return fmt.Errorf("website is required")
	}
	parts := strings.Split(normalized, ".")
	if len(parts) < 2 {
		return fmt.Errorf("website must be a valid domain (e.g. acme.com)")
	}
	for _, p := range parts {
		if p == "" {
			return fmt.Errorf("website must be a valid domain (e.g. acme.com)")
		}
	}
	return nil
}

// CheckStartupWebsite validates a website and returns the normalized form.
func (h *Handler) CheckStartupWebsite(c *gin.Context) {
	urlParam := common.NormalizeWebsite(c.Query("url"))
	var count int64
	h.DB.Model(&models.Startup{}).Where("website = ?", urlParam).Count(&count)
	c.JSON(http.StatusOK, gin.H{"available": count == 0})
}

// GetStartup fetches a single startup by its UUID.
func (h *Handler) GetStartup(c *gin.Context, id openapi_types.UUID) {
	var st models.Startup
	if err := h.DB.First(&st, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}
	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// ListStartups returns all startup accounts.
func (h *Handler) ListStartups(c *gin.Context) {
	// Check for favorited filter
	favoritedParam := c.Query("favorited")
	filterFavorited := favoritedParam == "true"

	var startupList []models.Startup
	query := h.DB.Order("created_at desc")

	// Get current user ID if authenticated
	userID := middleware.GetUserID(c)

	if filterFavorited {
		// Require authentication for favorited filter
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "authentication required for favorited filter"})
			return
		}

		// Join with startup_favorites table to filter only favorited startups
		query = query.Joins("INNER JOIN startup_favorites ON startup_favorites.startup_id = startups.id").
			Where("startup_favorites.user_id = ?", userID)
	}

	// Filter: only show profiles with profile_setup = true
	query = query.Where("profile_setup = ?", true)

	if err := query.Find(&startupList).Error; err != nil {
		h.Logger.Printf("ListStartups: db query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startups"})
		return
	}
	result := make([]interface{}, len(startupList))
	for i, s := range startupList {
		result[i] = h.startupResponse(c, s)
	}
	c.JSON(http.StatusOK, result)
}

// startupRequest holds optional fields for create/update.
type startupRequest struct {
	Name           string  `json:"name"           binding:"omitempty,min=2,max=100"`
	Tagline        *string `json:"tagline"        binding:"omitempty,max=160"`
	Description    *string `json:"description"    binding:"omitempty,max=1000"`
	Website        *string `json:"website"`
	Stage          *string `json:"stage"`
	Industry       *string `json:"industry"`
	TeamSize       *int    `json:"team_size"`
	Location       *string `json:"location"`
	FoundedYear    *int    `json:"founded_year"`
	TechStack      *string `json:"tech_stack"`
	ProductLinks   *string `json:"product_links"`
	Linkedin       *string `json:"linkedin"`
	Twitter        *string `json:"twitter"`
	Github         *string `json:"github"`
	Instagram      *string `json:"instagram"`
	IsRaising      *bool   `json:"is_raising"`
	CurrentRound   *string `json:"current_round"`
	FundingAsk     *string `json:"funding_ask"`
	FundingUse     *string `json:"funding_use"`
	IsHiring       *bool   `json:"is_hiring"`
	OpenRoles      *string `json:"open_roles"`
	ContactGeneral *string `json:"contact_general"`
	ContactFunding *string `json:"contact_funding"`
	ContactTalent  *string `json:"contact_talent"`
	ProfileSetup   *bool   `json:"profile_setup"`
}

// validateStartupRequest checks enum values; returns an error message or "".
func validateStartupRequest(req *startupRequest) string {
	if req.Stage != nil && *req.Stage != "" {
		if !validStages[*req.Stage] {
			return fmt.Sprintf("invalid stage %q", *req.Stage)
		}
	}
	if req.Industry != nil && *req.Industry != "" {
		if !validIndustries[*req.Industry] {
			return fmt.Sprintf("invalid industry %q", *req.Industry)
		}
	}
	if req.CurrentRound != nil && *req.CurrentRound != "" {
		if !validRounds[*req.CurrentRound] {
			return fmt.Sprintf("invalid current_round %q", *req.CurrentRound)
		}
	}
	return ""
}

// CreateStartup registers a new startup for the authenticated user.
func (h *Handler) CreateStartup(c *gin.Context) {
	var req struct {
		startupRequest
		Name string `json:"name" binding:"required,min=2,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	if msg := validateStartupRequest(&req.startupRequest); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": msg})
		return
	}

	ownerID := middleware.GetUserID(c)
	ownerEmail := middleware.GetUserEmail(c)

	// Enforce: only accounts of type "startup" may create a startup profile.
	accountType, err := middleware.GetAccountType(c, h.DB)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "could not verify account type"})
		return
	}
	if accountType != models.AccountTypeStartup {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "only startup accounts can create a startup profile"})
		return
	}

	// Enforce: one profile per owner.
	var existing models.Startup
	if err := h.DB.Where("owner_id = ?", ownerID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"code": "CONFLICT", "message": "startup profile already exists for this account"})
		return
	}

	s := models.Startup{
		Name:       req.Name,
		OwnerID:    ownerID,
		OwnerEmail: ownerEmail,
	}

	// Website is required at registration and must be a valid domain.
	if req.Website == nil || *req.Website == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "website is required"})
		return
	}
	if err := validateWebsite(*req.Website); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	applyStartupFields(&s, &req.startupRequest)

	if err := h.DB.Create(&s).Error; err != nil {
		if common.IsDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"code": "CONFLICT", "message": "startup name already taken"})
			return
		}
		h.Logger.Printf("CreateStartup: db create failed for owner %s: %v", ownerID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to create startup"})
		return
	}

	c.JSON(http.StatusCreated, h.startupResponse(c, s))
}

// UpdateStartup updates the startup profile owned by the authenticated user.
func (h *Handler) UpdateStartup(c *gin.Context, id openapi_types.UUID) {
	startupID := id.String()
	ownerID := middleware.GetDBUserID(c)

	var st models.Startup
	if err := h.DB.First(&st, "id = ?", startupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}

	if st.OwnerID != ownerID {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "not the owner of this startup"})
		return
	}

	var req startupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	if msg := validateStartupRequest(&req); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": msg})
		return
	}

	if req.Name != "" {
		st.Name = req.Name
	}
	if req.Website != nil && *req.Website != "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "website cannot be changed after registration"})
		return
	}
	applyStartupFields(&st, &req)

	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// UploadStartupLogo stores a logo image for the given startup in MinIO.
func (h *Handler) UploadStartupLogo(c *gin.Context, id openapi_types.UUID) {
	startupID := id.String()

	var st models.Startup
	if err := h.DB.First(&st, "id = ?", startupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}

	// Only the owner may upload a logo.
	ownerID := middleware.GetDBUserID(c)
	if st.OwnerID != ownerID {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "not the owner of this startup"})
		return
	}

	file, header, err := c.Request.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "logo file is required"})
		return
	}
	defer file.Close() //nolint:errcheck // best-effort cleanup

	if header.Size > maxLogoSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "logo exceeds 5 MiB limit"})
		return
	}

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		ct = "image/jpeg" // fallback
	}

	objectName := fmt.Sprintf("logos/%s/%s", startupID, header.Filename)

	logoURL, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload logo"})
		return
	}

	st.LogoURL = logoURL
	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// UploadStartupBanner replaces the banner image for the given startup.
func (h *Handler) UploadStartupBanner(c *gin.Context, id openapi_types.UUID) {
	startupID := id.String()

	var st models.Startup
	if err := h.DB.First(&st, "id = ?", startupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}

	ownerID := middleware.GetDBUserID(c)
	if st.OwnerID != ownerID {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "not the owner of this startup"})
		return
	}

	file, header, err := c.Request.FormFile("banner")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "banner file is required"})
		return
	}
	defer file.Close() //nolint:errcheck // best-effort cleanup

	if header.Size > maxBannerSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "banner exceeds 10 MiB limit"})
		return
	}

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		ct = "image/jpeg"
	}

	objectName := fmt.Sprintf("banners/%s/%s", startupID, header.Filename)

	bannerURL, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload banner"})
		return
	}

	st.BannerImage = bannerURL
	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

//  Response helpers

// startupResponse converts a Startup model to the API response.
// If the user is authenticated, it includes bookmark status.
func (h *Handler) startupResponse(c *gin.Context, s models.Startup) map[string]interface{} {
	// Convert to map to add dynamic field
	response := map[string]interface{}{
		"id":              s.ID,
		"name":            s.Name,
		"tagline":         s.Tagline,
		"description":     s.Description,
		"website":         s.Website,
		"logo_url":        s.LogoURL,
		"stage":           s.Stage,
		"industry":        s.Industry,
		"team_size":       s.TeamSize,
		"location":        s.Location,
		"founded_year":    s.FoundedYear,
		"tech_stack":      s.TechStack,
		"banner_image":    s.BannerImage,
		"product_links":   s.ProductLinks,
		"linkedin":        s.Linkedin,
		"twitter":         s.Twitter,
		"github":          s.Github,
		"instagram":       s.Instagram,
		"is_raising":      s.IsRaising,
		"current_round":   s.CurrentRound,
		"funding_ask":     s.FundingAsk,
		"funding_use":     s.FundingUse,
		"is_hiring":       s.IsHiring,
		"open_roles":      s.OpenRoles,
		"contact_general": s.ContactGeneral,
		"contact_funding": s.ContactFunding,
		"contact_talent":  s.ContactTalent,
		"owner_id":        s.OwnerID,
		"owner_email":     s.OwnerEmail,
		"profile_setup":   s.ProfileSetup,
		"created_at":      s.CreatedAt,
		"updated_at":      s.UpdatedAt,
	}

	// Add boost count (always visible)
	boostCount := h.getStartupBoostCount(s.ID)
	response["boost_count"] = boostCount

	// Add favorite status if user is authenticated
	userID := middleware.GetUserID(c)
	if userID != "" {
		isFavorited := h.isStartupFavorited(userID, s.ID)
		response["is_favorited"] = isFavorited

		// Add has_boosted status for authenticated users
		hasBoosted := h.hasUserBoosted(userID, s.ID)
		response["has_boosted"] = hasBoosted
	}

	return response
}

// isStartupFavorited checks if a startup is favorited by the given user.
func (h *Handler) isStartupFavorited(userID, startupID string) bool {
	var count int64
	result := h.DB.Model(&models.StartupFavorite{}).
		Where("user_id = ? AND startup_id = ?", userID, startupID).
		Count(&count)
	if result.Error != nil {
		return false
	}
	return count > 0
}

//  Helpers

// applyStartupFields applies optional pointer fields from a request to a Startup model.
func applyStartupFields(s *models.Startup, req *startupRequest) {
	if req.Tagline != nil {
		s.Tagline = *req.Tagline
	}
	if req.Description != nil {
		s.Description = *req.Description
	}
	if req.Website != nil {
		s.Website = common.NormalizeWebsite(*req.Website)
	}
	if req.Stage != nil {
		s.Stage = *req.Stage
	}
	if req.Industry != nil {
		s.Industry = *req.Industry
	}
	if req.TeamSize != nil {
		s.TeamSize = *req.TeamSize
	}
	if req.Location != nil {
		s.Location = *req.Location
	}
	if req.FoundedYear != nil {
		s.FoundedYear = *req.FoundedYear
	}
	if req.TechStack != nil {
		s.TechStack = *req.TechStack
	}
	if req.ProductLinks != nil {
		s.ProductLinks = *req.ProductLinks
	}
	if req.Linkedin != nil {
		s.Linkedin = *req.Linkedin
	}
	if req.Twitter != nil {
		s.Twitter = *req.Twitter
	}
	if req.Github != nil {
		s.Github = *req.Github
	}
	if req.Instagram != nil {
		s.Instagram = *req.Instagram
	}
	if req.IsRaising != nil {
		s.IsRaising = *req.IsRaising
	}
	if req.CurrentRound != nil {
		s.CurrentRound = *req.CurrentRound
	}
	if req.FundingAsk != nil {
		s.FundingAsk = *req.FundingAsk
	}
	if req.FundingUse != nil {
		s.FundingUse = *req.FundingUse
	}
	if req.IsHiring != nil {
		s.IsHiring = *req.IsHiring
	}
	if req.OpenRoles != nil {
		s.OpenRoles = *req.OpenRoles
	}
	if req.ContactGeneral != nil {
		s.ContactGeneral = *req.ContactGeneral
	}
	if req.ContactFunding != nil {
		s.ContactFunding = *req.ContactFunding
	}
	if req.ContactTalent != nil {
		s.ContactTalent = *req.ContactTalent
	}
	if req.ProfileSetup != nil {
		s.ProfileSetup = *req.ProfileSetup
	}
}

// FavoriteStartup creates a favorite for the authenticated user on the specified startup.
func (h *Handler) FavoriteStartup(c *gin.Context, id openapi_types.UUID) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "authentication required"})
		return
	}

	// Check if the startup exists
	var startup models.Startup
	if err := h.DB.First(&startup, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		h.Logger.Printf("FavoriteStartup: db query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}

	// Create the favorite
	favorite := models.StartupFavorite{
		UserID:    userID,
		StartupID: id.String(),
	}

	if err := h.DB.Create(&favorite).Error; err != nil {
		// If already favorited, treat as idempotent success
		if common.IsDuplicateKeyError(err) {
			c.JSON(http.StatusOK, gin.H{"message": "already favorited"})
			return
		}
		h.Logger.Printf("FavoriteStartup: failed to create favorite: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to create favorite"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "startup favorited"})
}

// UnfavoriteStartup removes a favorite for the authenticated user on the specified startup.
func (h *Handler) UnfavoriteStartup(c *gin.Context, id openapi_types.UUID) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "authentication required"})
		return
	}

	// Delete the favorite
	result := h.DB.Where("user_id = ? AND startup_id = ?", userID, id.String()).
		Delete(&models.StartupFavorite{})

	if result.Error != nil {
		h.Logger.Printf("UnfavoriteStartup: db delete failed: %v", result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to remove favorite"})
		return
	}

	// Return 204 regardless of whether favorite existed (idempotent)
	c.Status(http.StatusNoContent)
}

// BoostStartup creates a boost for the authenticated user on the specified startup.
// Boosts are irreversible but expire after 7 days automatically.
func (h *Handler) BoostStartup(c *gin.Context, id openapi_types.UUID) {
	userID := middleware.GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "authentication required"})
		return
	}

	// Check if the startup exists
	var startup models.Startup
	if err := h.DB.First(&startup, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		h.Logger.Printf("BoostStartup: db query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}

	// Check if user already has an active boost for this startup
	if h.hasUserBoosted(userID, id.String()) {
		c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_BOOSTED", "message": "you have already boosted this startup"})
		return
	}

	// Create the boost (ExpiresAt will be set automatically in BeforeCreate hook)
	boost := models.StartupBoost{
		UserID:    userID,
		StartupID: id.String(),
	}

	if err := h.DB.Create(&boost).Error; err != nil {
		h.Logger.Printf("BoostStartup: failed to create boost: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to create boost"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "startup boosted"})
}

// getStartupBoostCount returns the count of active (non-expired) boosts for a startup.
func (h *Handler) getStartupBoostCount(startupID string) int64 {
	var count int64
	h.DB.Model(&models.StartupBoost{}).
		Where("startup_id = ? AND expires_at > ?", startupID, time.Now()).
		Count(&count)
	return count
}

// hasUserBoosted checks if the user has an active (non-expired) boost for the startup.
func (h *Handler) hasUserBoosted(userID, startupID string) bool {
	var count int64
	h.DB.Model(&models.StartupBoost{}).
		Where("user_id = ? AND startup_id = ? AND expires_at > ?", userID, startupID, time.Now()).
		Count(&count)
	return count > 0
}
