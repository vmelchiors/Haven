package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"haven-backend/pkg/database"
)

var (
	ErrFeedbackNotFound = errors.New("feedback report not found")
)

type FeedbackRepository interface {
	Create(ctx context.Context, fb *database.Feedback) error
	List(ctx context.Context, statusFilter, typeFilter string) ([]database.Feedback, error)
	GetByID(ctx context.Context, id string) (*database.Feedback, error)
	Update(ctx context.Context, id, status, adminNotes string) error
	Delete(ctx context.Context, id string) error
}

type sqlFeedbackRepository struct {
	db *database.DB
}

func NewFeedbackRepository(db *database.DB) FeedbackRepository {
	return &sqlFeedbackRepository{db: db}
}

func (r *sqlFeedbackRepository) Create(ctx context.Context, fb *database.Feedback) error {
	query := `
		INSERT INTO feedback (id, user_id, type, title, description, status, admin_notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query,
		fb.ID,
		fb.UserID,
		fb.Type,
		fb.Title,
		fb.Description,
		fb.Status,
		fb.AdminNotes,
		fb.CreatedAt,
		fb.UpdatedAt,
	)
	return err
}

func (r *sqlFeedbackRepository) List(ctx context.Context, statusFilter, typeFilter string) ([]database.Feedback, error) {
	statusFilter = strings.ToUpper(strings.TrimSpace(statusFilter))
	typeFilter = strings.ToUpper(strings.TrimSpace(typeFilter))

	var conditions []string
	var args []interface{}

	if statusFilter != "" && statusFilter != "ALL" {
		conditions = append(conditions, "f.status = ?")
		args = append(args, statusFilter)
	}

	if typeFilter != "" && typeFilter != "ALL" {
		conditions = append(conditions, "f.type = ?")
		args = append(args, typeFilter)
	}

	query := `
		SELECT f.id, f.user_id, COALESCE(u.username, ''), f.type, f.title, f.description, f.status, COALESCE(f.admin_notes, ''), f.created_at, f.updated_at
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY f.created_at DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query feedback: %w", err)
	}
	defer rows.Close()

	var list []database.Feedback
	for rows.Next() {
		var fb database.Feedback
		var username, adminNotes sql.NullString
		if err := rows.Scan(
			&fb.ID,
			&fb.UserID,
			&username,
			&fb.Type,
			&fb.Title,
			&fb.Description,
			&fb.Status,
			&adminNotes,
			&fb.CreatedAt,
			&fb.UpdatedAt,
		); err != nil {
			return nil, err
		}
		fb.Username = username.String
		fb.AdminNotes = adminNotes.String
		list = append(list, fb)
	}
	if list == nil {
		list = []database.Feedback{}
	}
	return list, nil
}

func (r *sqlFeedbackRepository) GetByID(ctx context.Context, id string) (*database.Feedback, error) {
	query := `
		SELECT f.id, f.user_id, COALESCE(u.username, ''), f.type, f.title, f.description, f.status, COALESCE(f.admin_notes, ''), f.created_at, f.updated_at
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
		WHERE f.id = ?
	`
	var fb database.Feedback
	var username, adminNotes sql.NullString
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&fb.ID,
		&fb.UserID,
		&username,
		&fb.Type,
		&fb.Title,
		&fb.Description,
		&fb.Status,
		&adminNotes,
		&fb.CreatedAt,
		&fb.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrFeedbackNotFound
		}
		return nil, fmt.Errorf("failed to get feedback by id: %w", err)
	}
	fb.Username = username.String
	fb.AdminNotes = adminNotes.String
	return &fb, nil
}

func (r *sqlFeedbackRepository) Update(ctx context.Context, id, status, adminNotes string) error {
	now := time.Now()
	var err error
	if status != "" {
		_, err = r.db.ExecContext(ctx, "UPDATE feedback SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?", status, strings.TrimSpace(adminNotes), now, id)
	} else {
		_, err = r.db.ExecContext(ctx, "UPDATE feedback SET admin_notes = ?, updated_at = ? WHERE id = ?", strings.TrimSpace(adminNotes), now, id)
	}
	return err
}

func (r *sqlFeedbackRepository) Delete(ctx context.Context, id string) error {
	res, err := r.db.ExecContext(ctx, "DELETE FROM feedback WHERE id = ?", id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrFeedbackNotFound
	}
	return nil
}
