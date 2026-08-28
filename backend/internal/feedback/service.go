package feedback

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

var (
	ErrFeedbackNotFound = repository.ErrFeedbackNotFound
	ErrInvalidType      = errors.New("invalid feedback type (must be BUG or SUGGESTION)")
	ErrInvalidStatus    = errors.New("invalid feedback status (must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED)")
	ErrEmptyTitle       = errors.New("title cannot be empty")
	ErrEmptyDescription = errors.New("description cannot be empty")
)

type Service struct {
	fbRepo repository.FeedbackRepository
}

func NewService(fbRepo repository.FeedbackRepository) *Service {
	return &Service{fbRepo: fbRepo}
}

// Create inserts a new user-submitted feedback (BUG or SUGGESTION)
func (s *Service) Create(userID, fType, title, description string) (*database.Feedback, error) {
	ctx := context.Background()
	fType = strings.ToUpper(strings.TrimSpace(fType))
	if fType != string(database.FeedbackTypeBug) && fType != string(database.FeedbackTypeSuggestion) {
		return nil, ErrInvalidType
	}

	title = strings.TrimSpace(title)
	if title == "" {
		return nil, ErrEmptyTitle
	}
	if len(title) > 120 {
		return nil, errors.New("title must not exceed 120 characters")
	}

	description = strings.TrimSpace(description)
	if description == "" {
		return nil, ErrEmptyDescription
	}

	now := time.Now()
	fb := &database.Feedback{
		ID:          uuid.New().String(),
		UserID:      userID,
		Type:        database.FeedbackType(fType),
		Title:       title,
		Description: description,
		Status:      database.FeedbackStatusOpen,
		AdminNotes:  "",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.fbRepo.Create(ctx, fb); err != nil {
		return nil, err
	}

	return fb, nil
}

// List returns all feedback reports for administrators, with optional type and status filtering
func (s *Service) List(statusFilter, typeFilter string) ([]database.Feedback, error) {
	ctx := context.Background()
	return s.fbRepo.List(ctx, statusFilter, typeFilter)
}

// UpdateStatus updates the status and/or admin notes for a feedback report
func (s *Service) UpdateStatus(id, status, adminNotes string) (*database.Feedback, error) {
	ctx := context.Background()
	status = strings.ToUpper(strings.TrimSpace(status))
	validStatuses := map[string]bool{
		string(database.FeedbackStatusOpen):       true,
		string(database.FeedbackStatusInProgress): true,
		string(database.FeedbackStatusResolved):   true,
		string(database.FeedbackStatusClosed):     true,
	}
	if status != "" && !validStatuses[status] {
		return nil, ErrInvalidStatus
	}

	if err := s.fbRepo.Update(ctx, id, status, adminNotes); err != nil {
		return nil, err
	}

	return s.GetByID(id)
}

// GetByID returns a single feedback report
func (s *Service) GetByID(id string) (*database.Feedback, error) {
	ctx := context.Background()
	return s.fbRepo.GetByID(ctx, id)
}

// Delete removes a feedback report (Admin only)
func (s *Service) Delete(id string) error {
	ctx := context.Background()
	return s.fbRepo.Delete(ctx, id)
}
