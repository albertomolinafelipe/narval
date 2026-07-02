package startups

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"gorm.io/gorm"

	"github.com/narval/server/internal/api/common"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/models"
)

const (
	domainCodeTTL     = 15 * time.Minute
	domainMaxAttempts = 5
)

// hashCode returns the hex-encoded SHA-256 of a verification code. Codes are
// never stored in plaintext.
func hashCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// generateCode returns a random 6-digit numeric code.
func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// ownedStartup loads the startup and confirms the caller owns it, writing the
// appropriate error response and returning ok=false otherwise.
func (h *Handler) ownedStartup(c *gin.Context, id openapi_types.UUID) (models.Startup, bool) {
	var st models.Startup
	if err := h.DB.First(&st, "id = ?", id.String()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"code": "NOT_FOUND", "message": "startup not found"})
			return st, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "DB_ERROR", "message": "failed to query startup"})
		return st, false
	}
	if st.OwnerID != middleware.GetDBUserID(c) {
		c.JSON(http.StatusForbidden, gin.H{"code": "FORBIDDEN", "message": "not the owner of this startup"})
		return st, false
	}
	return st, true
}

// StartDomainVerification validates a company domain and emails a one-time code
// to an address at that domain to prove the owner controls it.
func (h *Handler) StartDomainVerification(c *gin.Context, id openapi_types.UUID) {
	st, ok := h.ownedStartup(c, id)
	if !ok {
		return
	}

	var req struct {
		Website     string `json:"website" binding:"required"`
		EmailPrefix string `json:"email_prefix" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	domain := common.NormalizeWebsite(req.Website)
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "invalid website URL"})
		return
	}
	if !common.IsRootDomain(domain) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "SUBDOMAIN_NOT_ALLOWED", "message": "please use your root domain (e.g. example.com, not app.example.com)"})
		return
	}
	if common.IsPublicEmailDomain(domain) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "PUBLIC_DOMAIN", "message": "use your company domain, not a personal email provider"})
		return
	}

	// The domain must not already be verified by a different startup.
	var taken int64
	h.DB.Model(&models.Startup{}).
		Where("verified_domain = ? AND verified = ? AND id <> ?", domain, true, st.ID).
		Count(&taken)
	if taken > 0 {
		c.JSON(http.StatusConflict, gin.H{"code": "DOMAIN_TAKEN", "message": "a startup with this domain is already verified"})
		return
	}

	code, err := generateCode()
	if err != nil {
		h.Logger.Printf("StartDomainVerification: code generation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to start verification"})
		return
	}
	targetEmail := req.EmailPrefix + "@" + domain

	// Replace any existing challenge for this startup.
	h.DB.Where("startup_id = ?", st.ID).Delete(&models.DomainVerification{})
	challenge := models.DomainVerification{
		StartupID: st.ID,
		Domain:    domain,
		Email:     targetEmail,
		CodeHash:  hashCode(code),
		ExpiresAt: time.Now().Add(domainCodeTTL),
	}
	if err := h.DB.Create(&challenge).Error; err != nil {
		h.Logger.Printf("StartDomainVerification: db create failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to start verification"})
		return
	}

	if h.Mailer == nil {
		h.Logger.Printf("StartDomainVerification: no mailer configured, cannot send code")
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "email delivery not configured"})
		return
	}
	if err := h.Mailer.SendDomainVerificationCode(targetEmail, domain, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "verification code sent", "email": targetEmail})
}

// ConfirmDomainVerification consumes the one-time code and, on success, marks
// the startup verified with the challenged domain.
func (h *Handler) ConfirmDomainVerification(c *gin.Context, id openapi_types.UUID) {
	st, ok := h.ownedStartup(c, id)
	if !ok {
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	var challenge models.DomainVerification
	if err := h.DB.Where("startup_id = ?", st.ID).First(&challenge).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "NO_CHALLENGE", "message": "no verification in progress; start one first"})
		return
	}

	if time.Now().After(challenge.ExpiresAt) {
		h.DB.Delete(&challenge)
		c.JSON(http.StatusUnauthorized, gin.H{"code": "EXPIRED_CODE", "message": "verification code has expired"})
		return
	}
	if challenge.Attempts >= domainMaxAttempts {
		h.DB.Delete(&challenge)
		c.JSON(http.StatusUnauthorized, gin.H{"code": "TOO_MANY_ATTEMPTS", "message": "too many attempts; start verification again"})
		return
	}
	if hashCode(req.Code) != challenge.CodeHash {
		h.DB.Model(&challenge).Update("attempts", challenge.Attempts+1)
		c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_CODE", "message": "incorrect verification code"})
		return
	}

	// Success: mark verified. Overwriting VerifiedDomain frees any previous
	// domain automatically, since uniqueness is enforced across other startups.
	st.Verified = true
	st.VerifiedDomain = challenge.Domain
	if err := h.DB.Model(&st).Updates(map[string]interface{}{
		"verified":        true,
		"verified_domain": challenge.Domain,
	}).Error; err != nil {
		h.Logger.Printf("ConfirmDomainVerification: db update failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to verify domain"})
		return
	}
	h.DB.Delete(&challenge)

	c.JSON(http.StatusOK, h.startupResponse(c, st))
}
