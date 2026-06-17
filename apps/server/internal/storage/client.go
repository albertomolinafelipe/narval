package storage

import (
	"context"
	"io"
)

// Interface defines the contract for blob storage operations (e.g., S3, MinIO).
// The concrete implementation is *Client.
type Interface interface {
	UploadLogo(ctx context.Context, objectName string, r io.Reader, size int64, contentType string) (string, error)
}
