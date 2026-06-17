package common

import "strings"

// IsDuplicateKeyError checks if an error is a database unique constraint violation.
// Works with PostgreSQL, MySQL, and SQLite error messages.
func IsDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "UNIQUE constraint failed")
}
