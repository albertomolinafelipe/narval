package startups

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/common"
	"github.com/narval/server/internal/api/gen"
	"github.com/narval/server/internal/email"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/internal/storage"
	"github.com/narval/server/models"
)

const (
	maxLogoSize   = 5 << 20  // 5 MiB
	maxBannerSize = 10 << 20 // 10 MiB
)

// Handler handles all /startups routes.
type Handler struct {
	*common.BaseHandler
	Mailer email.Sender
}

// NewHandler creates a new startups handler.
func NewHandler(db *gorm.DB, s storage.Interface, mailer email.Sender) *Handler {
	return &Handler{
		BaseHandler: common.NewBaseHandler(db, s, log.New(log.Writer(), "startups: ", log.LstdFlags)),
		Mailer:      mailer,
	}
}

// NewHandlerWithStorage is an alias used in tests to pass a fake storage client.
// Mailer is nil; email-sending endpoints are not exercised by these tests.
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
func (h *Handler) CheckStartupWebsite(c *gin.Context, params gen.CheckStartupWebsiteParams) {
	urlParam := common.NormalizeWebsite(params.Url)
	if urlParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "url required"})
		return
	}
	if !common.IsRootDomain(urlParam) {
		c.JSON(http.StatusOK, gen.WebsiteCheckResponse{Available: false, Reason: ptr(gen.Subdomain)})
		return
	}
	var count int64
	h.DB.Model(&models.Startup{}).Where("verified_domain = ?", urlParam).Count(&count)
	c.JSON(http.StatusOK, gen.WebsiteCheckResponse{Available: count == 0})
}

// GetStartup fetches a single startup by its UUID, or — for verified startups —
// by its verified domain. A well-formed UUID is looked up by id; anything else
// is treated as a domain and matched against verified startups only.
func (h *Handler) GetStartup(c *gin.Context, idOrDomain string) {
	var st models.Startup

	var query *gorm.DB
	if _, err := uuid.Parse(idOrDomain); err == nil {
		query = h.DB.Where("id = ?", idOrDomain)
	} else {
		query = h.DB.Where("verified_domain = ? AND verified = ?", common.NormalizeWebsite(idOrDomain), true)
	}

	if err := query.First(&st).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return
	}
	// Fetch-by-id stays public (the admin edit page reads it server-side without a
	// session). Unclaimed shells are kept out of the public *list*, not addressable
	// pages — they're reachable only by their exact id or claim link.
	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// ListStartups returns all startup accounts.
func (h *Handler) ListStartups(c *gin.Context, params gen.ListStartupsParams) {
	filterFavorited := params.Favorited != nil && *params.Favorited

	var startupList []models.Startup
	var query *gorm.DB
	if params.Sort != nil && *params.Sort == gen.Trending {
		query = h.DB.
			Select("startups.*, COALESCE(b.active_boosts, 0) AS active_boosts").
			Joins(`LEFT JOIN (
				SELECT startup_id, COUNT(*) AS active_boosts
				FROM startup_boosts
				WHERE expires_at > ?
				GROUP BY startup_id
			) b ON b.startup_id = startups.id`, time.Now()).
			Order("active_boosts DESC, startups.created_at DESC")
	} else {
		query = h.DB.Order("created_at desc")
	}

	// Get current user ID if authenticated
	userID := middleware.GetDBUserID(c)

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

	// Filter: only show profiles that have completed setup.
	query = query.Where("profile_setup = ?", true)

	if err := query.Find(&startupList).Error; err != nil {
		h.Logger.Printf("ListStartups: db query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startups"})
		return
	}
	result := make([]gen.Startup, len(startupList))
	for i, s := range startupList {
		result[i] = h.startupResponse(c, s)
	}
	c.JSON(http.StatusOK, result)
}

