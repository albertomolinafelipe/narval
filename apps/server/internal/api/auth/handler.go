package auth

import (
	"errors"
	"log"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/supertokens/supertokens-golang/ingredients/emaildelivery"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"gorm.io/gorm"

	"github.com/narval/server/internal/accounts"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/models"
)

// Helper functions

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

type Handler struct {
	cfg    *config.Config
	db     *gorm.DB
	rdb    *redis.Client
	logger *log.Logger
}

func NewHandler(cfg *config.Config, db *gorm.DB, rdb *redis.Client) *Handler {
	return &Handler{
		cfg:    cfg,
		db:     db,
		rdb:    rdb,
		logger: log.New(log.Writer(), "auth: ", log.LstdFlags),
	}
}

// isAdmin reports whether email is on the admin whitelist.
func (h *Handler) isAdmin(email string) bool {
	for _, a := range h.cfg.AdminEmails {
		if a == email {
			return true
		}
	}
	return false
}

// Register initiates passwordless signup - creates OTP and sends via email.
func (h *Handler) Register(c *gin.Context) {
	var req struct {
		AccountType string  `json:"account_type" binding:"required,oneof=user startup"`
		Email       string  `json:"email"`    // required for both account types
		Nickname    string  `json:"nickname"` // user path
		Name        *string `json:"name"`     // startup path
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	var email, nickname string

	// Handle different registration flows. Domain verification is no longer part
	// of signup — every account starts unverified and verifies its domain later
	// from the profile.
	if req.AccountType == "user" {
		// User registration: email + nickname required
		if req.Email == "" || req.Nickname == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "email and nickname required for user registration"})
			return
		}
		email = req.Email
		nickname = req.Nickname
	} else {
		// Startup registration: name + email required
		if req.Name == nil || *req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "name is required for startup registration"})
			return
		}
		if req.Email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "email is required"})
			return
		}
		email = req.Email
		nickname = *req.Name
	}

	// Validate email format
	if !isValidEmail(email) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "invalid email format"})
		return
	}

	// Check if email already exists
	var existingUser models.User
	if err := h.db.Where("email = ?", email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"code": "EMAIL_EXISTS", "message": "email already registered"})
		return
	}

	// Create SuperTokens passwordless code
	tenantID := "public"
	codeResp, err := passwordless.CreateCodeWithEmail(tenantID, email, nil)
	if err != nil {
		h.logger.Printf("SuperTokens CreateCode failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create verification code"})
		return
	}

	// Store registration metadata temporarily with PreAuthSessionID and DeviceID
	draft := models.RegistrationDraft{
		Email:            email,
		Nickname:         nickname,
		AccountType:      models.AccountType(req.AccountType),
		PreAuthSessionID: codeResp.OK.PreAuthSessionID,
		DeviceID:         codeResp.OK.DeviceID,
	}
	if req.AccountType == "startup" {
		draft.Name = *req.Name
	}

	h.db.Where("email = ?", email).Delete(&models.RegistrationDraft{})

	if err := h.db.Create(&draft).Error; err != nil {
		h.logger.Printf("failed to create registration draft: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "registration failed"})
		return
	}

	// Manually trigger email sending (OTP-only, no magic link)
	userInputCode := codeResp.OK.UserInputCode
	err = passwordless.SendEmail(emaildelivery.EmailType{
		PasswordlessLogin: &emaildelivery.PasswordlessLoginType{
			Email:            email,
			UserInputCode:    &userInputCode,
			UrlWithLinkCode:  nil, // OTP-only flow, no magic link
			CodeLifetime:     codeResp.OK.CodeLifetime,
			PreAuthSessionId: codeResp.OK.PreAuthSessionID,
			TenantId:         tenantID,
		},
	})
	if err != nil {
		h.logger.Printf("Failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	h.logger.Printf("Registration code sent to %s", req.Email)
	c.JSON(http.StatusAccepted, gin.H{
		"message": "verification code sent to email",
	})
}

// Verify consumes the OTP code and creates a user + session.
func (h *Handler) Verify(c *gin.Context) {
	var req struct {
		Email            string `json:"email" binding:"required,email"`
		Code             string `json:"code" binding:"required"`
		PreAuthSessionID string `json:"pre_auth_session_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	// Get registration metadata (or login flow)
	var draft models.RegistrationDraft
	draftErr := h.db.Where("email = ?", req.Email).First(&draft).Error

	// Consume the OTP code via SuperTokens
	tenantID := "public"
	deviceID := ""
	preAuthSessionID := ""
	if draftErr == nil {
		deviceID = draft.DeviceID
		preAuthSessionID = draft.PreAuthSessionID
	}

	resp, err := passwordless.ConsumeCodeWithUserInputCode(tenantID, deviceID, req.Code, preAuthSessionID, nil)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_CODE", "message": "invalid or expired verification code"})
		return
	}

	if resp.OK == nil {
		// Check specific error types
		if resp.IncorrectUserInputCodeError != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_CODE", "message": "incorrect verification code"})
			return
		}
		if resp.ExpiredUserInputCodeError != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": "EXPIRED_CODE", "message": "verification code has expired"})
			return
		}
		if resp.RestartFlowError != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"code": "RESTART_FLOW", "message": "authentication flow needs to be restarted"})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"code": "INVALID_CODE", "message": "verification failed"})
		return
	}

	authUserID := resp.OK.User.ID

	// Reconcile the local user. A draft is present for both registration (new
	// user, uses the draft's account type/name) and login (existing user, draft
	// is ignored). Same helper the third-party flow uses.
	var intent *accounts.Intent
	if draftErr == nil {
		intent = &accounts.Intent{
			AccountType: draft.AccountType,
			Nickname:    draft.Nickname,
			Name:        draft.Name,
			ClaimToken:  draft.ClaimToken,
		}
	}
	user, err := accounts.LinkOrCreate(h.db, req.Email, authUserID, intent)
	if err != nil {
		switch {
		case errors.Is(err, accounts.ErrAlreadyHasProfile):
			c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_HAS_PROFILE", "message": "this account already has a startup profile"})
		case errors.Is(err, accounts.ErrInvalidClaim):
			c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_CLAIM", "message": "this claim link is invalid or already used"})
		default:
			h.logger.Printf("failed to reconcile user: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "user creation failed"})
		}
		return
	}
	if draftErr == nil {
		h.db.Delete(&draft)
	}

	// Create SuperTokens session with user metadata in access token payload
	tenantIDForSession := "public"
	_, err = session.CreateNewSession(c.Request, c.Writer, tenantIDForSession, authUserID, accounts.SessionPayload(user), nil)
	if err != nil {
		h.logger.Printf("failed to create session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "session creation failed"})
		return
	}

	h.logger.Printf("User verified and logged in: %s", user.Email)

	c.JSON(http.StatusOK, gin.H{
		"id":           user.ID,
		"auth_user_id": user.AuthUserID,
		"email":        user.Email,
		"nickname":     user.Nickname,
		"account_type": user.AccountType,
	})
}

// Login initiates passwordless login - sends OTP via email.
func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	// Check if user exists with this email
	var existingUser models.User
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "USER_NOT_FOUND", "message": "no account found with this email"})
		return
	}

	// Create SuperTokens passwordless code
	tenantID := "public"
	codeResp, err := passwordless.CreateCodeWithEmail(tenantID, req.Email, nil)
	if err != nil {
		h.logger.Printf("SuperTokens CreateCode failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create verification code"})
		return
	}

	// Store PreAuthSessionID and DeviceID in a temporary draft for login verification
	// This allows the verify endpoint to find the correct session
	draft := models.RegistrationDraft{
		Email:            req.Email,
		Nickname:         existingUser.Nickname,
		AccountType:      existingUser.AccountType,
		PreAuthSessionID: codeResp.OK.PreAuthSessionID,
		DeviceID:         codeResp.OK.DeviceID,
	}
	h.db.Where("email = ?", req.Email).Delete(&models.RegistrationDraft{})
	if err := h.db.Create(&draft).Error; err != nil {
		h.logger.Printf("failed to create login draft: %v", err)
		// Non-fatal, continue with email sending
	}

	// Manually trigger email sending (OTP-only, no magic link)
	userInputCode := codeResp.OK.UserInputCode
	err = passwordless.SendEmail(emaildelivery.EmailType{
		PasswordlessLogin: &emaildelivery.PasswordlessLoginType{
			Email:            req.Email,
			UserInputCode:    &userInputCode,
			UrlWithLinkCode:  nil, // OTP-only flow, no magic link
			CodeLifetime:     codeResp.OK.CodeLifetime,
			PreAuthSessionId: codeResp.OK.PreAuthSessionID,
			TenantId:         tenantID,
		},
	})
	if err != nil {
		h.logger.Printf("Failed to send email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	h.logger.Printf("Login code sent to %s", req.Email)
	c.JSON(http.StatusAccepted, gin.H{
		"message": "verification code sent to email",
	})
}

// StartClaim begins claiming an admin-seeded shell: it validates the claim
// token, sends an OTP to the email the startup provides, and stashes the token
// on a draft so Verify binds the shell to them. Works for brand-new emails and
// existing accounts alike (unlike Register, which rejects existing emails).
func (h *Handler) StartClaim(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	// The token must point at an existing, still-unclaimed shell.
	var shell models.Startup
	if err := h.db.Where("claim_token = ? AND claimed = ?", req.Token, false).First(&shell).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "INVALID_CLAIM", "message": "this claim link is invalid or already used"})
		return
	}

	// Reject up front if this email already owns a startup — one profile per
	// account. bindClaim enforces this authoritatively, but catching it here
	// avoids sending a code for a claim that can't complete.
	var existing models.User
	if err := h.db.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		var owned int64
		h.db.Model(&models.Startup{}).
			Where("owner_id = ? AND claimed = ?", existing.ID, true).
			Count(&owned)
		if owned > 0 {
			c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_HAS_PROFILE", "message": "this email already has a startup profile"})
			return
		}
	}

	tenantID := "public"
	codeResp, err := passwordless.CreateCodeWithEmail(tenantID, req.Email, nil)
	if err != nil {
		h.logger.Printf("StartClaim CreateCode failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create verification code"})
		return
	}

	draft := models.RegistrationDraft{
		Email:            req.Email,
		Nickname:         shell.Name,
		AccountType:      models.AccountTypeStartup,
		Name:             shell.Name,
		ClaimToken:       req.Token,
		PreAuthSessionID: codeResp.OK.PreAuthSessionID,
		DeviceID:         codeResp.OK.DeviceID,
	}
	h.db.Where("email = ?", req.Email).Delete(&models.RegistrationDraft{})
	if err := h.db.Create(&draft).Error; err != nil {
		h.logger.Printf("failed to create claim draft: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "claim failed"})
		return
	}

	userInputCode := codeResp.OK.UserInputCode
	err = passwordless.SendEmail(emaildelivery.EmailType{
		PasswordlessLogin: &emaildelivery.PasswordlessLoginType{
			Email:            req.Email,
			UserInputCode:    &userInputCode,
			UrlWithLinkCode:  nil,
			CodeLifetime:     codeResp.OK.CodeLifetime,
			PreAuthSessionId: codeResp.OK.PreAuthSessionID,
			TenantId:         tenantID,
		},
	})
	if err != nil {
		h.logger.Printf("Failed to send claim email: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{"message": "verification code sent to email"})
}

// Logout revokes the current session.
func (h *Handler) Logout(c *gin.Context) {
	sessionContainer, err := session.GetSession(c.Request, c.Writer, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "no active session"})
		return
	}

	err = sessionContainer.RevokeSession()
	if err != nil {
		h.logger.Printf("failed to revoke session: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// Refresh is handled by SuperTokens middleware automatically.
func (h *Handler) Refresh(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "session refreshed"})
}

// GetMe returns the current user's profile.
func (h *Handler) GetMe(c *gin.Context) {
	authUserID := middleware.GetUserID(c)
	if authUserID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "not authenticated"})
		return
	}

	var user models.User
	if err := h.db.Where("auth_user_id = ?", authUserID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "USER_NOT_FOUND", "message": "user profile not found"})
		return
	}

	// Build response with base user data
	response := gin.H{
		"id":           user.ID,
		"auth_user_id": user.AuthUserID,
		"email":        user.Email,
		"nickname":     user.Nickname,
		"account_type": user.AccountType,
		"is_admin":     h.isAdmin(user.Email),
		"created_at":   user.CreatedAt,
		"updated_at":   user.UpdatedAt,
	}

	// Look up profile_id and logo_url for startup accounts. Only a claimed
	// profile is "theirs" — an admin's unclaimed shells never count here.
	if user.AccountType == models.AccountTypeStartup {
		var startup models.Startup
		if err := h.db.Where("owner_id = ? AND claimed = ?", user.ID, true).First(&startup).Error; err == nil {
			response["profile_id"] = startup.ID
			response["logo_url"] = startup.LogoURL
		}
	}

	c.JSON(http.StatusOK, response)
}
