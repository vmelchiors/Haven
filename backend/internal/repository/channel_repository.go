package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"haven-backend/pkg/database"
)

var (
	ErrChannelNotFound = errors.New("channel not found")
)

type ChannelWithCommunityInfo struct {
	Channel            database.Channel
	CommunityOwnerID   string
	CommunityStatus    database.CommunityStatus
	IsCommunityPrivate bool
}

type ChannelRepository interface {
	Create(ctx context.Context, ch *database.Channel) error
	GetByID(ctx context.Context, id string) (*database.Channel, error)
	GetWithCommunityInfo(ctx context.Context, id string) (*ChannelWithCommunityInfo, error)
	ListByCommunity(ctx context.Context, communityID string) ([]database.Channel, error)
	Delete(ctx context.Context, id string) error
	GetCommunityID(ctx context.Context, channelID string) (string, error)
}

type sqlChannelRepository struct {
	db *database.DB
}

func NewChannelRepository(db *database.DB) ChannelRepository {
	return &sqlChannelRepository{db: db}
}

func (r *sqlChannelRepository) Create(ctx context.Context, ch *database.Channel) error {
	query := `INSERT INTO channels (id, community_id, name, type, position) VALUES (?, ?, ?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, ch.ID, ch.CommunityID, ch.Name, ch.Type, ch.Position)
	return err
}

func (r *sqlChannelRepository) GetByID(ctx context.Context, id string) (*database.Channel, error) {
	query := `SELECT id, community_id, name, type, position FROM channels WHERE id = ?`
	var ch database.Channel
	err := r.db.QueryRowContext(ctx, query, id).Scan(&ch.ID, &ch.CommunityID, &ch.Name, &ch.Type, &ch.Position)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrChannelNotFound
		}
		return nil, fmt.Errorf("failed to get channel: %w", err)
	}
	return &ch, nil
}

func (r *sqlChannelRepository) GetWithCommunityInfo(ctx context.Context, id string) (*ChannelWithCommunityInfo, error) {
	query := `
		SELECT c.id, c.community_id, c.name, c.type, c.position, com.owner_id, com.status, com.is_private
		FROM channels c
		JOIN communities com ON com.id = c.community_id
		WHERE c.id = ?
	`
	var info ChannelWithCommunityInfo
	var isPrivateInt int
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&info.Channel.ID,
		&info.Channel.CommunityID,
		&info.Channel.Name,
		&info.Channel.Type,
		&info.Channel.Position,
		&info.CommunityOwnerID,
		&info.CommunityStatus,
		&isPrivateInt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrChannelNotFound
		}
		return nil, fmt.Errorf("failed to get channel with community info: %w", err)
	}
	info.IsCommunityPrivate = isPrivateInt == 1
	return &info, nil
}

func (r *sqlChannelRepository) ListByCommunity(ctx context.Context, communityID string) ([]database.Channel, error) {
	query := `
		SELECT id, community_id, name, type, position
		FROM channels
		WHERE community_id = ?
		ORDER BY position ASC, name ASC
	`
	rows, err := r.db.QueryContext(ctx, query, communityID)
	if err != nil {
		return nil, fmt.Errorf("failed to list channels by community: %w", err)
	}
	defer rows.Close()

	var list []database.Channel
	for rows.Next() {
		var ch database.Channel
		if err := rows.Scan(&ch.ID, &ch.CommunityID, &ch.Name, &ch.Type, &ch.Position); err != nil {
			return nil, err
		}
		list = append(list, ch)
	}
	if list == nil {
		list = []database.Channel{}
	}
	return list, nil
}

func (r *sqlChannelRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM channels WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *sqlChannelRepository) GetCommunityID(ctx context.Context, channelID string) (string, error) {
	query := `SELECT community_id FROM channels WHERE id = ?`
	var commID string
	err := r.db.QueryRowContext(ctx, query, channelID).Scan(&commID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrChannelNotFound
		}
		return "", err
	}
	return commID, nil
}
