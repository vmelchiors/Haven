package config

import (
	"os"
)

type Config struct {
	Port              string
	DBPath            string
	JWTSecret         string
	LiveKitURL        string
	LiveKitAPIKey     string
	LiveKitAPISecret  string
	ToSCurrentVersion string
	PixKey            string
	PixMerchantName   string
	PixMerchantCity   string
	UploadDir         string
	ReceiptsDir       string
}

func Load() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		DBPath:            getEnv("DB_PATH", "haven.db"),
		JWTSecret:         getEnv("JWT_SECRET", "haven_jwt_secret_dev_key_super_secure"),
		LiveKitURL:        getEnv("LIVEKIT_URL", "http://localhost:7880"),
		LiveKitAPIKey:     getEnv("LIVEKIT_API_KEY", "haven_key"),
		LiveKitAPISecret:  getEnv("LIVEKIT_API_SECRET", "haven_secret_change_me"),
		ToSCurrentVersion: getEnv("TOS_CURRENT_VERSION", "v1.0.0"),
		PixKey:            getEnv("PIX_KEY", "haven@domain.org"),
		PixMerchantName:   getEnv("PIX_RECEIVER_NAME", getEnv("PIX_MERCHANT_NAME", "Haven Project")),
		PixMerchantCity:   getEnv("PIX_RECEIVER_CITY", getEnv("PIX_MERCHANT_CITY", "Manaus")),
		UploadDir:         getEnv("UPLOAD_DIR", "./uploads"),
		ReceiptsDir:       getEnv("RECEIPTS_PATH", "./receipts"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
