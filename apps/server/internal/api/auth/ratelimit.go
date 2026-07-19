package auth

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis_rate/v10"

	"github.com/narval/server/internal/logging"
)

// OTP-sending endpoints each dispatch an email per call, so they are throttled
// on two axes: per email address (protects a specific inbox from being flooded
// and throttles account enumeration) and per client IP (caps spray across many
// addresses from one source).
var (
	otpPerEmail = redis_rate.Limit{Rate: 3, Burst: 3, Period: 15 * time.Minute}
	otpPerIP    = redis_rate.Limit{Rate: 15, Burst: 15, Period: time.Hour}
)

// allowOTP enforces the OTP rate limits for the given endpoint/email. It returns
// true when the request may proceed; when a limit is hit it writes a 429 (with a
// Retry-After header) and returns false. If no limiter is configured (no Redis),
// it fails open so auth still works.
func (h *Handler) allowOTP(c *gin.Context, endpoint, email string) bool {
	if h.limiter == nil {
		return true
	}
	ctx := c.Request.Context()
	checks := []struct {
		key   string
		limit redis_rate.Limit
	}{
		{fmt.Sprintf("otp:%s:email:%s", endpoint, email), otpPerEmail},
		{fmt.Sprintf("otp:%s:ip:%s", endpoint, c.ClientIP()), otpPerIP},
	}

	for _, ch := range checks {
		res, err := h.limiter.Allow(ctx, ch.key, ch.limit)
		if err != nil {
			// Redis unavailable — fail open rather than lock users out.
			logging.From(c).Error("rate limiter error", "key", ch.key, "err", err)
			return true
		}
		if res.Allowed == 0 {
			retryAfter := res.RetryAfter
			if retryAfter < time.Second {
				retryAfter = time.Second
			}
			c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"code":    "RATE_LIMITED",
				"message": "too many requests, please try again later",
			})
			return false
		}
	}
	return true
}
