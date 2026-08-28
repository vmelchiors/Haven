package channel

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

var (
	ErrChannelNotFound    = repository.ErrChannelNotFound
	ErrCommunityNotFound  = repository.ErrCommunityNotFound
	ErrUnauthorized       = errors.New("unauthorized to modify this channel")
	ErrAccessDenied       = errors.New("access denied to this channel")
	ErrInvalidChannelType = errors.New("invalid channel type (must be TEXT or VOICE)")
)

type Service struct {
	chanRepo repository.ChannelRepository
	commRepo repository.CommunityRepository
	msgRepo  repository.MessageRepository
}

func NewService(chanRepo repository.ChannelRepository, commRepo repository.CommunityRepository, msgRepo repository.MessageRepository) *Service {
	return &Service{
		chanRepo: chanRepo,
		commRepo: commRepo,
		msgRepo:  msgRepo,
	}
}

// Create creates a new TEXT or VOICE channel inside an approved community (Owner or Admin only)
func (s *Service) Create(communityID, name string, chType database.ChannelType, position int, userID string, isAdmin bool) (*database.Channel, error) {
	ctx := context.Background()
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("channel name cannot be empty")
	}

	if chType != database.ChannelTypeText && chType != database.ChannelTypeVoice {
		return nil, ErrInvalidChannelType
	}

	// Verify community exists and user is owner or admin
	comm, err := s.commRepo.GetByID(ctx, communityID)
	if err != nil {
		return nil, err
	}

	if comm.OwnerID != userID && !isAdmin {
		return nil, ErrUnauthorized
	}

	if comm.Status != database.StatusApproved && comm.OwnerID != userID && !isAdmin {
		return nil, ErrAccessDenied
	}

	chID := uuid.New().String()
	ch := &database.Channel{
		ID:          chID,
		CommunityID: communityID,
		Name:        name,
		Type:        chType,
		Position:    position,
	}

	if err := s.chanRepo.Create(ctx, ch); err != nil {
		return nil, err
	}

	return ch, nil
}

// ListByCommunity returns all channels in a community accessible to the user
func (s *Service) ListByCommunity(communityID, userID string, isAdmin bool) ([]database.Channel, error) {
	ctx := context.Background()
	comm, err := s.commRepo.GetByID(ctx, communityID)
	if err != nil {
		return nil, err
	}

	if comm.Status != database.StatusApproved && comm.OwnerID != userID && !isAdmin {
		return nil, ErrAccessDenied
	}

	return s.chanRepo.ListByCommunity(ctx, communityID)
}

// GetByID returns channel details if user has permission
func (s *Service) GetByID(channelID, userID string, isAdmin bool) (*database.Channel, error) {
	ctx := context.Background()
	info, err := s.chanRepo.GetWithCommunityInfo(ctx, channelID)
	if err != nil {
		return nil, err
	}

	if info.CommunityStatus != database.StatusApproved && info.CommunityOwnerID != userID && !isAdmin {
		return nil, ErrAccessDenied
	}

	if info.IsCommunityPrivate && info.CommunityOwnerID != userID && !isAdmin {
		isMember, err := s.commRepo.IsMember(ctx, info.Channel.CommunityID, userID)
		if err != nil || !isMember {
			return nil, ErrAccessDenied
		}
	}

	return &info.Channel, nil
}

// Delete removes a channel (Community Owner or Admin only)
func (s *Service) Delete(channelID, userID string, isAdmin bool) error {
	ctx := context.Background()
	info, err := s.chanRepo.GetWithCommunityInfo(ctx, channelID)
	if err != nil {
		return err
	}

	if info.CommunityOwnerID != userID && !isAdmin {
		return ErrUnauthorized
	}

	return s.chanRepo.Delete(ctx, channelID)
}

// GetMessageHistory returns cursor-paginated messages for a text channel
func (s *Service) GetMessageHistory(channelID, beforeID string, limit int, userID string, isAdmin bool) ([]database.Message, error) {
	ctx := context.Background()
	// Verify access
	_, err := s.GetByID(channelID, userID, isAdmin)
	if err != nil {
		return nil, err
	}

	return s.msgRepo.GetHistory(ctx, channelID, beforeID, limit)
}
