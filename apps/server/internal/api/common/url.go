package common

import (
	"net/url"
	"strings"
)

// NormalizeWebsite converts a raw URL string into a normalized hostname
// (lowercase hostname, no scheme, no "www.") for consistent storage and comparison.
// It handles URLs with or without a scheme.
func NormalizeWebsite(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "https://" + rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	host := strings.ToLower(u.Hostname())
	host = strings.TrimPrefix(host, "www.")
	return host
}

// ExtractDomain parses a URL and returns just the hostname (e.g. "acme.com").
// It handles URLs with or without a scheme.
func ExtractDomain(rawURL string) string {
	if rawURL == "" {
		return ""
	}
	if !strings.Contains(rawURL, "://") {
		rawURL = "https://" + rawURL
	}
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	host := u.Hostname()
	host = strings.TrimPrefix(host, "www.")
	return host
}
