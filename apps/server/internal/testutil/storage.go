package testutil

import (
	"context"
	"io"
	"strings"
)

// fakeBaseURL is the prefix FakeStorage uses for object URLs.
const fakeBaseURL = "http://minio/narval/"

// FakeStorage satisfies the StorageClient interface used by startups and
// investors handlers without requiring a real MinIO instance. It records the
// object names passed to Delete so tests can assert on cleanup.
type FakeStorage struct {
	Deleted []string
}

// UploadLogo returns a deterministic fake URL based on the object name.
func (f *FakeStorage) UploadLogo(_ context.Context, objectName string, _ io.Reader, _ int64, _ string) (string, error) {
	return fakeBaseURL + objectName, nil
}

// Delete records the deleted object name.
func (f *FakeStorage) Delete(_ context.Context, objectName string) error {
	f.Deleted = append(f.Deleted, objectName)
	return nil
}

// ObjectNameFromURL strips the fake base URL, mirroring the real client.
func (f *FakeStorage) ObjectNameFromURL(rawURL string) (string, bool) {
	name, ok := strings.CutPrefix(rawURL, fakeBaseURL)
	if !ok || name == "" {
		return "", false
	}
	return name, true
}
