package livekit

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// VideoGrant represents the LiveKit video grant permissions
type VideoGrant struct {
	Room           string `json:"room,omitempty"`
	RoomJoin       bool   `json:"roomJoin,omitempty"`
	RoomList       bool   `json:"roomList,omitempty"`
	RoomRecord     bool   `json:"roomRecord,omitempty"`
	RoomAdmin      bool   `json:"roomAdmin,omitempty"`
	RoomCreate     bool   `json:"roomCreate,omitempty"`
	CanPublish     *bool  `json:"canPublish,omitempty"`
	CanSubscribe   *bool  `json:"canSubscribe,omitempty"`
	CanPublishData *bool  `json:"canPublishData,omitempty"`
	Hidden         bool   `json:"hidden,omitempty"`
	Recorder       bool   `json:"recorder,omitempty"`
}

// LiveKitClaims represents the JWT claims for LiveKit SFU
type LiveKitClaims struct {
	Video    *VideoGrant `json:"video,omitempty"`
	Name     string      `json:"name,omitempty"`
	Metadata string      `json:"metadata,omitempty"`
	Sha256   string      `json:"sha256,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken creates an access token for LiveKit SFU
func GenerateToken(apiKey, apiSecret, roomName, identity, name, metadata string, canPublish, canSubscribe bool, ttl time.Duration) (string, error) {
	if apiKey == "" || apiSecret == "" {
		return "", fmt.Errorf("livekit api key and secret are required")
	}

	if ttl <= 0 {
		ttl = 6 * time.Hour
	}

	now := time.Now()
	pub := canPublish
	sub := canSubscribe
	data := true

	grant := &VideoGrant{
		Room:           roomName,
		RoomJoin:       true,
		CanPublish:     &pub,
		CanSubscribe:   &sub,
		CanPublishData: &data,
	}

	claims := LiveKitClaims{
		Video:    grant,
		Name:     name,
		Metadata: metadata,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    apiKey,
			Subject:   identity,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(apiSecret))
}
