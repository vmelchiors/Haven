package channel_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"haven-backend/internal/auth"
	"haven-backend/internal/channel"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupChannelTest(t *testing.T) (*channel.Service, *channel.Handler, *database.DB, func()) {
	tempDir, err := os.MkdirTemp("", "haven-chan-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "chan_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	// Insert test users and approved community
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_owner', 'owner', 'hash', 0)`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_member', 'member', 'hash', 0)`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_admin', 'admin', 'hash', 1)`)

	_, _ = db.Exec(`INSERT INTO communities (id, name, owner_id, status) VALUES ('c_test', 'Dev Haven', 'u_owner', 'APPROVED')`)

	chanRepo := repository.NewChannelRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	msgRepo := repository.NewMessageRepository(db)

	svc := channel.NewService(chanRepo, commRepo, msgRepo)
	handler := channel.NewHandler(svc)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return svc, handler, db, cleanup
}

func TestChannelService_CRUD(t *testing.T) {
	svc, _, _, cleanup := setupChannelTest(t)
	defer cleanup()

	// 1. Create TEXT channel as Owner
	chText, err := svc.Create("c_test", "general", database.ChannelTypeText, 0, "u_owner", false)
	if err != nil {
		t.Fatalf("Create TEXT channel failed: %v", err)
	}
	if chText.Name != "general" || chText.Type != database.ChannelTypeText {
		t.Errorf("unexpected channel properties")
	}

	// 2. Create VOICE channel as Admin
	chVoice, err := svc.Create("c_test", "Voice Lounge", database.ChannelTypeVoice, 1, "u_admin", true)
	if err != nil {
		t.Fatalf("Create VOICE channel failed: %v", err)
	}
	if chVoice.Name != "Voice Lounge" || chVoice.Type != database.ChannelTypeVoice {
		t.Errorf("unexpected channel properties")
	}

	// 3. Unauthorized non-owner/non-admin cannot create channel
	_, err = svc.Create("c_test", "hacked", database.ChannelTypeText, 2, "u_member", false)
	if err != channel.ErrUnauthorized {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}

	// 4. List channels by community
	list, err := svc.ListByCommunity("c_test", "u_member", false)
	if err != nil {
		t.Fatalf("ListByCommunity failed: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 channels, got %d", len(list))
	}

	// 5. Get channel by ID
	fetched, err := svc.GetByID(chText.ID, "u_member", false)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if fetched.Name != "general" {
		t.Errorf("expected channel name general, got %s", fetched.Name)
	}

	// 6. Delete channel (Owner)
	err = svc.Delete(chText.ID, "u_owner", false)
	if err != nil {
		t.Fatalf("Delete channel failed: %v", err)
	}

	// Verify channel is deleted
	_, err = svc.GetByID(chText.ID, "u_member", false)
	if err != channel.ErrChannelNotFound {
		t.Errorf("expected ErrChannelNotFound after deletion, got %v", err)
	}
}

func TestChannelHandler_Endpoints(t *testing.T) {
	svc, handler, db, cleanup := setupChannelTest(t)
	defer cleanup()

	ch, _ := svc.Create("c_test", "chat", database.ChannelTypeText, 0, "u_owner", false)

	// Insert mock message into database
	_, _ = db.Exec(`INSERT INTO messages (id, channel_id, user_id, content) VALUES ('m_1', ?, 'u_owner', 'Hello Haven!')`, ch.ID)

	r := chi.NewRouter()
	r.Post("/api/communities/{communityId}/channels", handler.Create)
	r.Get("/api/communities/{communityId}/channels", handler.ListByCommunity)
	r.Get("/api/channels/{id}", handler.GetByID)
	r.Delete("/api/channels/{id}", handler.Delete)
	r.Get("/api/channels/{id}/messages", handler.GetMessages)

	// 1. Create Channel Endpoint
	body, _ := json.Marshal(map[string]interface{}{
		"name":     "announcements",
		"type":     "TEXT",
		"position": 1,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/communities/c_test/channels", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{UserID: "u_owner", IsAdmin: false}))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201 Created on channel creation, got %d: %s", w.Code, w.Body.String())
	}

	// 2. List Channels Endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/communities/c_test/channels", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{UserID: "u_member", IsAdmin: false}))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK on list channels, got %d", w.Code)
	}

	// 3. Get Messages Endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/channels/"+ch.ID+"/messages?limit=10", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{UserID: "u_member", IsAdmin: false}))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK on get messages, got %d: %s", w.Code, w.Body.String())
	}

	var messages []database.Message
	_ = json.NewDecoder(w.Body).Decode(&messages)
	if len(messages) != 1 || messages[0].Content != "Hello Haven!" {
		t.Errorf("unexpected message history output")
	}

	// 4. Delete Channel Endpoint
	req = httptest.NewRequest(http.MethodDelete, "/api/channels/"+ch.ID, nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{UserID: "u_owner", IsAdmin: false}))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 OK on channel deletion, got %d: %s", w.Code, w.Body.String())
	}
}
