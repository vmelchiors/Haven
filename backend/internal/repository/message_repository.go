package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"haven-backend/pkg/database"
)

var (
	ErrMessageNotFound = errors.New("message not found")
)

type MessageRepository interface {
	Create(ctx context.Context, msg *database.Message) error
	GetByID(ctx context.Context, id string) (*database.Message, error)
	GetHistory(ctx context.Context, channelID, beforeID string, limit int) ([]database.Message, error)
}

type sqlMessageRepository struct {
	db *database.DB
}

func NewMessageRepository(db *database.DB) MessageRepository {
	return &sqlMessageRepository{db: db}
}

func (r *sqlMessageRepository) Create(ctx context.Context, msg *database.Message) error {
	query := `
		INSERT INTO messages (id, channel_id, user_id, content, created_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query, msg.ID, msg.ChannelID, msg.UserID, msg.Content, msg.CreatedAt)
	return err
}

func (r *sqlMessageRepository) GetByID(ctx context.Context, id string) (*database.Message, error) {
	query := `
		SELECT m.id, m.channel_id, c.community_id, m.user_id, u.username, COALESCE(u.avatar_url, ''), m.content, m.created_at
		FROM messages m
		JOIN channels c ON c.id = m.channel_id
		JOIN users u ON u.id = m.user_id
		WHERE m.id = ?
	`
	var msg database.Message
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&msg.ID,
		&msg.ChannelID,
		&msg.CommunityID,
		&msg.UserID,
		&msg.Username,
		&msg.AvatarURL,
		&msg.Content,
		&msg.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrMessageNotFound
		}
		return nil, fmt.Errorf("failed to get message: %w", err)
	}
	return &msg, nil
}

func (r *sqlMessageRepository) GetHistory(ctx context.Context, channelID, beforeID string, limit int) ([]database.Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT m.id, m.channel_id, c.community_id, m.user_id, u.username, COALESCE(u.avatar_url, ''), m.content, m.created_at
		FROM messages m
		JOIN channels c ON c.id = m.channel_id
		JOIN users u ON u.id = m.user_id
		WHERE m.channel_id = ?
		  AND (? = '' OR m.created_at < (SELECT created_at FROM messages WHERE id = ?))
		ORDER BY m.created_at DESC
		LIMIT ?
	`
	rows, err := r.db.QueryContext(ctx, query, channelID, beforeID, beforeID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query message history: %w", err)
	}
	defer rows.Close()

	var messages []database.Message
	for rows.Next() {
		var msg database.Message
		if err := rows.Scan(
			&msg.ID,
			&msg.ChannelID,
			&msg.CommunityID,
			&msg.UserID,
			&msg.Username,
			&msg.AvatarURL,
			&msg.Content,
			&msg.CreatedAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	if messages == nil {
		messages = []database.Message{}
	}

	// Reverse to ascending chronological order for client display
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}
