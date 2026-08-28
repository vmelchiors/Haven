package livekit_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"haven-backend/internal/auth"
	"haven-backend/internal/config"
	"haven-backend/internal/livekit"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupLiveKitTest(t *testing.T) (*livekit.Service, *livekit.Handler, *database.DB, *config.Config, func()) {
	tempDir, err := os.MkdirTemp("", "haven-livekit-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "livekit_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	cfg := &config.Config{
		LiveKitURL:       "http://localhost:7880",
		LiveKitAPIKey:    "devkey",
		LiveKitAPISecret: "secretkey123456789012345678901234",
	}

	// Insert test users and communities
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1', 'alice', 'hash')`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash) VALUES ('u2', 'bob', 'hash')`)
	_, _ = db.Exec(`INSERT INTO communities (id, name, owner_id, status, is_private) VALUES ('c_app', 'Approved Comm', 'u1', 'APPROVED', 0)`)
	_, _ = db.Exec(`INSERT INTO communities (id, name, owner_id, status, is_private) VALUES ('c_priv', 'Private Comm', 'u1', 'APPROVED', 1)`)
	_, _ = db.Exec(`INSERT INTO communities (id, name, owner_id, status, is_private) VALUES ('c_pen', 'Pending Comm', 'u1', 'PENDING', 0)`)

	_, _ = db.Exec(`INSERT INTO channels (id, community_id, name, type) VALUES ('ch_voice_app', 'c_app', 'Voice 1', 'VOICE')`)
	_, _ = db.Exec(`INSERT INTO channels (id, community_id, name, type) VALUES ('ch_voice_priv', 'c_priv', 'Private Voice', 'VOICE')`)
	_, _ = db.Exec(`INSERT INTO channels (id, community_id, name, type) VALUES ('ch_voice_pen', 'c_pen', 'Voice 2', 'VOICE')`)

	chanRepo := repository.NewChannelRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	svc := livekit.NewService(chanRepo, commRepo, cfg)
	handler := livekit.NewHandler(svc)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return svc, handler, db, cfg, cleanup
}

func TestGenerateToken_Direct(t *testing.T) {
	token, err := livekit.GenerateToken(
		"devkey",
		"secretkey123456789012345678901234",
		"room_test",
		"user_123",
		"Alice",
		"",
		true,
		true,
		1*time.Hour,
	)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}
	if token == "" {
		t.Errorf("expected non-empty JWT token string")
	}
}

func TestLiveKitService_GenerateChannelToken(t *testing.T) {
	svc, _, _, _, cleanup := setupLiveKitTest(t)
	defer cleanup()

	// 1. Success for public approved channel
	res, err := svc.GenerateChannelToken("u2", "bob", "ch_voice_app", false)
	if err != nil {
		t.Fatalf("GenerateChannelToken failed: %v", err)
	}
	if res.Token == "" || res.RoomName != "channel_ch_voice_app" || res.URL != "http://localhost:7880" {
		t.Errorf("unexpected token response: %+v", res)
	}

	// 2. Non-existent channel returns error
	_, err = svc.GenerateChannelToken("u2", "bob", "non_existent_channel", false)
	if err != livekit.ErrChannelNotFound {
		t.Errorf("expected ErrChannelNotFound, got %v", err)
	}

	// 3. Pending community voice channel access denied for non-admin
	_, err = svc.GenerateChannelToken("u2", "bob", "ch_voice_pen", false)
	if err != livekit.ErrAccessDenied {
		t.Errorf("expected ErrAccessDenied for pending community, got %v", err)
	}

	// 4. Pending community voice channel access allowed for admin
	resAdmin, err := svc.GenerateChannelToken("u2", "bob", "ch_voice_pen", true)
	if err != nil || resAdmin.Token == "" {
		t.Errorf("expected admin to bypass pending community restriction: %v", err)
	}

	// 5. Private community without membership access denied
	_, err = svc.GenerateChannelToken("u2", "bob", "ch_voice_priv", false)
	if err != livekit.ErrAccessDenied {
		t.Errorf("expected ErrAccessDenied for non-member in private community, got %v", err)
	}

	// 6. Owner can access private community voice channel
	resOwner, err := svc.GenerateChannelToken("u1", "alice", "ch_voice_priv", false)
	if err != nil || resOwner.Token == "" {
		t.Errorf("expected owner to access private channel: %v", err)
	}
}

func TestLiveKitHandler_GetRTCToken(t *testing.T) {
	_, handler, _, _, cleanup := setupLiveKitTest(t)
	defer cleanup()

	r := chi.NewRouter()
	r.Post("/api/channels/{id}/rtc-token", handler.GetRTCToken)

	req := httptest.NewRequest(http.MethodPost, "/api/channels/ch_voice_app/rtc-token", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{UserID: "u2", Username: "bob", IsAdmin: false}))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLiveKitHandler_Webhook(t *testing.T) {
	_, handler, _, _, cleanup := setupLiveKitTest(t)
	defer cleanup()

	r := chi.NewRouter()
	r.Post("/api/livekit/webhook", handler.HandleWebhook)

	eventBody := []byte(`{"event": "participant_joined", "room": {"name": "channel_ch_voice_app"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/livekit/webhook", bytes.NewReader(eventBody))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK from webhook, got %d", w.Code)
	}
}
