package community

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

var (
	ErrCommunityNotFound = repository.ErrCommunityNotFound
	ErrUnauthorized      = errors.New("unauthorized to perform this action on community")
	ErrCommunityPending  = errors.New("community is pending admin approval")
	ErrCommunityRejected = errors.New("community was rejected by admin")
	ErrReceiptRequired   = errors.New("receipt file is required for anti-spam community creation")
	ErrInvalidInviteCode = errors.New("invalid or expired community code/id")
	ErrAlreadyMember     = repository.ErrAlreadyMember
)

type Service struct {
	commRepo repository.CommunityRepository
	chanRepo repository.ChannelRepository
}

func NewService(commRepo repository.CommunityRepository, chanRepo repository.ChannelRepository) *Service {
	return &Service{
		commRepo: commRepo,
		chanRepo: chanRepo,
	}
}

type CommunityWithChannels struct {
	database.Community
	Channels []database.Channel `json:"channels"`
}

func generateInviteCode() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// CreateRequest creates a new community in PENDING status with anti-spam receipt and R$ 15,00 minimum donation
func (s *Service) CreateRequest(ownerID, name, description, iconURL, receiptFilePath string, donationAmount int, isPrivate bool) (*database.Community, error) {
	ctx := context.Background()
	name = strings.TrimSpace(name)
	if len(name) < 3 || len(name) > 32 {
		return nil, errors.New("community name must be between 3 and 32 characters")
	}

	receiptFilePath = strings.TrimSpace(receiptFilePath)
	if receiptFilePath == "" {
		return nil, ErrReceiptRequired
	}

	if donationAmount <= 0 {
		donationAmount = 1500 // R$ 15,00 default
	}

	communityID := uuid.New().String()
	now := time.Now()

	inviteCode := ""
	if isPrivate {
		inviteCode = generateInviteCode()
	}

	comm := &database.Community{
		ID:              communityID,
		Name:            name,
		Description:     strings.TrimSpace(description),
		IconURL:         strings.TrimSpace(iconURL),
		ReceiptFilePath: receiptFilePath,
		DonationAmount:  donationAmount,
		OwnerID:         ownerID,
		Status:          database.StatusPending,
		IsPrivate:       isPrivate,
		InviteCode:      inviteCode,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.commRepo.CreateWithMemberTx(ctx, comm); err != nil {
		return nil, err
	}

	return comm, nil
}

// Update allows owner or admin to edit community name, description, icon, and privacy
func (s *Service) Update(communityID, userID string, isAdmin bool, name, description, iconURL string, isPrivate bool) (*database.Community, error) {
	ctx := context.Background()
	name = strings.TrimSpace(name)
	if len(name) < 3 || len(name) > 32 {
		return nil, errors.New("community name must be between 3 and 32 characters")
	}

	existing, err := s.commRepo.GetByID(ctx, communityID)
	if err != nil {
		return nil, err
	}

	if existing.OwnerID != userID && !isAdmin {
		return nil, ErrUnauthorized
	}

	inviteCode := existing.InviteCode
	if isPrivate && inviteCode == "" {
		inviteCode = generateInviteCode()
	}

	existing.Name = name
	existing.Description = strings.TrimSpace(description)
	if iconURL != "" {
		existing.IconURL = iconURL
	}
	existing.IsPrivate = isPrivate
	existing.InviteCode = inviteCode
	existing.UpdatedAt = time.Now()

	if err := s.commRepo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return s.commRepo.GetByID(ctx, communityID)
}

// ListApproved returns all publicly available approved communities or private ones where user is a member/owner, including their channels
func (s *Service) ListApproved(userID string, isAdmin bool) ([]CommunityWithChannels, error) {
	ctx := context.Background()
	communities, err := s.commRepo.ListApproved(ctx, userID)
	if err != nil {
		return nil, err
	}

	var list []CommunityWithChannels
	for _, comm := range communities {
		// Only expose invite code to owner or admin
		if comm.OwnerID != userID && !isAdmin {
			comm.InviteCode = ""
		}
		comm.ReceiptFilePath = ""

		channels, _ := s.chanRepo.ListByCommunity(ctx, comm.ID)
		if channels == nil {
			channels = []database.Channel{}
		}

		list = append(list, CommunityWithChannels{
			Community: comm,
			Channels:  channels,
		})
	}
	if list == nil {
		list = []CommunityWithChannels{}
	}
	return list, nil
}

// ListPending returns all pending communities for admin moderation with receipts
func (s *Service) ListPending() ([]database.Community, error) {
	ctx := context.Background()
	return s.commRepo.ListPending(ctx)
}

// GetByID returns community details with its channels if accessible
func (s *Service) GetByID(communityID, userID string, isAdmin bool) (*CommunityWithChannels, error) {
	ctx := context.Background()
	comm, err := s.commRepo.GetByID(ctx, communityID)
	if err != nil {
		return nil, err
	}

	// Only expose invite code to owner or admin
	if comm.OwnerID != userID && !isAdmin {
		comm.InviteCode = ""
	}

	// If not approved, only owner or admin can view
	if comm.Status != database.StatusApproved && comm.OwnerID != userID && !isAdmin {
		if comm.Status == database.StatusPending {
			return nil, ErrCommunityPending
		}
		return nil, ErrCommunityRejected
	}

	// Private community access check
	if comm.IsPrivate && comm.OwnerID != userID && !isAdmin {
		isMember, err := s.commRepo.IsMember(ctx, communityID, userID)
		if err != nil || !isMember {
			return nil, ErrUnauthorized
		}
	}

	channels, err := s.chanRepo.ListByCommunity(ctx, communityID)
	if err != nil {
		return nil, err
	}

	return &CommunityWithChannels{
		Community: *comm,
		Channels:  channels,
	}, nil
}

// Join adds the user to a community using either an invite code OR a community ID
func (s *Service) Join(userID, identifier string) (*database.Community, error) {
	ctx := context.Background()
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return nil, ErrInvalidInviteCode
	}

	comm, err := s.commRepo.GetByInviteCode(ctx, identifier)
	if err != nil {
		return nil, ErrInvalidInviteCode
	}

	if comm.Status != database.StatusApproved {
		return nil, ErrInvalidInviteCode
	}

	if err := s.commRepo.AddMember(ctx, comm.ID, userID); err != nil {
		// Ignore duplicate membership error
		if !strings.Contains(strings.ToLower(err.Error()), "unique") && !strings.Contains(strings.ToLower(err.Error()), "primary") {
			return nil, err
		}
	}

	return comm, nil
}

