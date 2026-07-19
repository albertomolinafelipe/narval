package startups

import (
	"crypto/rand"
	"errors"
	"math/big"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"gorm.io/gorm"

	"github.com/narval/server/internal/logging"
	"github.com/narval/server/models"
)

// instagramHandleRe matches a bare Instagram handle: 1–30 chars of letters,
// digits, periods and underscores.
var instagramHandleRe = regexp.MustCompile(`^[a-z0-9._]{1,30}$`)

// instagramCodeAlphabet omits visually ambiguous characters (0/O, 1/I) so the
// code is easy to copy from a UI and read back out of a DM.
const instagramCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// normalizeInstagramHandle strips a leading @ or an instagram.com URL wrapper
// and lowercases the result, returning ok=false if it isn't a valid handle.
func normalizeInstagramHandle(raw string) (string, bool) {
	h := strings.TrimSpace(raw)
	h = strings.TrimPrefix(h, "https://")
	h = strings.TrimPrefix(h, "http://")
	h = strings.TrimPrefix(h, "www.")
	if i := strings.Index(h, "instagram.com/"); i != -1 {
		h = h[i+len("instagram.com/"):]
	}
	h = strings.TrimPrefix(strings.Trim(h, "/"), "@")
	if i := strings.IndexAny(h, "/?"); i != -1 {
		h = h[:i]
	}
	h = strings.ToLower(h)
	if !instagramHandleRe.MatchString(h) {
		return "", false
	}
	return h, true
}

// instagramHandleKey reduces any Instagram value (bare handle, @handle, or full
// URL) to its normalized handle for comparison, or "" if empty/invalid. Used to
// tell whether an edit actually changed the handle (vs cosmetic reformatting).
func instagramHandleKey(raw string) string {
	if h, ok := normalizeInstagramHandle(raw); ok {
		return h
	}
	return ""
}

// generateInstagramCode returns a short correlation token like "NRVL-7K3F9Q".
func generateInstagramCode() (string, error) {
	b := make([]byte, 6)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(instagramCodeAlphabet))))
		if err != nil {
			return "", err
		}
		b[i] = instagramCodeAlphabet[n.Int64()]
	}
	return "NRVL-" + string(b), nil
}

// instagramStatus maps the stored verified flag to the API status string.
func instagramStatus(verified bool) string {
	if verified {
		return "verified"
	}
	return "pending"
}

// instagramVerificationResponse is the startup-facing view, including the code
// and the company DM link.
func (h *Handler) instagramVerificationResponse(v models.InstagramVerification) gin.H {
	return gin.H{
		"id":         v.ID,
		"startup_id": v.StartupID,
		"handle":     v.Handle,
		"code":       v.Code,
		"status":     instagramStatus(v.Verified),
		"created_at": v.CreatedAt,
	}
}

// adminInstagramVerificationResponse is the console view, with the startup name
// but without the DM link.
func adminInstagramVerificationResponse(v models.InstagramVerification, startupName string) gin.H {
	return gin.H{
		"id":           v.ID,
		"startup_id":   v.StartupID,
		"startup_name": startupName,
		"handle":       v.Handle,
		"code":         v.Code,
		"status":       instagramStatus(v.Verified),
		"created_at":   v.CreatedAt,
	}
}

