package auth_test

import (
	"strings"
	"testing"

	"haven-backend/internal/auth"
)

func TestHashPassword_Argon2id(t *testing.T) {
	password := "SecurePassword123!"

	hash, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Errorf("expected hash to start with '$argon2id$', got %s", hash)
	}

	// Verify correct password
	if !auth.CheckPassword(password, hash) {
		t.Errorf("CheckPassword returned false for correct password")
	}

	// Verify incorrect password
	if auth.CheckPassword("WrongPassword123!", hash) {
		t.Errorf("CheckPassword returned true for incorrect password")
	}
}

func TestHashPassword_ShortPassword(t *testing.T) {
	_, err := auth.HashPassword("123")
	if err == nil {
		t.Errorf("expected error for password shorter than 6 chars")
	}
}

func TestHashPassword_Bcrypt(t *testing.T) {
	password := "BcryptPassword456!"

	hash, err := auth.HashPasswordBcrypt(password)
	if err != nil {
		t.Fatalf("HashPasswordBcrypt failed: %v", err)
	}

	if !strings.HasPrefix(hash, "$2a$") {
		t.Errorf("expected bcrypt hash prefix, got %s", hash)
	}

	// Verify correct password
	if !auth.CheckPassword(password, hash) {
		t.Errorf("CheckPassword returned false for bcrypt hash")
	}

	// Verify incorrect password
	if auth.CheckPassword("BadPassword", hash) {
		t.Errorf("CheckPassword returned true for incorrect password with bcrypt")
	}
}
