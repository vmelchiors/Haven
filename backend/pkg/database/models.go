package database

import (
	"time"
)

// User represents a zero-PII user account
type User struct {
	ID                 string    `json:"id"`
	Username           string    `json:"username"`
	PasswordHash       string    `json:"-"`
	AvatarURL          string    `json:"avatar_url,omitempty"`
	IsAdmin            bool      `json:"is_admin"`
	AcceptedToSVersion string    `json:"accepted_tos_version"`
	SecurityQuestion   string    `json:"security_question,omitempty"`
	SecurityAnswerHash string    `json:"-"`
	CreatedAt          time.Time `json:"created_at"`
}

// RefreshToken represents a secure opaque refresh token stored in DB
type RefreshToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	Revoked   bool      `json:"revoked"`
}

// CommunityStatus represents the status in the moderation queue
type CommunityStatus string

const (
	StatusPending  CommunityStatus = "PENDING"
	StatusApproved CommunityStatus = "APPROVED"
	StatusRejected CommunityStatus = "REJECTED"
)

// Community represents a user group/server with anti-spam receipt and donation amount
type Community struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description,omitempty"`
	IconURL         string          `json:"icon_url,omitempty"`
	ReceiptFilePath string          `json:"receipt_file_path,omitempty"`
	DonationAmount  int             `json:"donation_amount"` // in cents: 1500 = R$ 15,00
	OwnerID         string          `json:"owner_id"`
	OwnerUsername   string          `json:"owner_username,omitempty"`
	Status          CommunityStatus `json:"status"`
	RejectionReason string          `json:"rejection_reason,omitempty"`
	IsPrivate       bool            `json:"is_private"`
	InviteCode      string          `json:"invite_code,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// ChannelType represents TEXT or VOICE
type ChannelType string

const (
	ChannelTypeText  ChannelType = "TEXT"
	ChannelTypeVoice ChannelType = "VOICE"
)

// Channel represents a chat or audio/video room in a community
type Channel struct {
	ID          string      `json:"id"`
	CommunityID string      `json:"community_id"`
	Name        string      `json:"name"`
	Type        ChannelType `json:"type"`
	Position    int         `json:"position"`
}

// Message represents a text chat message with cursor pagination
type Message struct {
	ID          string    `json:"id"`
	ChannelID   string    `json:"channel_id"`
	CommunityID string    `json:"community_id,omitempty"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username,omitempty"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	Content     string    `json:"content"`
	CreatedAt   time.Time `json:"created_at"`
}

// FeedbackType represents BUG or SUGGESTION
type FeedbackType string

const (
	FeedbackTypeBug        FeedbackType = "BUG"
	FeedbackTypeSuggestion FeedbackType = "SUGGESTION"
)

// FeedbackStatus represents status of the report
type FeedbackStatus string

const (
	FeedbackStatusOpen       FeedbackStatus = "OPEN"
	FeedbackStatusInProgress FeedbackStatus = "IN_PROGRESS"
	FeedbackStatusResolved   FeedbackStatus = "RESOLVED"
	FeedbackStatusClosed     FeedbackStatus = "CLOSED"
)

// Feedback represents a user submitted bug report or feature suggestion
type Feedback struct {
	ID          string         `json:"id"`
	UserID      string         `json:"user_id"`
	Username    string         `json:"username,omitempty"`
	Type        FeedbackType   `json:"type"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Status      FeedbackStatus `json:"status"`
	AdminNotes  string         `json:"admin_notes,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

