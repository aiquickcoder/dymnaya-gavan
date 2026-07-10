package config

import (
	"os"
)

// Config holds runtime configuration loaded from the environment.
type Config struct {
	Port        string
	DatabaseURL string

	// FCM (staff-app push). When FCMCredentialsFile is empty, push is disabled
	// (NoopSender) and the server still runs. FCMProjectID overrides the project
	// id from the service-account file when set.
	FCMCredentialsFile string
	FCMProjectID       string
}

// Load reads configuration from environment variables, applying defaults.
func Load() Config {
	return Config{
		Port:               env("PORT", "8080"),
		DatabaseURL:        env("DATABASE_URL", "postgres://mixmaster:mixmaster@localhost:5432/mixmaster?sslmode=disable"),
		FCMCredentialsFile: env("FCM_CREDENTIALS_FILE", ""),
		FCMProjectID:       env("FCM_PROJECT_ID", ""),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
