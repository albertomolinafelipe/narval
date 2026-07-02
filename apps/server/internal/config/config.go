package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port                     string
	Env                      string
	DatabaseURL              string
	RedisAddr                string
	SuperTokensConnectionURI string
	SuperTokensAPIKey        string
	MinioEndpoint            string
	MinioAccessKey           string
	MinioSecretKey           string
	MinioBucket              string
	MinioUseSSL              bool
	MinioPublicURL           string
	ResendAPIKey             string
	EmailFrom                string
	EmailFromName            string
	// Google OAuth. When both are empty the third-party recipe is not enabled,
	// so local dev works without configuring Google.
	GoogleClientID     string
	GoogleClientSecret string
	// CORSOrigins is a comma-separated list of allowed origins, e.g.
	// "http://localhost:3000,https://app.example.com"
	CORSOrigins []string
}

// insecureDefaults are values that should never be used in production
var insecureDefaults = []string{
	"",
	"admin",
	"password",
	"secret",
	"minioadmin",
	"narval",
	"narval_secret",
	"dev-secret-change-in-production",
}

func Load() *Config {
	return &Config{
		Port:                     getEnv("PORT", "8080"),
		Env:                      getEnv("ENV", "development"),
		DatabaseURL:              getEnv("DATABASE_URL", "postgres://narval:narval@localhost:5432/narval?sslmode=disable"),
		RedisAddr:                getEnv("REDIS_ADDR", "localhost:6379"),
		SuperTokensConnectionURI: getEnv("SUPERTOKENS_CONNECTION_URI", "http://localhost:3567"),
		SuperTokensAPIKey:        getEnv("SUPERTOKENS_API_KEY", ""),
		MinioEndpoint:            getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey:           getEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinioSecretKey:           getEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinioBucket:              getEnv("MINIO_BUCKET", "narval"),
		MinioUseSSL:              getEnv("MINIO_USE_SSL", "false") == "true",
		MinioPublicURL:           getEnv("MINIO_PUBLIC_URL", "http://localhost:9000"),
		ResendAPIKey:             getEnv("RESEND_API_KEY", ""),
		EmailFrom:                getEnv("EMAIL_FROM", "noreply@gonarval.com"),
		EmailFromName:            getEnv("EMAIL_FROM_NAME", "Narval"),
		GoogleClientID:           getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:       getEnv("GOOGLE_CLIENT_SECRET", ""),
		CORSOrigins:              splitCSV(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")),
	}
}

// Validate checks that all required configuration is present and secure for the given environment.
// Returns an error if running in production with missing or insecure values.
func (c *Config) Validate() error {
	if c.Env != "production" {
		return nil // Skip validation in development/test
	}

	// Required secrets that must be set and not use insecure defaults
	required := map[string]string{
		"MINIO_ACCESS_KEY": c.MinioAccessKey,
		"MINIO_SECRET_KEY": c.MinioSecretKey,
	}

	var problems []string
	for name, value := range required {
		if isInsecure(value) {
			problems = append(problems, name)
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("production environment has missing or insecure values for: %v", problems)
	}

	return nil
}

// isInsecure checks if a value matches any known insecure default
func isInsecure(value string) bool {
	for _, insecure := range insecureDefaults {
		if value == insecure {
			return true
		}
	}
	return false
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
