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
	ErrCommunityNotFound = errors.New("community not found")
	ErrAlreadyMember     = errors.New("user is already a member of this community")
)

type CommunityMember struct {
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	IsOwner   bool      `json:"is_owner"`
	IsAdmin   bool      `json:"is_admin"`
	JoinedAt  time.Time `json:"joined_at"`
}

type CommunityRepository interface {
	CreateWithMemberTx(ctx context.Context, comm *database.Community) error
	GetByID(ctx context.Context, id string) (*database.Community, error)
	GetByInviteCode(ctx context.Context, inviteCode string) (*database.Community, error)
	Update(ctx context.Context, comm *database.Community) error
	Delete(ctx context.Context, id string) error
	ListApproved(ctx context.Context, userID string) ([]database.Community, error)
	ListPending(ctx context.Context) ([]database.Community, error)
	AddMember(ctx context.Context, communityID, userID string) error
	RemoveMember(ctx context.Context, communityID, userID string) error
	IsMember(ctx context.Context, communityID, userID string) (bool, error)
	ListMembers(ctx context.Context, communityID string) ([]CommunityMember, error)
	GetReceiptPath(ctx context.Context, communityID string) (string, error)
	Approve(ctx context.Context, id string) error
	Reject(ctx context.Context, id, reason string) error
}

type sqlCommunityRepository struct {
	db *database.DB
}

func NewCommunityRepository(db *database.DB) CommunityRepository {
	return &sqlCommunityRepository{db: db}
}

func (r *sqlCommunityRepository) CreateWithMemberTx(ctx context.Context, comm *database.Community) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	query := `
		INSERT INTO communities (id, name, description, icon_url, receipt_file_path, donation_amount, owner_id, status, is_private, invite_code, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = tx.ExecContext(ctx, query,
		comm.ID,
		comm.Name,
		comm.Description,
		comm.IconURL,
		comm.ReceiptFilePath,
		comm.DonationAmount,
		comm.OwnerID,
		comm.Status,
		comm.IsPrivate,
		comm.InviteCode,
		comm.CreatedAt,
		comm.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert community: %w", err)
	}

	// Insert owner into community_members
	memberQuery := `INSERT INTO community_members (community_id, user_id, created_at) VALUES (?, ?, ?)`
	_, err = tx.ExecContext(ctx, memberQuery, comm.ID, comm.OwnerID, comm.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert community owner member: %w", err)
	}

	return tx.Commit()
}

func (r *sqlCommunityRepository) GetByID(ctx context.Context, id string) (*database.Community, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description, ''), COALESCE(c.icon_url, ''), c.receipt_file_path,
		       c.donation_amount, c.owner_id, u.username, c.status, COALESCE(c.rejection_reason, ''),
		       c.is_private, COALESCE(c.invite_code, ''), c.created_at, c.updated_at
		FROM communities c
		JOIN users u ON u.id = c.owner_id
		WHERE c.id = ?
	`
	var comm database.Community
	var isPrivateInt int
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&comm.ID,
		&comm.Name,
		&comm.Description,
		&comm.IconURL,
		&comm.ReceiptFilePath,
		&comm.DonationAmount,
		&comm.OwnerID,
		&comm.OwnerUsername,
		&comm.Status,
		&comm.RejectionReason,
		&isPrivateInt,
		&comm.InviteCode,
		&comm.CreatedAt,
		&comm.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCommunityNotFound
		}
		return nil, fmt.Errorf("failed to get community by id: %w", err)
	}
	comm.IsPrivate = isPrivateInt == 1
	return &comm, nil
}

func (r *sqlCommunityRepository) GetByInviteCode(ctx context.Context, inviteCode string) (*database.Community, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description, ''), COALESCE(c.icon_url, ''), c.receipt_file_path,
		       c.donation_amount, c.owner_id, u.username, c.status, COALESCE(c.rejection_reason, ''),
		       c.is_private, COALESCE(c.invite_code, ''), c.created_at, c.updated_at
		FROM communities c
		JOIN users u ON u.id = c.owner_id
		WHERE (c.invite_code = ? AND c.invite_code != '') OR c.id = ?
	`
	var comm database.Community
	var isPrivateInt int
	err := r.db.QueryRowContext(ctx, query, inviteCode, inviteCode).Scan(
		&comm.ID,
		&comm.Name,
		&comm.Description,
		&comm.IconURL,
		&comm.ReceiptFilePath,
		&comm.DonationAmount,
		&comm.OwnerID,
		&comm.OwnerUsername,
		&comm.Status,
		&comm.RejectionReason,
		&isPrivateInt,
		&comm.InviteCode,
		&comm.CreatedAt,
		&comm.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCommunityNotFound
		}
		return nil, fmt.Errorf("failed to get community by invite code: %w", err)
	}
	comm.IsPrivate = isPrivateInt == 1
	return &comm, nil
}

func (r *sqlCommunityRepository) Update(ctx context.Context, comm *database.Community) error {
	query := `
		UPDATE communities
		SET name = ?, description = ?, icon_url = ?, is_private = ?, invite_code = ?, updated_at = ?
		WHERE id = ?
	`
	isPrivateInt := 0
	if comm.IsPrivate {
		isPrivateInt = 1
	}
	_, err := r.db.ExecContext(ctx, query,
		comm.Name,
		comm.Description,
		comm.IconURL,
		isPrivateInt,
		comm.InviteCode,
		comm.UpdatedAt,
		comm.ID,
	)
	return err
}

func (r *sqlCommunityRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM communities WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *sqlCommunityRepository) ListApproved(ctx context.Context, userID string) ([]database.Community, error) {
	query := `
		SELECT DISTINCT c.id, c.name, COALESCE(c.description, ''), COALESCE(c.icon_url, ''), c.donation_amount,
		                c.owner_id, u.username, c.status, c.is_private, COALESCE(c.invite_code, ''), c.created_at, c.updated_at
		FROM communities c
		JOIN users u ON u.id = c.owner_id
		LEFT JOIN community_members cm ON cm.community_id = c.id
		WHERE c.status = 'APPROVED'
		  AND (c.is_private = 0 OR c.owner_id = ? OR cm.user_id = ?)
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list approved communities: %w", err)
	}
	defer rows.Close()

	var list []database.Community
	for rows.Next() {
		var comm database.Community
		var isPrivateInt int
		err := rows.Scan(
			&comm.ID,
			&comm.Name,
			&comm.Description,
			&comm.IconURL,
			&comm.DonationAmount,
			&comm.OwnerID,
			&comm.OwnerUsername,
			&comm.Status,
			&isPrivateInt,
			&comm.InviteCode,
			&comm.CreatedAt,
			&comm.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan community: %w", err)
		}
		comm.IsPrivate = isPrivateInt == 1
		list = append(list, comm)
	}
	if list == nil {
		list = []database.Community{}
	}
	return list, nil
}

