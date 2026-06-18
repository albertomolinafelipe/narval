package common

import (
	"net/url"
	"strings"

	"golang.org/x/net/publicsuffix"
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

// IsRootDomain returns true if domain is an apex/root domain (not a subdomain).
// Uses the public suffix list so example.co.uk is accepted but app.example.com is not.
func IsRootDomain(domain string) bool {
	root, err := publicsuffix.EffectiveTLDPlusOne(domain)
	if err != nil {
		return false
	}
	return root == domain
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
