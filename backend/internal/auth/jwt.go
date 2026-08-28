package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	AccessTokenDuration  = 24 * time.Hour
	RefreshTokenDuration = 30 * 24 * time.Hour
)

type contextKey string

const (
	UserContextKey contextKey = "user_claims"
)

type Claims struct {
	UserID             string `json:"user_id"`
	Username           string `json:"username"`
	IsAdmin            bool   `json:"is_admin"`
	AcceptedToSVersion string `json:"accepted_tos_version"`
	jwt.RegisteredClaims
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // in seconds
	TokenType    string `json:"token_type"`
}

// GenerateAccessToken generates a short-lived JWT access token (15 mins)
func GenerateAccessToken(userID, username string, isAdmin bool, acceptedToSVersion, secret string) (string, error) {
	claims := Claims{
		UserID:             userID,
		Username:           username,
		IsAdmin:            isAdmin,
		AcceptedToSVersion: acceptedToSVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID,
			Issuer:    "haven-auth",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateAccessToken parses and validates a JWT token string
func ValidateAccessToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// GenerateOpaqueRefreshToken generates a secure crypto-random opaque string
func GenerateOpaqueRefreshToken() (rawToken string, tokenHash string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", fmt.Errorf("failed to generate random token: %w", err)
	}

	rawToken = hex.EncodeToString(bytes)
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash = hex.EncodeToString(hash[:])
	return rawToken, tokenHash, nil
}

// HashOpaqueToken calculates the sha256 hex string for a raw refresh token
func HashOpaqueToken(rawToken string) string {
	hash := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(hash[:])
}