// CreateStartup registers a new startup for the authenticated user.
// The request validator has already enforced CreateStartupRequest (name
// required, lengths, enums); the update type is a superset with identical
// field names, so bind that and share applyStartupFields with UpdateStartup.
func (h *Handler) CreateStartup(c *gin.Context) {
	var req gen.UpdateStartupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}
	if req.Name == nil || *req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "name is required"})
		return
	}

	// owner_id is the local users.id everywhere (registration, claim, admin seed)
	// and every ownership check compares against it, so use the DB id here too —
	// not the SuperTokens auth id.
	ownerID := middleware.GetDBUserID(c)
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
		Name:       *req.Name,
		OwnerID:    ownerID,
		OwnerEmail: ownerEmail,
		Claimed:    true,
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

	applyStartupFields(&s, &req)

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

	var req gen.UpdateStartupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	if req.Name != nil && *req.Name != "" {
		st.Name = *req.Name
	}
	// Snapshot the image-bearing JSON fields before applying the update so we can
	// clean up blobs the owner removed (a deleted screenshot or founder photo).
	oldGallery, oldFounders := st.Gallery, st.Founders
	oldInstagram := st.Instagram
	applyStartupFields(&st, &req)

	// Editing the Instagram handle invalidates any verification: a verified badge
	// must never outlive the exact handle it was granted for. Clear the flag here
	// and drop any in-progress or completed challenge below.
	instagramChanged := instagramHandleKey(oldInstagram) != instagramHandleKey(st.Instagram)
	if instagramChanged {
		st.InstagramVerified = false
	}

	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	if instagramChanged {
		if err := h.DB.Where("startup_id = ?", startupID).
			Delete(&models.InstagramVerification{}).Error; err != nil {
			h.Logger.Printf("UpdateStartup: failed to clear instagram verification: %v", err)
		}
	}

	// Remove orphaned screenshot / founder-photo blobs dropped by this update.
	ctx := c.Request.Context()
	h.cleanupRemovedImages(ctx, startupID, galleryURLs(oldGallery), galleryURLs(st.Gallery))
	h.cleanupRemovedImages(ctx, startupID, founderPhotoURLs(oldFounders), founderPhotoURLs(st.Founders))

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

	objectName := fmt.Sprintf("logos/%s/%d-%s", startupID, time.Now().UnixMilli(), header.Filename)

	logoURL, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload logo"})
		return
	}

	oldURL := st.LogoURL
	st.LogoURL = logoURL
	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	// Replaced an existing logo — remove the now-orphaned blob.
	h.DeleteOwnedImage(c.Request.Context(), startupID, oldURL)

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

	objectName := fmt.Sprintf("banners/%s/%d-%s", startupID, time.Now().UnixMilli(), header.Filename)

	bannerURL, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload banner"})
		return
	}

	oldURL := st.BannerImage
	st.BannerImage = bannerURL
	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	// Replaced an existing banner — remove the now-orphaned blob.
	h.DeleteOwnedImage(c.Request.Context(), startupID, oldURL)

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// clearStartupImage clears one image field (logo or banner) for an owned
// startup and removes the now-orphaned blob from object storage. apply mutates
// the loaded startup to zero the relevant field.
func (h *Handler) clearStartupImage(c *gin.Context, id openapi_types.UUID, apply func(*models.Startup)) {
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

	oldLogo, oldBanner := st.LogoURL, st.BannerImage
	apply(&st)
	if err := h.DB.Save(&st).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to update startup"})
		return
	}

	// Delete whichever image was just cleared (went from set to empty).
	if st.LogoURL == "" && oldLogo != "" {
		h.DeleteOwnedImage(c.Request.Context(), startupID, oldLogo)
	}
	if st.BannerImage == "" && oldBanner != "" {
		h.DeleteOwnedImage(c.Request.Context(), startupID, oldBanner)
	}

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}

// DeleteStartupLogo removes the logo reference from the startup.
func (h *Handler) DeleteStartupLogo(c *gin.Context, id openapi_types.UUID) {
	h.clearStartupImage(c, id, func(st *models.Startup) { st.LogoURL = "" })
}

// DeleteStartupBanner removes the banner reference from the startup.
func (h *Handler) DeleteStartupBanner(c *gin.Context, id openapi_types.UUID) {
	h.clearStartupImage(c, id, func(st *models.Startup) { st.BannerImage = "" })
}

// UploadFounderPhoto uploads a founder photo and returns the public URL.
// The client is responsible for storing the URL inside the founders JSON field.
func (h *Handler) UploadFounderPhoto(c *gin.Context, id openapi_types.UUID) {
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

	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "photo file is required"})
		return
	}
	defer file.Close() //nolint:errcheck

	if header.Size > maxLogoSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "photo exceeds 5 MiB limit"})
		return
	}

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		ct = "image/jpeg"
	}

	objectName := fmt.Sprintf("founders/%s/%d-%s", startupID, time.Now().UnixMilli(), header.Filename)
	photoURL, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload photo"})
		return
	}

	c.JSON(http.StatusOK, gen.UploadUrlResponse{Url: photoURL})
}

