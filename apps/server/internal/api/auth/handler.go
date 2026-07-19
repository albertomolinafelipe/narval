package auth

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis_rate/v10"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/supertokens/supertokens-golang/ingredients/emaildelivery"
	"github.com/supertokens/supertokens-golang/recipe/passwordless"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"gorm.io/gorm"

	"github.com/narval/server/internal/accounts"
	"github.com/narval/server/internal/api/gen"
	"github.com/narval/server/internal/config"
	"github.com/narval/server/internal/logging"
	"github.com/narval/server/internal/middleware"
	"github.com/narval/server/models"
)

// Helper functions

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

type Handler struct {
	cfg     *config.Config
	db      *gorm.DB
	rdb     *redis.Client
	limiter *redis_rate.Limiter
}

func NewHandler(cfg *config.Config, db *gorm.DB, rdb *redis.Client) *Handler {
	var limiter *redis_rate.Limiter
	if rdb != nil {
		limiter = redis_rate.NewLimiter(rdb)
	}
	return &Handler{
		cfg:     cfg,
		db:      db,
		rdb:     rdb,
		limiter: limiter,
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
	var req gen.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}

	email := string(req.Email)
	var nickname string

	// Handle different registration flows. Domain verification is no longer part
	// of signup — every account starts unverified and verifies its domain later
	// from the profile.
	switch req.AccountType {
	case gen.AccountTypeUser:
		// User registration: email + nickname required
		if email == "" || req.Nickname == nil || *req.Nickname == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "email and nickname required for user registration"})
			return
		}
		nickname = *req.Nickname
	case gen.AccountTypeStartup:
		// Startup registration: name + email required
		if req.Name == nil || *req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "name is required for startup registration"})
			return
		}
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "email is required"})
			return
		}
		nickname = *req.Name
	default:
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "account_type must be user or startup"})
		return
	}

	// Validate email format
	if !isValidEmail(email) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "invalid email format"})
		return
	}

	if !h.allowOTP(c, "register", email) {
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
		logging.From(c).Error("register: create code failed", "err", err)
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
		logging.From(c).Error("failed to create registration draft", "err", err)
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
		logging.From(c).Error("failed to send verification email", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	logging.From(c).Info("registration code sent", "email", email)
	c.JSON(http.StatusAccepted, gin.H{
		"message": "verification code sent to email",
	})
}

// Verify consumes the OTP code and creates a user + session.
func (h *Handler) Verify(c *gin.Context) {
	var req gen.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}
	email := string(req.Email)
	if email == "" || req.Code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "email and code are required"})
		return
	}

	// Get registration metadata (or login flow)
	var draft models.RegistrationDraft
	draftErr := h.db.Where("email = ?", email).First(&draft).Error

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
	user, err := accounts.LinkOrCreate(h.db, email, authUserID, intent)
	if err != nil {
		switch {
		case errors.Is(err, accounts.ErrAlreadyHasProfile):
			c.JSON(http.StatusConflict, gin.H{"code": "ALREADY_HAS_PROFILE", "message": "this account already has a startup profile"})
		case errors.Is(err, accounts.ErrInvalidClaim):
			c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_CLAIM", "message": "this claim link is invalid or already used"})
		default:
			logging.From(c).Error("failed to reconcile user", "err", err)
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
		logging.From(c).Error("failed to create session", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "session creation failed"})
		return
	}

	logging.From(c).Info("user verified and logged in", "email", user.Email)

	c.JSON(http.StatusOK, h.userProfileResponse(&user))
}

// userProfileResponse builds the shared UserProfile payload returned by Verify
// and GetMe.
func (h *Handler) userProfileResponse(user *models.User) gen.UserProfile {
	id, _ := uuid.Parse(user.ID)
	return gen.UserProfile{
		Id:          id,
		AuthUserId:  user.AuthUserID,
		Email:       user.Email,
		Nickname:    user.Nickname,
		AccountType: gen.AccountType(user.AccountType),
		IsAdmin:     h.isAdmin(user.Email),
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   &user.UpdatedAt,
	}
}

