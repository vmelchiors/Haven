package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"haven-backend/pkg/database"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("username already exists")
	ErrTokenNotFound     = errors.New("refresh token not found")
)

type UserRepository interface {
	Create(ctx context.Context, user *database.User) error
	GetByID(ctx context.Context, id string) (*database.User, error)
	GetByUsername(ctx context.Context, username string) (*database.User, error)
	Count(ctx context.Context) (int, error)
	UpdateProfile(ctx context.Context, id, username string) error
	UpdateAvatar(ctx context.Context, id, avatarURL string) error
	UpdateToSVersion(ctx context.Context, id, version string) error
	UpdatePassword(ctx context.Context, id, passwordHash string) error
	
	// Refresh token operations
	SaveRefreshToken(ctx context.Context, token *database.RefreshToken) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*database.RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, id string) error
	RevokeUserRefreshTokens(ctx context.Context, userID string) error
}

type sqlUserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) UserRepository {
	return &sqlUserRepository{db: db}
}

func (r *sqlUserRepository) Create(ctx context.Context, user *database.User) error {
	query := `
		INSERT INTO users (id, username, password_hash, avatar_url, is_admin, accepted_tos_version, security_question, security_answer_hash, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.AvatarURL,
		user.IsAdmin,
		user.AcceptedToSVersion,
		user.SecurityQuestion,
		user.SecurityAnswerHash,
		user.CreatedAt,
	)
	if err != nil {
		return err
	}
	return nil
}

func (r *sqlUserRepository) GetByID(ctx context.Context, id string) (*database.User, error) {
	query := `
		SELECT id, username, password_hash, COALESCE(avatar_url, ''), is_admin, accepted_tos_version, security_question, security_answer_hash, created_at
		FROM users
		WHERE id = ?
	`
	var u database.User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID,
		&u.Username,
		&u.PasswordHash,
		&u.AvatarURL,
		&u.IsAdmin,
		&u.AcceptedToSVersion,
		&u.SecurityQuestion,
		&u.SecurityAnswerHash,
		&u.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}
	return &u, nil
}

func (r *sqlUserRepository) GetByUsername(ctx context.Context, username string) (*database.User, error) {
	query := `
		SELECT id, username, password_hash, COALESCE(avatar_url, ''), is_admin, accepted_tos_version, security_question, security_answer_hash, created_at
		FROM users
		WHERE username = ?
	`
	var u database.User
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&u.ID,
		&u.Username,
		&u.PasswordHash,
		&u.AvatarURL,
		&u.IsAdmin,
		&u.AcceptedToSVersion,
		&u.SecurityQuestion,
		&u.SecurityAnswerHash,
		&u.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	return &u, nil
}

func (r *sqlUserRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return count, nil
}

func (r *sqlUserRepository) UpdateProfile(ctx context.Context, id, username string) error {
	query := `UPDATE users SET username = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, username, id)
	return err
}

func (r *sqlUserRepository) UpdateAvatar(ctx context.Context, id, avatarURL string) error {
	query := `UPDATE users SET avatar_url = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, avatarURL, id)
	return err
}

func (r *sqlUserRepository) UpdateToSVersion(ctx context.Context, id, version string) error {
	query := `UPDATE users SET accepted_tos_version = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, version, id)
	return err
}

func (r *sqlUserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	query := `UPDATE users SET password_hash = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, passwordHash, id)
	return err
}

func (r *sqlUserRepository) SaveRefreshToken(ctx context.Context, token *database.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, revoked)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		token.ID,
		token.UserID,
		token.TokenHash,
		token.ExpiresAt,
		token.CreatedAt,
		token.Revoked,
	)
	return err
}

func (r *sqlUserRepository) GetRefreshToken(ctx context.Context, tokenHash string) (*database.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, created_at, revoked
		FROM refresh_tokens
		WHERE token_hash = ? AND revoked = FALSE AND expires_at > ?
	`
	var t database.RefreshToken
	err := r.db.QueryRowContext(ctx, query, tokenHash, time.Now()).Scan(
		&t.ID,
		&t.UserID,
		&t.TokenHash,
		&t.ExpiresAt,
		&t.CreatedAt,
		&t.Revoked,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTokenNotFound
		}
		return nil, fmt.Errorf("failed to get refresh token: %w", err)
	}
	return &t, nil
}

func (r *sqlUserRepository) RevokeRefreshToken(ctx context.Context, id string) error {
	query := `UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *sqlUserRepository) RevokeUserRefreshTokens(ctx context.Context, userID string) error {
	query := `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ?`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}
