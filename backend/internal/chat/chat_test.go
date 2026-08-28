package chat_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"haven-backend/internal/chat"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupChatTest(t *testing.T) (*chat.Hub, *database.DB, func()) {
	tempDir, err := os.MkdirTemp("", "haven-chat-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "chat_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	// Insert test user and channel
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1', 'alice', 'hash')`)
	_, _ = db.Exec(`INSERT INTO communities (id, name, owner_id, status) VALUES ('c1', 'Haven', 'u1', 'APPROVED')`)
	_, _ = db.Exec(`INSERT INTO channels (id, community_id, name, type) VALUES ('ch1', 'c1', 'general', 'TEXT')`)

	msgRepo := repository.NewMessageRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	hub := chat.NewHub(msgRepo, chanRepo)
	go hub.Run()

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return hub, db, cleanup
}

func TestChatHub_ProcessMessage_ChatAndTyping(t *testing.T) {
	hub, db, cleanup := setupChatTest(t)
	defer cleanup()

	client := chat.NewClient(hub, nil, "u1", "alice")

	// 1. Join channel
	hub.JoinChannel(client, "ch1")

	// 2. Process chat message
	chatPayload := chat.ChatPayload{
		ChannelID: "ch1",
		Content:   "Hello Haven Realtime!",
	}
	pBytes, _ := json.Marshal(chatPayload)
	rawMsg, _ := json.Marshal(chat.WSMessage{
		Type:      chat.EventChatMessage,
		ChannelID: "ch1",
		Payload:   pBytes,
	})

	hub.ProcessMessage(client, rawMsg)

	// Verify message persisted to DB
	time.Sleep(50 * time.Millisecond)
	var count int
	var content string
	err := db.QueryRow("SELECT COUNT(*), content FROM messages WHERE channel_id = 'ch1'").Scan(&count, &content)
	if err != nil {
		t.Fatalf("failed to query messages: %v", err)
	}
	if count != 1 || content != "Hello Haven Realtime!" {
		t.Errorf("expected 1 saved message with content 'Hello Haven Realtime!', got count %d, content %s", count, content)
	}

	// 3. Process typing event
	typingPayload := chat.TypingPayload{
		ChannelID: "ch1",
		IsTyping:  true,
	}
	tBytes, _ := json.Marshal(typingPayload)
	rawTyping, _ := json.Marshal(chat.WSMessage{
		Type:      chat.EventUserTyping,
		ChannelID: "ch1",
		Payload:   tBytes,
	})
	hub.ProcessMessage(client, rawTyping)

	// 4. Leave channel
	hub.LeaveChannel(client, "ch1")
}

func TestChatHub_PresenceAndPing(t *testing.T) {
	hub, _, cleanup := setupChatTest(t)
	defer cleanup()

	client := chat.NewClient(hub, nil, "u1", "alice")

	// Ping message
	rawPing, _ := json.Marshal(chat.WSMessage{Type: chat.EventPing})
	hub.ProcessMessage(client, rawPing)

	// Presence update
	presPayload := chat.PresencePayload{
		Status: "busy",
	}
	pBytes, _ := json.Marshal(presPayload)
	rawPres, _ := json.Marshal(chat.WSMessage{
		Type:    chat.EventPresenceUpdate,
		Payload: pBytes,
	})
	hub.ProcessMessage(client, rawPres)
}
