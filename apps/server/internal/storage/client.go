package storage

import (
	"context"
	"io"
)

// Interface defines the contract for blob storage operations (e.g., S3, MinIO).
// The concrete implementation is *Client.
type Interface interface {
	UploadLogo(ctx context.Context, objectName string, r io.Reader, size int64, contentType string) (string, error)
	// Delete removes an object by name. Deleting a missing object is not an error.
	Delete(ctx context.Context, objectName string) error
	// ObjectNameFromURL maps a stored public URL back to its object name. ok is
	// false when the URL isn't under this store's public base (e.g. an external
	// image), so callers never delete objects they don't own.
	ObjectNameFromURL(rawURL string) (objectName string, ok bool)
}
