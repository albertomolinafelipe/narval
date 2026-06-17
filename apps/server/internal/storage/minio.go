package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/narval/server/internal/config"
)

// Client wraps the MinIO SDK client.
type Client struct {
	minio     *minio.Client
	bucket    string
	publicURL string
}

// New creates a new MinIO client and ensures the target bucket exists.
func New(cfg *config.Config) (*Client, error) {
	mc, err := minio.New(cfg.MinioEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinioAccessKey, cfg.MinioSecretKey, ""),
		Secure: cfg.MinioUseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio new client: %w", err)
	}

	ctx := context.Background()
	exists, err := mc.BucketExists(ctx, cfg.MinioBucket)
	if err != nil {
		return nil, fmt.Errorf("minio bucket exists: %w", err)
	}
	if !exists {
		if err := mc.MakeBucket(ctx, cfg.MinioBucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio make bucket: %w", err)
		}
		// Make bucket publicly readable so logo URLs work without pre-signing.
		policy := fmt.Sprintf(`{
			"Version":"2012-10-17",
			"Statement":[{
				"Effect":"Allow",
				"Principal":"*",
				"Action":["s3:GetObject"],
				"Resource":["arn:aws:s3:::%s/*"]
			}]
		}`, cfg.MinioBucket)
		if err := mc.SetBucketPolicy(ctx, cfg.MinioBucket, policy); err != nil {
			return nil, fmt.Errorf("minio set bucket policy: %w", err)
		}
	}

	return &Client{
		minio:     mc,
		bucket:    cfg.MinioBucket,
		publicURL: cfg.MinioPublicURL,
	}, nil
}

// UploadLogo uploads an image from r and returns the public URL.
func (c *Client) UploadLogo(ctx context.Context, objectName string, r io.Reader, size int64, contentType string) (string, error) {
	_, err := c.minio.PutObject(ctx, c.bucket, objectName, r, size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("minio put object: %w", err)
	}
	return c.PublicURL(objectName), nil
}

// PublicURL returns the direct public URL for an object.
func (c *Client) PublicURL(objectName string) string {
	return fmt.Sprintf("%s/%s/%s", c.publicURL, c.bucket, objectName)
}

// PresignedURL returns a temporary pre-signed GET URL for an object (fallback for private buckets).
func (c *Client) PresignedURL(ctx context.Context, objectName string, expiry time.Duration) (string, error) {
	u, err := c.minio.PresignedGetObject(ctx, c.bucket, objectName, expiry, url.Values{})
	if err != nil {
		return "", fmt.Errorf("minio presign: %w", err)
	}
	return u.String(), nil
}
