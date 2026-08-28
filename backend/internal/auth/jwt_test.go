package auth_test

import (
	"testing"

	"haven-backend/internal/auth"
)

func TestJWT_GenerateAndValidate(t *testing.T) {
	secret := "test_jwt_secret_key_12345"
	userID := "user_abc_123"
	username := "haven_user"
	isAdmin := true
	tosVersion := "v1.0.0"

	tokenStr, err := auth.GenerateAccessToken(userID, username, isAdmin, tosVersion, secret)
	if err != nil {
		t.Fatalf("GenerateAccessToken failed: %v", err)
	}

	claims, err := auth.ValidateAccessToken(tokenStr, secret)
	if err != nil {
		t.Fatalf("ValidateAccessToken failed: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, claims.UserID)
	}
	if claims.Username != username {
		t.Errorf("expected Username %s, got %s", username, claims.Username)
	}
	if claims.IsAdmin != isAdmin {
		t.Errorf("expected IsAdmin %v, got %v", isAdmin, claims.IsAdmin)
	}
	if claims.AcceptedToSVersion != tosVersion {
		t.Errorf("expected AcceptedToSVersion %s, got %s", tosVersion, claims.AcceptedToSVersion)
	}

	// Validate with wrong secret must fail
	_, err = auth.ValidateAccessToken(tokenStr, "wrong_secret_key")
	if err == nil {
		t.Errorf("expected validation to fail with wrong secret")
	}
}

func TestOpaqueRefreshToken(t *testing.T) {
	raw1, hash1, err := auth.GenerateOpaqueRefreshToken()
	if err != nil {
		t.Fatalf("GenerateOpaqueRefreshToken failed: %v", err)
	}

	raw2, hash2, err := auth.GenerateOpaqueRefreshToken()
	if err != nil {
		t.Fatalf("GenerateOpaqueRefreshToken failed: %v", err)
	}

	if raw1 == raw2 {
		t.Errorf("expected distinct raw tokens")
	}
	if hash1 == hash2 {
		t.Errorf("expected distinct token hashes")
	}

	// Verify HashOpaqueToken reproduces same hash
	calculatedHash := auth.HashOpaqueToken(raw1)
	if calculatedHash != hash1 {
		t.Errorf("expected hash %s, got %s", hash1, calculatedHash)
	}
}
