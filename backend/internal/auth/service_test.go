package auth_test

import (
	"os"
	"path/filepath"
	"testing"

	"haven-backend/internal/auth"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupTestDB(t *testing.T) (*database.DB, func()) {
	tempDir, err := os.MkdirTemp("", "haven-auth-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "auth_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return db, cleanup
}

func TestAuthService_RegisterAndLogin(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	svc := auth.NewService(userRepo, "test_secret_123")

	// First user registered should be admin
	u1, tokens1, err := svc.Register("admin_user", "password123", "", "v1.0.0", "Qual seu pet?", "Rex")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if !u1.IsAdmin {
		t.Errorf("expected first user to be admin")
	}
	if tokens1.AccessToken == "" || tokens1.RefreshToken == "" {
		t.Errorf("expected tokens to be returned on registration")
	}

	// Second user registered should NOT be admin
	u2, tokens2, err := svc.Register("normal_user", "password456", "/uploads/avatar1.png", "v1.0.0", "", "")
	if err != nil {
		t.Fatalf("Register 2nd user failed: %v", err)
	}
	if u2.IsAdmin {
		t.Errorf("expected second user to NOT be admin")
	}
	if tokens2.AccessToken == "" {
		t.Errorf("expected access token")
	}

	// Register with duplicate username should fail
	_, _, err = svc.Register("normal_user", "different_pass", "", "v1.0.0", "", "")
	if err != auth.ErrUserAlreadyExists {
		t.Errorf("expected ErrUserAlreadyExists, got %v", err)
	}

	// Login with correct credentials
	loggedUser, loggedTokens, err := svc.Login("admin_user", "password123")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if loggedUser.ID != u1.ID {
		t.Errorf("expected logged user ID %s, got %s", u1.ID, loggedUser.ID)
	}
	if loggedTokens.AccessToken == "" {
		t.Errorf("expected access token on login")
	}

	// Login with incorrect password
	_, _, err = svc.Login("admin_user", "wrong_password")
	if err != auth.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials for wrong password, got %v", err)
	}

	// Login with non-existent username
	_, _, err = svc.Login("unknown_user", "password")
	if err != auth.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials for non-existent user, got %v", err)
	}
}

func TestAuthService_RefreshTokenRotation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	svc := auth.NewService(userRepo, "test_secret_123")

	_, tokens, err := svc.Register("rot_user", "password123", "", "v1.0.0", "", "")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	oldRefreshToken := tokens.RefreshToken

	// Perform refresh
	user, newTokens, err := svc.Refresh(oldRefreshToken)
	if err != nil {
		t.Fatalf("Refresh failed: %v", err)
	}
	if user.Username != "rot_user" {
		t.Errorf("expected username rot_user, got %s", user.Username)
	}
	if newTokens.RefreshToken == oldRefreshToken {
		t.Errorf("expected new refresh token to be rotated")
	}

	// Attempting to reuse old revoked refresh token should fail
	_, _, err = svc.Refresh(oldRefreshToken)
	if err != auth.ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken when reusing revoked refresh token, got %v", err)
	}
}

func TestAuthService_AcceptToSAndGetUser(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	svc := auth.NewService(userRepo, "test_secret_123")

	user, _, err := svc.Register("tos_user", "password123", "", "", "", "")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	if user.AcceptedToSVersion != "" {
		t.Errorf("expected initial accepted_tos_version to be empty, got %s", user.AcceptedToSVersion)
	}

	err = svc.AcceptToS(user.ID, "v1.2.0")
	if err != nil {
		t.Fatalf("AcceptToS failed: %v", err)
	}

	updatedUser, err := svc.GetUserByID(user.ID)
	if err != nil {
		t.Fatalf("GetUserByID failed: %v", err)
	}
	if updatedUser.AcceptedToSVersion != "v1.2.0" {
		t.Errorf("expected updated version v1.2.0, got %s", updatedUser.AcceptedToSVersion)
	}
}

func TestAuthService_RecoveryQuestionAndReset(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	svc := auth.NewService(userRepo, "test_secret_123")

	// Register user with security question
	_, _, err := svc.Register("rec_user", "oldpassword123", "", "v1.0.0", "Qual seu pet?", "Rex ")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	// Retrieve security question
	q, err := svc.GetSecurityQuestion("rec_user")
	if err != nil {
		t.Fatalf("GetSecurityQuestion failed: %v", err)
	}
	if q != "Qual seu pet?" {
		t.Errorf("expected question 'Qual seu pet?', got '%s'", q)
	}

	// Reset with incorrect answer should fail
	_, _, err = svc.ResetPasswordWithSecurityAnswer("rec_user", "WrongAnswer", "newpassword123")
	if err == nil || err.Error() != "resposta de segurança incorreta" {
		t.Errorf("expected 'resposta de segurança incorreta', got %v", err)
	}

	// Reset with correct answer (case-insensitive and trimmed)
	user, tokens, err := svc.ResetPasswordWithSecurityAnswer("rec_user", "rex", "newpassword123")
	if err != nil {
		t.Fatalf("ResetPasswordWithSecurityAnswer failed: %v", err)
	}
	if user.Username != "rec_user" {
		t.Errorf("expected username rec_user, got %s", user.Username)
	}
	if tokens.AccessToken == "" {
		t.Errorf("expected tokens returned on password reset")
	}

	// Verify login with new password works
	_, _, err = svc.Login("rec_user", "newpassword123")
	if err != nil {
		t.Fatalf("Login with new password failed: %v", err)
	}

	// Login with old password should fail
	_, _, err = svc.Login("rec_user", "oldpassword123")
	if err != auth.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials with old password, got %v", err)
	}
}
