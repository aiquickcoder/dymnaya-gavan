package config

import (
	"os"
)

// Config holds runtime configuration loaded from the environment.
type Config struct {
	Port        string
	DatabaseURL string
}

// Load reads configuration from environment variables, applying defaults.
func Load() Config {
	return Config{
		Port:        env("PORT", "8080"),
		DatabaseURL: env("DATABASE_URL", "postgres://mixmaster:mixmaster@localhost:5432/mixmaster?sslmode=disable"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
