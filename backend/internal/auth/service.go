package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

var (
	ErrUserAlreadyExists  = errors.New("username already exists")
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid or expired refresh token")
)

type Service struct {
	userRepo  repository.UserRepository
	jwtSecret string
}

func NewService(userRepo repository.UserRepository, jwtSecret string) *Service {
	return &Service{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

// Register creates a new Zero-PII user with optional security question and answer
func (s *Service) Register(username, password, avatarURL, acceptedToSVersion, securityQuestion, securityAnswer string) (*database.User, *TokenPair, error) {
	ctx := context.Background()
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 32 {
		return nil, nil, errors.New("username must be between 3 and 32 characters")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, nil, err
	}

	securityQuestion = strings.TrimSpace(securityQuestion)
	securityAnswer = strings.ToLower(strings.TrimSpace(securityAnswer))
	var securityAnswerHash string
	if securityAnswer != "" {
		securityAnswerHash, err = HashSecurityAnswer(securityAnswer)
		if err != nil {
			return nil, nil, err
		}
	}

	// Check if this is the first user in system -> make admin
	count, _ := s.userRepo.Count(ctx)
	isAdmin := count == 0

	userID := uuid.New().String()
	now := time.Now()

	user := &database.User{
		ID:                 userID,
		Username:           username,
		PasswordHash:       hash,
		AvatarURL:          avatarURL,
		IsAdmin:            isAdmin,
		AcceptedToSVersion: acceptedToSVersion,
		SecurityQuestion:   securityQuestion,
		SecurityAnswerHash: securityAnswerHash,
		CreatedAt:          now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return nil, nil, ErrUserAlreadyExists
		}
		return nil, nil, fmt.Errorf("failed to insert user: %w", err)
	}

	tokens, err := s.generateTokensForUser(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Login verifies credentials and generates tokens
func (s *Service) Login(username, password string) (*database.User, *TokenPair, error) {
	ctx := context.Background()
	username = strings.TrimSpace(username)

	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, nil, ErrInvalidCredentials
		}
		return nil, nil, fmt.Errorf("failed to query user: %w", err)
	}

	if !CheckPassword(password, user.PasswordHash) {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, err := s.generateTokensForUser(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// Refresh validates an opaque refresh token, revokes it (rotation), and generates a new token pair
func (s *Service) Refresh(rawRefreshToken string) (*database.User, *TokenPair, error) {
	ctx := context.Background()
	tokenHash := HashOpaqueToken(rawRefreshToken)

	rt, err := s.userRepo.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		return nil, nil, ErrInvalidToken
	}

	if rt.Revoked || time.Now().After(rt.ExpiresAt) {
		return nil, nil, ErrInvalidToken
	}

	user, err := s.userRepo.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, nil, ErrInvalidToken
	}

	// Revoke old refresh token (Token Rotation)
	_ = s.userRepo.RevokeRefreshToken(ctx, rt.ID)

	// Generate new token pair
	tokens, err := s.generateTokensForUser(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// AcceptToS updates the user's accepted ToS version
func (s *Service) AcceptToS(userID, version string) error {
	ctx := context.Background()
	if err := s.userRepo.UpdateToSVersion(ctx, userID, version); err != nil {
		return fmt.Errorf("failed to update tos: %w", err)
	}
	return nil
}

// GetUserByID retrieves a user by ID
func (s *Service) GetUserByID(userID string) (*database.User, error) {
	ctx := context.Background()
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

func (s *Service) generateTokensForUser(user *database.User) (*TokenPair, error) {
	accessToken, err := GenerateAccessToken(user.ID, user.Username, user.IsAdmin, user.AcceptedToSVersion, s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	rawRefresh, refreshHash, err := GenerateOpaqueRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	refreshTokenID := uuid.New().String()
	expiresAt := time.Now().Add(RefreshTokenDuration)

	token := &database.RefreshToken{
		ID:        refreshTokenID,
		UserID:    user.ID,
		TokenHash: refreshHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
		Revoked:   false,
	}

	if err := s.userRepo.SaveRefreshToken(context.Background(), token); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		ExpiresIn:    int64(AccessTokenDuration.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

// UpdateProfile updates user username and/or password
func (s *Service) UpdateProfile(userID, newUsername, currentPassword, newPassword string) (*database.User, *TokenPair, error) {
	ctx := context.Background()
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, nil, ErrUserNotFound
	}

	newUsername = strings.TrimSpace(newUsername)
	if newUsername != "" && newUsername != user.Username {
		if len(newUsername) < 3 || len(newUsername) > 32 {
			return nil, nil, errors.New("nome de usuário deve ter entre 3 e 32 caracteres")
		}
		// Check if username is already taken
		existingUser, err := s.userRepo.GetByUsername(ctx, newUsername)
		if err == nil && existingUser != nil && existingUser.ID != userID {
			return nil, nil, ErrUserAlreadyExists
		}
		if err := s.userRepo.UpdateProfile(ctx, userID, newUsername); err != nil {
			return nil, nil, err
		}
		user.Username = newUsername
	}

	if newPassword != "" {
		if len(newPassword) < 6 {
			return nil, nil, errors.New("a nova senha deve ter no mínimo 6 caracteres")
		}
		if currentPassword == "" {
			return nil, nil, errors.New("senha atual é obrigatória para alterar a senha")
		}
		if !CheckPassword(currentPassword, user.PasswordHash) {
			return nil, nil, ErrInvalidCredentials
		}
		newHash, err := HashPassword(newPassword)
		if err != nil {
			return nil, nil, err
		}
		if err := s.userRepo.UpdatePassword(ctx, userID, newHash); err != nil {
			return nil, nil, err
		}
	}

	tokens, err := s.generateTokensForUser(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}

// GetSecurityQuestion retrieves the security question for a given username
func (s *Service) GetSecurityQuestion(username string) (string, error) {
	ctx := context.Background()
	username = strings.TrimSpace(username)
	if username == "" {
		return "", errors.New("nome de usuário é obrigatório")
	}

	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return "", ErrUserNotFound
		}
		return "", fmt.Errorf("failed to query security question: %w", err)
	}

	if user.SecurityQuestion == "" || user.SecurityAnswerHash == "" {
		return "", errors.New("este usuário não possui pergunta de recuperação configurada")
	}

	return user.SecurityQuestion, nil
}

// ResetPasswordWithSecurityAnswer verifies the security answer and resets the user's password
func (s *Service) ResetPasswordWithSecurityAnswer(username, answer, newPassword string) (*database.User, *TokenPair, error) {
	ctx := context.Background()
	username = strings.TrimSpace(username)
	if username == "" {
		return nil, nil, errors.New("nome de usuário é obrigatório")
	}

	answer = strings.ToLower(strings.TrimSpace(answer))
	if answer == "" {
		return nil, nil, errors.New("resposta de segurança é obrigatória")
	}

	if len(newPassword) < 6 {
		return nil, nil, errors.New("a nova senha deve ter no mínimo 6 caracteres")
	}

	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, nil, ErrUserNotFound
		}
		return nil, nil, fmt.Errorf("failed to query user: %w", err)
	}

	if user.SecurityAnswerHash == "" {
		return nil, nil, errors.New("este usuário não possui pergunta de recuperação configurada")
	}

	if !CheckPassword(answer, user.SecurityAnswerHash) {
		return nil, nil, errors.New("resposta de segurança incorreta")
	}

	newHash, err := HashPassword(newPassword)
	if err != nil {
		return nil, nil, err
	}

	if err := s.userRepo.UpdatePassword(ctx, user.ID, newHash); err != nil {
		return nil, nil, fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all existing refresh tokens for security
	_ = s.userRepo.RevokeUserRefreshTokens(ctx, user.ID)

	tokens, err := s.generateTokensForUser(user)
	if err != nil {
		return nil, nil, err
	}

	return user, tokens, nil
}