func (r *sqlCommunityRepository) ListPending(ctx context.Context) ([]database.Community, error) {
	query := `
		SELECT c.id, c.name, COALESCE(c.description, ''), COALESCE(c.icon_url, ''), c.receipt_file_path,
		       c.donation_amount, c.owner_id, u.username, c.status, COALESCE(c.rejection_reason, ''),
		       c.is_private, COALESCE(c.invite_code, ''), c.created_at, c.updated_at
		FROM communities c
		JOIN users u ON u.id = c.owner_id
		WHERE c.status = 'PENDING'
		ORDER BY c.created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list pending communities: %w", err)
	}
	defer rows.Close()

	var list []database.Community
	for rows.Next() {
		var comm database.Community
		var isPrivateInt int
		err := rows.Scan(
			&comm.ID,
			&comm.Name,
			&comm.Description,
			&comm.IconURL,
			&comm.ReceiptFilePath,
			&comm.DonationAmount,
			&comm.OwnerID,
			&comm.OwnerUsername,
			&comm.Status,
			&comm.RejectionReason,
			&isPrivateInt,
			&comm.InviteCode,
			&comm.CreatedAt,
			&comm.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pending community: %w", err)
		}
		comm.IsPrivate = isPrivateInt == 1
		list = append(list, comm)
	}
	if list == nil {
		list = []database.Community{}
	}
	return list, nil
}

func (r *sqlCommunityRepository) AddMember(ctx context.Context, communityID, userID string) error {
	query := `INSERT INTO community_members (community_id, user_id, created_at) VALUES (?, ?, ?)`
	_, err := r.db.ExecContext(ctx, query, communityID, userID, time.Now())
	return err
}

func (r *sqlCommunityRepository) RemoveMember(ctx context.Context, communityID, userID string) error {
	query := `DELETE FROM community_members WHERE community_id = ? AND user_id = ?`
	_, err := r.db.ExecContext(ctx, query, communityID, userID)
	return err
}

func (r *sqlCommunityRepository) IsMember(ctx context.Context, communityID, userID string) (bool, error) {
	query := `SELECT COUNT(*) FROM community_members WHERE community_id = ? AND user_id = ?`
	var count int
	err := r.db.QueryRowContext(ctx, query, communityID, userID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *sqlCommunityRepository) ListMembers(ctx context.Context, communityID string) ([]CommunityMember, error) {
	query := `
		SELECT u.id, u.username, COALESCE(u.avatar_url, ''), (c.owner_id = u.id) as is_owner,
		       u.is_admin, cm.created_at
		FROM community_members cm
		JOIN communities c ON c.id = cm.community_id
		JOIN users u ON u.id = cm.user_id
		WHERE cm.community_id = ?
		ORDER BY is_owner DESC, u.username ASC
	`
	rows, err := r.db.QueryContext(ctx, query, communityID)
	if err != nil {
		return nil, fmt.Errorf("failed to list community members: %w", err)
	}
	defer rows.Close()

	var members []CommunityMember
	for rows.Next() {
		var m CommunityMember
		if err := rows.Scan(&m.UserID, &m.Username, &m.AvatarURL, &m.IsOwner, &m.IsAdmin, &m.JoinedAt); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if members == nil {
		members = []CommunityMember{}
	}
	return members, nil
}

func (r *sqlCommunityRepository) GetReceiptPath(ctx context.Context, communityID string) (string, error) {
	query := `SELECT receipt_file_path FROM communities WHERE id = ?`
	var path string
	err := r.db.QueryRowContext(ctx, query, communityID).Scan(&path)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrCommunityNotFound
		}
		return "", err
	}
	return path, nil
}

func (r *sqlCommunityRepository) Approve(ctx context.Context, id string) error {
	query := `UPDATE communities SET status = 'APPROVED', updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, time.Now(), id)
	return err
}

func (r *sqlCommunityRepository) Reject(ctx context.Context, id, reason string) error {
	query := `UPDATE communities SET status = 'REJECTED', rejection_reason = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, reason, time.Now(), id)
	return err
}