// UploadStartupScreenshot uploads a single product screenshot and returns its
// public URL. The client stores the URL inside the startup's gallery JSON field.
func (h *Handler) UploadStartupScreenshot(c *gin.Context, id openapi_types.UUID) {
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

	file, header, err := c.Request.FormFile("screenshot")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "screenshot file is required"})
		return
	}
	defer file.Close() //nolint:errcheck

	if header.Size > maxLogoSize {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "screenshot exceeds 5 MiB limit"})
		return
	}

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		ct = "image/jpeg"
	}

	objectName := fmt.Sprintf("screenshots/%s/%d-%s", startupID, time.Now().UnixMilli(), header.Filename)
	url, err := h.Storage.UploadLogo(c.Request.Context(), objectName, file, header.Size, ct)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "STORAGE_ERROR", "message": "failed to upload screenshot"})
		return
	}

	c.JSON(http.StatusOK, gen.UploadUrlResponse{Url: url})
}

//  Response helpers

// ptr returns a pointer to v. The generated response types use pointers for
// optional fields; the API sets them all so the wire format stays identical to
// the previous map-based response (every column always serialized).
func ptr[T any](v T) *T { return &v }

// startupResponse converts a Startup model to the API response.
// If the user is authenticated, it includes bookmark and boost status.
func (h *Handler) startupResponse(c *gin.Context, s models.Startup) gen.Startup {
	id, _ := uuid.Parse(s.ID)

	// Parse founders JSON into an array so clients receive structured data.
	founders := []gen.Founder{}
	if s.Founders != "" {
		_ = json.Unmarshal([]byte(s.Founders), &founders)
	}

	response := gen.Startup{
		Id:                id,
		Name:              s.Name,
		OwnerId:           s.OwnerID,
		CreatedAt:         s.CreatedAt,
		UpdatedAt:         ptr(s.UpdatedAt),
		Tagline:           ptr(s.Tagline),
		Description:       ptr(s.Description),
		About:             ptr(s.About),
		VideoUrl:          ptr(s.VideoURL),
		Milestones:        ptr(s.Milestones),
		Website:           ptr(s.Website),
		VerifiedDomain:    ptr(s.VerifiedDomain),
		InstagramVerified: ptr(s.InstagramVerified),
		LogoUrl:           ptr(s.LogoURL),
		Stage:             ptr(gen.Stage(s.Stage)),
		Industry:          ptr(gen.Industry(s.Industry)),
		TeamSize:          ptr(s.TeamSize),
		Location:          ptr(s.Location),
		FoundedYear:       ptr(s.FoundedYear),
		TechStack:         ptr(s.TechStack),
		BannerImage:       ptr(s.BannerImage),
		ProductLinks:      ptr(s.ProductLinks),
		Gallery:           ptr(s.Gallery),
		ProductStatus:     ptr(s.ProductStatus),
		Features:          ptr(s.Features),
		Linkedin:          ptr(s.Linkedin),
		Twitter:           ptr(s.Twitter),
		Github:            ptr(s.Github),
		Instagram:         ptr(s.Instagram),
		IsRaising:         ptr(s.IsRaising),
		CurrentRound:      ptr(gen.FundingRound(s.CurrentRound)),
		FundingAsk:        ptr(s.FundingAsk),
		FundingUse:        ptr(s.FundingUse),
		IsHiring:          ptr(s.IsHiring),
		OpenRoles:         ptr(s.OpenRoles),
		ContributingText:  ptr(s.ContributingText),
		ContactGeneral:    ptr(s.ContactGeneral),
		ContactFunding:    ptr(s.ContactFunding),
		ContactTalent:     ptr(s.ContactTalent),
		ProfileSetup:      ptr(s.ProfileSetup),
		Claimed:           ptr(s.Claimed),
		Verified:          ptr(s.Verified),
		Founders:          &founders,
		BoostCount:        ptr(int(h.getStartupBoostCount(s.ID))),
	}

	// Personalized fields only exist for authenticated users.
	if userID := middleware.GetDBUserID(c); userID != "" {
		response.IsFavorited = ptr(h.isStartupFavorited(userID, s.ID))
		response.HasBoosted = ptr(h.hasUserBoosted(userID, s.ID))
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
func applyStartupFields(s *models.Startup, req *gen.UpdateStartupRequest) {
	if req.Tagline != nil {
		s.Tagline = *req.Tagline
	}
	if req.Description != nil {
		s.Description = *req.Description
	}
	if req.About != nil {
		s.About = *req.About
	}
	if req.VideoUrl != nil {
		s.VideoURL = *req.VideoUrl
	}
	if req.Milestones != nil {
		s.Milestones = *req.Milestones
	}
	if req.Website != nil {
		s.Website = common.NormalizeWebsite(*req.Website)
	}
	if req.Stage != nil {
		s.Stage = string(*req.Stage)
	}
	if req.Industry != nil {
		s.Industry = string(*req.Industry)
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
		s.CurrentRound = string(*req.CurrentRound)
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
	if req.ContributingText != nil {
		s.ContributingText = *req.ContributingText
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
	if req.Founders != nil {
		s.Founders = *req.Founders
	}
	if req.Gallery != nil {
		s.Gallery = capGalleryJSON(*req.Gallery)
	}
	if req.ProductStatus != nil {
		s.ProductStatus = *req.ProductStatus
	}
	if req.Features != nil {
		s.Features = capFeaturesJSON(*req.Features)
	}
}

// galleryURLs parses the gallery JSON (array of URL strings). Malformed values
// yield no URLs, so cleanup skips them rather than guessing.
func galleryURLs(raw string) []string {
	if raw == "" {
		return nil
	}
	var urls []string
	if err := json.Unmarshal([]byte(raw), &urls); err != nil {
		return nil
	}
	return urls
}

// founderPhotoURLs extracts the photo_url of each founder from the founders JSON.
func founderPhotoURLs(raw string) []string {
	if raw == "" {
		return nil
	}
	var founders []struct {
		PhotoURL string `json:"photo_url"`
	}
	if err := json.Unmarshal([]byte(raw), &founders); err != nil {
		return nil
	}
	out := make([]string, 0, len(founders))
	for _, f := range founders {
		if f.PhotoURL != "" {
			out = append(out, f.PhotoURL)
		}
	}
	return out
}

// cleanupRemovedImages deletes the blobs for image URLs present in old but not
// in new. DeleteOwnedImage guards ownership, so external URLs are left alone.
func (h *Handler) cleanupRemovedImages(ctx context.Context, startupID string, oldURLs, newURLs []string) {
	if len(oldURLs) == 0 {
		return
	}
	kept := make(map[string]bool, len(newURLs))
	for _, u := range newURLs {
		kept[u] = true
	}
	for _, u := range oldURLs {
		if !kept[u] {
			h.DeleteOwnedImage(ctx, startupID, u)
		}
	}
}

// maxGalleryImages caps the product screenshot carousel.
const maxGalleryImages = 4

// capGalleryJSON keeps at most maxGalleryImages entries. Invalid JSON is passed
// through untouched (the frontend always sends a well-formed array); only the
// happy path is trimmed so an over-long client payload can't grow unbounded.
func capGalleryJSON(raw string) string {
	if raw == "" {
		return raw
	}
	var urls []string
	if err := json.Unmarshal([]byte(raw), &urls); err != nil {
		return raw
	}
	if len(urls) <= maxGalleryImages {
		return raw
	}
	trimmed, err := json.Marshal(urls[:maxGalleryImages])
	if err != nil {
		return raw
	}
	return string(trimmed)
}

// maxFeatures caps the key-features list on the Product tab.
const maxFeatures = 8

// feature mirrors the {title, description} objects the frontend stores in the
// features JSON array. Only title/description are kept on the round-trip.
type feature struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

// capFeaturesJSON keeps at most maxFeatures entries. Invalid JSON is passed
// through untouched (the frontend always sends a well-formed array); only the
// happy path is trimmed so an over-long client payload can't grow unbounded.
func capFeaturesJSON(raw string) string {
	if raw == "" {
		return raw
	}
	var items []feature
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return raw
	}
	if len(items) <= maxFeatures {
		return raw
	}
	trimmed, err := json.Marshal(items[:maxFeatures])
	if err != nil {
		return raw
	}
	return string(trimmed)
}

// FavoriteStartup creates a favorite for the authenticated user on the specified startup.
func (h *Handler) FavoriteStartup(c *gin.Context, id openapi_types.UUID) {
	userID := middleware.GetDBUserID(c)
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
	userID := middleware.GetDBUserID(c)
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
	userID := middleware.GetDBUserID(c)
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
