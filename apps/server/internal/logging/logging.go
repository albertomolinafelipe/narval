// Package logging wires structured logging (log/slog) into the HTTP stack.
// A per-request logger carrying a request ID is stored on both the gin context
// and the underlying request context, so handlers and any context-aware helper
// can log lines that correlate to a single request.
package logging

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequestIDHeader is the request/response header carrying the correlation ID.
const RequestIDHeader = "X-Request-ID"

type ctxKey int

const loggerKey ctxKey = iota

// ginLoggerKey is the gin.Context key for the per-request logger.
const ginLoggerKey = "logger"

// Setup configures the default slog logger: JSON in production, human-readable
// text elsewhere. It returns the logger and also installs it as slog's default.
func Setup(env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: slog.LevelInfo}
	var handler slog.Handler
	if env == "production" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	logger := slog.New(handler)
	slog.SetDefault(logger)
	return logger
}

// Middleware assigns each request a correlation ID (honoring an inbound
// X-Request-ID), exposes a request-scoped logger on the context, and emits one
// structured access-log line per request.
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.NewString()
		}
		c.Header(RequestIDHeader, id)

		reqLogger := slog.Default().With("request_id", id)
		c.Set(ginLoggerKey, reqLogger)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), loggerKey, reqLogger))

		start := time.Now()
		c.Next()

		reqLogger.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"client_ip", c.ClientIP(),
		)
	}
}

// From returns the request-scoped logger stored on the gin context, falling
// back to the default logger when none is present (e.g. outside the middleware).
func From(c *gin.Context) *slog.Logger {
	if v, ok := c.Get(ginLoggerKey); ok {
		if l, ok := v.(*slog.Logger); ok {
			return l
		}
	}
	return slog.Default()
}

// FromContext returns the request-scoped logger stored on a standard context,
// for helpers that receive a context.Context rather than a gin.Context.
func FromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}
