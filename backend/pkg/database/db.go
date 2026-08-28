package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

// Open initializes SQLite and applies the schema migrations
func Open(dbPath string) (*DB, error) {
	if dbPath == "" {
		dbPath = "haven.db"
	}

	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	// Enable WAL mode and foreign keys for SQLite
	connStr := fmt.Sprintf("%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", dbPath)
	db, err := sql.Open("sqlite", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	havenDB := &DB{db}
	if err := havenDB.migrate(); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Printf("[DB] Database connected and migrated at %s", dbPath)
	return havenDB, nil
}

func (d *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		avatar_url TEXT,
		is_admin BOOLEAN DEFAULT FALSE,
		accepted_tos_version TEXT DEFAULT '',
		security_question TEXT DEFAULT '',
		security_answer_hash TEXT DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token_hash TEXT NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		revoked BOOLEAN DEFAULT FALSE
	);

	CREATE TABLE IF NOT EXISTS communities (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		icon_url TEXT,
		receipt_file_path TEXT NOT NULL DEFAULT '',
		donation_amount INTEGER DEFAULT 1500,
		owner_id TEXT NOT NULL REFERENCES users(id),
		status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
		rejection_reason TEXT,
		is_private INTEGER DEFAULT 0,
		invite_code TEXT DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS community_members (
		community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (community_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS channels (
		id TEXT PRIMARY KEY,
		community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		type TEXT CHECK(type IN ('TEXT', 'VOICE')) NOT NULL,
		position INTEGER DEFAULT 0
	);

	CREATE TABLE IF NOT EXISTS messages (
		id TEXT PRIMARY KEY,
		channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES users(id),
		content TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS feedback (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		type TEXT CHECK(type IN ('BUG', 'SUGGESTION')) NOT NULL,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		status TEXT CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')) DEFAULT 'OPEN',
		admin_notes TEXT DEFAULT '',
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := d.Exec(schema); err != nil {
		return err
	}

	// Dynamic column migrations for existing SQLite databases
	_, _ = d.Exec("ALTER TABLE communities ADD COLUMN is_private INTEGER DEFAULT 0")
	_, _ = d.Exec("ALTER TABLE communities ADD COLUMN invite_code TEXT DEFAULT ''")
	_, _ = d.Exec("ALTER TABLE users ADD COLUMN security_question TEXT DEFAULT ''")
	_, _ = d.Exec("ALTER TABLE users ADD COLUMN security_answer_hash TEXT DEFAULT ''")

	indexes := `
	CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);
	CREATE INDEX IF NOT EXISTS idx_communities_invite ON communities(invite_code);
	CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
	CREATE INDEX IF NOT EXISTS idx_feedback_status_type ON feedback(status, type, created_at DESC);
	`
	if _, err := d.Exec(indexes); err != nil {
		return err
	}

	return nil
}
