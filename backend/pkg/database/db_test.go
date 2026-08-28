package database_test

import (
	"os"
	"path/filepath"
	"testing"

	"haven-backend/pkg/database"
)

func TestDatabaseOpenAndMigrate(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "haven-db-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open failed: %v", err)
	}
	defer db.Close()

	// Verify tables were created
	tables := []string{"users", "refresh_tokens", "communities", "channels", "messages"}
	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Errorf("expected table %s to exist, err: %v", table, err)
		}
	}

	// Verify foreign key cascades
	_, err = db.Exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1', 'testuser', 'hash')`)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	_, err = db.Exec(`INSERT INTO communities (id, name, owner_id, status) VALUES ('c1', 'Haven Community', 'u1', 'APPROVED')`)
	if err != nil {
		t.Fatalf("failed to insert community: %v", err)
	}

	_, err = db.Exec(`INSERT INTO channels (id, community_id, name, type) VALUES ('ch1', 'c1', 'general', 'TEXT')`)
	if err != nil {
		t.Fatalf("failed to insert channel: %v", err)
	}

	_, err = db.Exec(`INSERT INTO messages (id, channel_id, user_id, content) VALUES ('m1', 'ch1', 'u1', 'hello world')`)
	if err != nil {
		t.Fatalf("failed to insert message: %v", err)
	}

	// Deleting community should cascade delete channels and messages
	_, err = db.Exec(`DELETE FROM communities WHERE id = 'c1'`)
	if err != nil {
		t.Fatalf("failed to delete community: %v", err)
	}

	var chCount, msgCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM channels WHERE id = 'ch1'").Scan(&chCount)
	_ = db.QueryRow("SELECT COUNT(*) FROM messages WHERE id = 'm1'").Scan(&msgCount)

	if chCount != 0 {
		t.Errorf("expected channel to be cascade deleted, got count %d", chCount)
	}
	if msgCount != 0 {
		t.Errorf("expected message to be cascade deleted, got count %d", msgCount)
	}
}
