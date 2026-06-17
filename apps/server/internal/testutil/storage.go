package testutil

import (
	"context"
	"io"
)

// FakeStorage satisfies the StorageClient interface used by startups and
// investors handlers without requiring a real MinIO instance.
type FakeStorage struct{}

// UploadLogo returns a deterministic fake URL based on the object name.
func (f *FakeStorage) UploadLogo(_ context.Context, objectName string, _ io.Reader, _ int64, _ string) (string, error) {
	return "http://minio/narval/" + objectName, nil
}