// StartInstagramVerification locks an Instagram handle to the startup and issues
// the code the owner must DM to the company account from that handle.
func (h *Handler) StartInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	st, ok := h.ownedStartup(c, id)
	if !ok {
		return
	}

	var req struct {
		Handle string `json:"handle" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}
	handle, valid := normalizeInstagramHandle(req.Handle)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "invalid Instagram handle"})
		return
	}

	// No cross-startup uniqueness check: several startups may attempt the same
	// handle, but only the real owner can DM the code, so the admin match is the
	// real gate. Enforcing uniqueness here would just let anyone squat a handle.

	// One active challenge per startup: refuse a second. Editing the handle (which
	// deletes the draft) or an admin reset clears it.
	var existing models.InstagramVerification
	err := h.DB.Where("startup_id = ?", st.ID).First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_LOCKED", "message": "a verification is already in progress; ask an admin to reset it to change the handle"})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query verification"})
		return
	}

	code, err := generateInstagramCode()
	if err != nil {
		logging.From(c).Error("StartInstagramVerification: code generation failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to start verification"})
		return
	}

	v := models.InstagramVerification{StartupID: st.ID, Handle: handle, Code: code}
	if err := h.DB.Create(&v).Error; err != nil {
		logging.From(c).Error("StartInstagramVerification: db create failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to start verification"})
		return
	}
	c.JSON(http.StatusCreated, h.instagramVerificationResponse(v))
}

// GetInstagramVerification returns the startup's current challenge, if any.
func (h *Handler) GetInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	st, ok := h.ownedStartup(c, id)
	if !ok {
		return
	}

	var v models.InstagramVerification
	if err := h.DB.Where("startup_id = ?", st.ID).First(&v).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "no verification in progress"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query verification"})
		return
	}
	c.JSON(http.StatusOK, h.instagramVerificationResponse(v))
}

// instagramVerificationRow is a verification joined with its startup's name.
type instagramVerificationRow struct {
	models.InstagramVerification
	StartupName string
}

// ListInstagramVerifications returns verifications for the admin console
// (adminAuth routes are whitelist-gated in the router), optionally filtered by
// status ("pending" or "verified"; "" for all).
func (h *Handler) ListInstagramVerifications(c *gin.Context, status string) {
	q := h.DB.Model(&models.InstagramVerification{}).
		Select("instagram_verifications.*, startups.name AS startup_name").
		Joins("JOIN startups ON startups.id = instagram_verifications.startup_id").
		Order("instagram_verifications.created_at DESC")
	switch status {
	case "pending":
		q = q.Where("instagram_verifications.verified = ?", false)
	case "verified":
		q = q.Where("instagram_verifications.verified = ?", true)
	}

	var rows []instagramVerificationRow
	if err := q.Scan(&rows).Error; err != nil {
		logging.From(c).Error("ListInstagramVerifications: db query failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query verifications"})
		return
	}

	out := make([]gin.H, len(rows))
	for i, r := range rows {
		out[i] = adminInstagramVerificationResponse(r.InstagramVerification, r.StartupName)
	}
	c.JSON(http.StatusOK, out)
}

// ConfirmInstagramVerification marks a challenge verified and flips the
// startup's Instagram flags. Admin only.
func (h *Handler) ConfirmInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	var v models.InstagramVerification
	if err := h.DB.First(&v, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "verification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query verification"})
		return
	}

	// Confirming makes the verified handle the startup's displayed Instagram, so
	// the badge and the shown handle can never disagree.
	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&v).Update("verified", true).Error; err != nil {
			return err
		}
		return tx.Model(&models.Startup{}).Where("id = ?", v.StartupID).Updates(map[string]interface{}{
			"instagram_verified": true,
			"instagram":          "https://instagram.com/" + v.Handle,
		}).Error
	}); err != nil {
		logging.From(c).Error("ConfirmInstagramVerification: db update failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to confirm verification"})
		return
	}
	v.Verified = true

	var name string
	h.DB.Model(&models.Startup{}).Where("id = ?", v.StartupID).Pluck("name", &name)
	c.JSON(http.StatusOK, adminInstagramVerificationResponse(v, name))
}

// ResetInstagramVerification deletes a challenge and clears the startup's
// verified flag. Admin only.
func (h *Handler) ResetInstagramVerification(c *gin.Context, id openapi_types.UUID) {
	var v models.InstagramVerification
	if err := h.DB.First(&v, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "verification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query verification"})
		return
	}

	// The draft only survives while the handle is unchanged (editing it deletes
	// the draft), so the flag safely refers to this challenge's handle.
	if err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Startup{}).
			Where("id = ?", v.StartupID).
			Update("instagram_verified", false).Error; err != nil {
			return err
		}
		return tx.Delete(&v).Error
	}); err != nil {
		logging.From(c).Error("ResetInstagramVerification: db delete failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to reset verification"})
		return
	}
	c.Status(http.StatusNoContent)
}
