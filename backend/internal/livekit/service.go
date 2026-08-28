package livekit

import (
	"context"
	"errors"
	"fmt"
	"time"

	"haven-backend/internal/config"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

var (
	ErrChannelNotFound = repository.ErrChannelNotFound
	ErrAccessDenied    = errors.New("access denied to this channel")
)

type Service struct {
	chanRepo repository.ChannelRepository
	commRepo repository.CommunityRepository
	config   *config.Config
}

func NewService(chanRepo repository.ChannelRepository, commRepo repository.CommunityRepository, cfg *config.Config) *Service {
	return &Service{
		chanRepo: chanRepo,
		commRepo: commRepo,
		config:   cfg,
	}
}

type RTCAccessTokenResponse struct {
	Token    string `json:"token"`
	URL      string `json:"url"`
	RoomName string `json:"room_name"`
}

// GenerateChannelToken generates a LiveKit token for a specific channel
func (s *Service) GenerateChannelToken(userID, username, channelID string, isAdmin bool) (*RTCAccessTokenResponse, error) {
	ctx := context.Background()
	info, err := s.chanRepo.GetWithCommunityInfo(ctx, channelID)
	if err != nil {
		return nil, ErrChannelNotFound
	}

	// Unapproved communities cannot be accessed via RTC
	if info.CommunityStatus != database.StatusApproved && !isAdmin {
		return nil, ErrAccessDenied
	}

	// Privacy filter: Private communities require membership, owner, or admin
	if info.IsCommunityPrivate && info.CommunityOwnerID != userID && !isAdmin {
		isMember, err := s.commRepo.IsMember(ctx, info.Channel.CommunityID, userID)
		if err != nil || !isMember {
			return nil, ErrAccessDenied
		}
	}

	roomName := fmt.Sprintf("channel_%s", channelID)
	token, err := GenerateToken(
		s.config.LiveKitAPIKey,
		s.config.LiveKitAPISecret,
		roomName,
		userID,
		username,
		"",
		true,
		true,
		6*time.Hour,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to generate livekit token: %w", err)
	}

	return &RTCAccessTokenResponse{
		Token:    token,
		URL:      s.config.LiveKitURL,
		RoomName: roomName,
	}, nil
}