// Login initiates passwordless login - sends OTP via email.
func (h *Handler) Login(c *gin.Context) {
	var req gen.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}
	email := string(req.Email)
	if !isValidEmail(email) {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "invalid email format"})
		return
	}

	if !h.allowOTP(c, "login", email) {
		return
	}

	// Check if user exists with this email
	var existingUser models.User
	if err := h.db.Where("email = ?", email).First(&existingUser).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"code": "USER_NOT_FOUND", "message": "no account found with this email"})
		return
	}

	// Create SuperTokens passwordless code
	tenantID := "public"
	codeResp, err := passwordless.CreateCodeWithEmail(tenantID, email, nil)
	if err != nil {
		logging.From(c).Error("login: create code failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create verification code"})
		return
	}

	// Store PreAuthSessionID and DeviceID in a temporary draft for login verification
	// This allows the verify endpoint to find the correct session
	draft := models.RegistrationDraft{
		Email:            email,
		Nickname:         existingUser.Nickname,
		AccountType:      existingUser.AccountType,
		PreAuthSessionID: codeResp.OK.PreAuthSessionID,
		DeviceID:         codeResp.OK.DeviceID,
	}
	h.db.Where("email = ?", email).Delete(&models.RegistrationDraft{})
	if err := h.db.Create(&draft).Error; err != nil {
		logging.From(c).Error("failed to create login draft", "err", err)
		// Non-fatal, continue with email sending
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
		logging.From(c).Error("failed to send verification email", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to send verification email"})
		return
	}

	logging.From(c).Info("login code sent", "email", email)
	c.JSON(http.StatusAccepted, gin.H{
		"message": "verification code sent to email",
	})
}

// StartClaim begins claiming an admin-seeded shell: it validates the claim
// token, sends an OTP to the email the startup provides, and stashes the token
// on a draft so Verify binds the shell to them. Works for brand-new emails and
// existing accounts alike (unlike Register, which rejects existing emails).
func (h *Handler) StartClaim(c *gin.Context) {
	var req gen.StartClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": err.Error()})
		return
	}
	email := string(req.Email)
	if !isValidEmail(email) || req.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"code": "BAD_REQUEST", "message": "valid email and token are required"})
		return
	}

	if !h.allowOTP(c, "claim", email) {
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
	if err := h.db.Where("email = ?", email).First(&existing).Error; err == nil {
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
	codeResp, err := passwordless.CreateCodeWithEmail(tenantID, email, nil)
	if err != nil {
		logging.From(c).Error("claim: create code failed", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "failed to create verification code"})
		return
	}

	draft := models.RegistrationDraft{
		Email:            email,
		Nickname:         shell.Name,
		AccountType:      models.AccountTypeStartup,
		Name:             shell.Name,
		ClaimToken:       req.Token,
		PreAuthSessionID: codeResp.OK.PreAuthSessionID,
		DeviceID:         codeResp.OK.DeviceID,
	}
	h.db.Where("email = ?", email).Delete(&models.RegistrationDraft{})
	if err := h.db.Create(&draft).Error; err != nil {
		logging.From(c).Error("failed to create claim draft", "err", err)
		c.JSON(http.StatusInternalServerError, gin.H{"code": "SERVER_ERROR", "message": "claim failed"})
		return
	}

	userInputCode := codeResp.OK.UserInputCode
	err = passwordless.SendEmail(emaildelivery.EmailType{
		PasswordlessLogin: &emaildelivery.PasswordlessLoginType{
			Email:            email,
			UserInputCode:    &userInputCode,
			UrlWithLinkCode:  nil,
			CodeLifetime:     codeResp.OK.CodeLifetime,
			PreAuthSessionId: codeResp.OK.PreAuthSessionID,
			TenantId:         tenantID,
		},
	})
	if err != nil {
		logging.From(c).Error("failed to send claim email", "err", err)
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
		logging.From(c).Error("failed to revoke session", "err", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
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

	response := h.userProfileResponse(&user)

	// Look up profile_id and logo_url for startup accounts. Only a claimed
	// profile is "theirs" — an admin's unclaimed shells never count here.
	if user.AccountType == models.AccountTypeStartup {
		var startup models.Startup
		if err := h.db.Where("owner_id = ? AND claimed = ?", user.ID, true).First(&startup).Error; err == nil {
			if pid, err := uuid.Parse(startup.ID); err == nil {
				response.ProfileId = &pid
			}
			response.LogoUrl = &startup.LogoURL
		}
	}

	c.JSON(http.StatusOK, response)
}