// JoinByInviteCode alias for Join
func (s *Service) JoinByInviteCode(userID, inviteCode string) (*database.Community, error) {
	return s.Join(userID, inviteCode)
}

// GetReceiptFilePath returns the file path of the receipt (Admin only)
func (s *Service) GetReceiptFilePath(communityID string) (string, error) {
	ctx := context.Background()
	return s.commRepo.GetReceiptPath(ctx, communityID)
}

// Approve sets status = APPROVED and ensures default channels exist
func (s *Service) Approve(communityID string) (*database.Community, error) {
	ctx := context.Background()
	if err := s.commRepo.Approve(ctx, communityID); err != nil {
		return nil, err
	}

	// Create default channels if none exist
	existingChannels, _ := s.chanRepo.ListByCommunity(ctx, communityID)
	if len(existingChannels) == 0 {
		_ = s.chanRepo.Create(ctx, &database.Channel{
			ID:          uuid.New().String(),
			CommunityID: communityID,
			Name:        "geral",
			Type:        database.ChannelTypeText,
			Position:    0,
		})
		_ = s.chanRepo.Create(ctx, &database.Channel{
			ID:          uuid.New().String(),
			CommunityID: communityID,
			Name:        "Voz Geral",
			Type:        database.ChannelTypeVoice,
			Position:    1,
		})
	}

	return s.commRepo.GetByID(ctx, communityID)
}

// Reject sets status = REJECTED and records the rejection reason
func (s *Service) Reject(communityID, rejectionReason string) (*database.Community, error) {
	ctx := context.Background()
	if err := s.commRepo.Reject(ctx, communityID, rejectionReason); err != nil {
		return nil, err
	}
	return s.commRepo.GetByID(ctx, communityID)
}

// Delete removes a community (Owner or Admin only)
func (s *Service) Delete(communityID, userID string, isAdmin bool) error {
	ctx := context.Background()
	comm, err := s.commRepo.GetByID(ctx, communityID)
	if err != nil {
		return err
	}

	if comm.OwnerID != userID && !isAdmin {
		return ErrUnauthorized
	}

	return s.commRepo.Delete(ctx, communityID)
}

// ListMembers returns all users for a community
func (s *Service) ListMembers(communityID, userID string, isAdmin bool) ([]database.User, error) {
	ctx := context.Background()
	members, err := s.commRepo.ListMembers(ctx, communityID)
	if err != nil {
		return nil, err
	}

	var users []database.User
	for _, m := range members {
		users = append(users, database.User{
			ID:        m.UserID,
			Username:  m.Username,
			AvatarURL: m.AvatarURL,
			IsAdmin:   m.IsAdmin,
			CreatedAt: m.JoinedAt,
		})
	}
	if users == nil {
		users = []database.User{}
	}
	return users, nil
}
