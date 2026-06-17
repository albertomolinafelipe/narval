package cache

import (
	"context"

	"github.com/redis/go-redis/v9"

	"github.com/narval/server/internal/config"
)

// New returns a connected Redis client using the address from cfg.
// The caller should call Close() when done.
func New(cfg *config.Config) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return rdb, nil
}
