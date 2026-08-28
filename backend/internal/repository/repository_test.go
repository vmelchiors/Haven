package repository_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupTestDB(t *testing.T) (*database.DB, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "haven-repo-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tempDir, "test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	cleanup := func() {
		_ = db.Close()
		_ = os.RemoveAll(tempDir)
	}

	return db, cleanup
}

func TestUserRepository(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewUserRepository(db)
	ctx := context.Background()

	// 1. Initial count should be 0
	count, err := repo.Count(ctx)
	if err != nil || count != 0 {
		t.Fatalf("expected count 0, got %d, err: %v", count, err)
	}

	// 2. Create User
	userID := uuid.New().String()
	user := &database.User{
		ID:                 userID,
		Username:           "alice",
		PasswordHash:       "hash123",
		AvatarURL:          "https://example.com/avatar.png",
		IsAdmin:            true,
		AcceptedToSVersion: "v1.0.0",
		SecurityQuestion:   "Color?",
		SecurityAnswerHash: "bluehash",
		CreatedAt:          time.Now(),
	}

	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// 3. GetByID
	fetched, err := repo.GetByID(ctx, userID)
	if err != nil {
		t.Fatalf("failed to get user by id: %v", err)
	}
	if fetched.Username != "alice" || fetched.AvatarURL != "https://example.com/avatar.png" || !fetched.IsAdmin {
		t.Fatalf("unexpected user data: %+v", fetched)
	}

	// 4. GetByUsername
	fetchedByUsername, err := repo.GetByUsername(ctx, "alice")
	if err != nil {
		t.Fatalf("failed to get user by username: %v", err)
	}
	if fetchedByUsername.ID != userID {
		t.Fatalf("expected id %s, got %s", userID, fetchedByUsername.ID)
	}

	// 5. Update Profile
	if err := repo.UpdateProfile(ctx, userID, "alice_updated"); err != nil {
		t.Fatalf("failed to update profile: %v", err)
	}
	updated, _ := repo.GetByID(ctx, userID)
	if updated.Username != "alice_updated" {
		t.Fatalf("expected username alice_updated, got %s", updated.Username)
	}

	// 6. Refresh Tokens
	tokenID := uuid.New().String()
	token := &database.RefreshToken{
		ID:        tokenID,
		UserID:    userID,
		TokenHash: "token_hash_abc",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		CreatedAt: time.Now(),
		Revoked:   false,
	}
	if err := repo.SaveRefreshToken(ctx, token); err != nil {
		t.Fatalf("failed to save refresh token: %v", err)
	}

	rf, err := repo.GetRefreshToken(ctx, "token_hash_abc")
	if err != nil || rf.ID != tokenID {
		t.Fatalf("failed to get refresh token: %v", err)
	}

	if err := repo.RevokeRefreshToken(ctx, tokenID); err != nil {
		t.Fatalf("failed to revoke refresh token: %v", err)
	}

	_, err = repo.GetRefreshToken(ctx, "token_hash_abc")
	if err == nil {
		t.Fatal("expected error getting revoked token, got nil")
	}
}

func TestCommunityAndChannelRepository(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	ctx := context.Background()

	// Setup owner
	ownerID := uuid.New().String()
	_ = userRepo.Create(ctx, &database.User{
		ID:           ownerID,
		Username:     "comm_owner",
		PasswordHash: "pwd",
		CreatedAt:    time.Now(),
	})

	// Setup regular member
	memberID := uuid.New().String()
	_ = userRepo.Create(ctx, &database.User{
		ID:           memberID,
		Username:     "comm_member",
		PasswordHash: "pwd",
		CreatedAt:    time.Now(),
	})

	// 1. Create Community
	commID := uuid.New().String()
	comm := &database.Community{
		ID:              commID,
		Name:            "Golang Haven",
		Description:     "A cozy place for Go devs",
		ReceiptFilePath: "/receipts/r1.png",
		DonationAmount:  1500,
		OwnerID:         ownerID,
		Status:          database.StatusPending,
		IsPrivate:       false,
		InviteCode:      "go123456",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := commRepo.CreateWithMemberTx(ctx, comm); err != nil {
		t.Fatalf("failed to create community with member tx: %v", err)
	}

	// Owner should automatically be a member
	isMember, err := commRepo.IsMember(ctx, commID, ownerID)
	if err != nil || !isMember {
		t.Fatalf("expected owner to be a member: %v", err)
	}

	// 2. Pending communities should include this
	pending, err := commRepo.ListPending(ctx)
	if err != nil || len(pending) != 1 {
		t.Fatalf("expected 1 pending community, got %d, err: %v", len(pending), err)
	}

	// 3. Approve community
	if err := commRepo.Approve(ctx, commID); err != nil {
		t.Fatalf("failed to approve community: %v", err)
	}

	approved, err := commRepo.ListApproved(ctx, ownerID)
	if err != nil || len(approved) != 1 {
		t.Fatalf("expected 1 approved community, got %d, err: %v", len(approved), err)
	}

	// 4. Add Member
	if err := commRepo.AddMember(ctx, commID, memberID); err != nil {
		t.Fatalf("failed to add member: %v", err)
	}
	members, err := commRepo.ListMembers(ctx, commID)
	if err != nil || len(members) != 2 {
		t.Fatalf("expected 2 members, got %d, err: %v", len(members), err)
	}

	// 5. Channels
	chID := uuid.New().String()
	ch := &database.Channel{
		ID:          chID,
		CommunityID: commID,
		Name:        "general",
		Type:        database.ChannelTypeText,
		Position:    0,
	}
	if err := chanRepo.Create(ctx, ch); err != nil {
		t.Fatalf("failed to create channel: %v", err)
	}

	channels, err := chanRepo.ListByCommunity(ctx, commID)
	if err != nil || len(channels) != 1 {
		t.Fatalf("expected 1 channel, got %d", len(channels))
	}

	info, err := chanRepo.GetWithCommunityInfo(ctx, chID)
	if err != nil || info.CommunityOwnerID != ownerID || info.CommunityStatus != database.StatusApproved {
		t.Fatalf("unexpected channel info: %+v", info)
	}
}

func TestMessageAndFeedbackRepository(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	userRepo := repository.NewUserRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	msgRepo := repository.NewMessageRepository(db)
	fbRepo := repository.NewFeedbackRepository(db)
	ctx := context.Background()

	// Setup user, comm, chan
	userID := uuid.New().String()
	_ = userRepo.Create(ctx, &database.User{ID: userID, Username: "bob", PasswordHash: "p", CreatedAt: time.Now()})
	commID := uuid.New().String()
	_ = commRepo.CreateWithMemberTx(ctx, &database.Community{ID: commID, Name: "C", ReceiptFilePath: "r", OwnerID: userID, Status: database.StatusApproved, CreatedAt: time.Now(), UpdatedAt: time.Now()})
	chID := uuid.New().String()
	_ = chanRepo.Create(ctx, &database.Channel{ID: chID, CommunityID: commID, Name: "general", Type: database.ChannelTypeText, Position: 0})

	// 1. Message
	msgID := uuid.New().String()
	msg := &database.Message{
		ID:        msgID,
		ChannelID: chID,
		UserID:    userID,
		Content:   "Hello World!",
		CreatedAt: time.Now(),
	}
	if err := msgRepo.Create(ctx, msg); err != nil {
		t.Fatalf("failed to create message: %v", err)
	}

	history, err := msgRepo.GetHistory(ctx, chID, "", 10)
	if err != nil || len(history) != 1 || history[0].Content != "Hello World!" {
		t.Fatalf("failed to get message history: %v, len: %d", err, len(history))
	}

	// 2. Feedback
	fbID := uuid.New().String()
	fb := &database.Feedback{
		ID:          fbID,
		UserID:      userID,
		Type:        database.FeedbackTypeBug,
		Title:       "Audio issue",
		Description: "Audio cuts off occasionally",
		Status:      database.FeedbackStatusOpen,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := fbRepo.Create(ctx, fb); err != nil {
		t.Fatalf("failed to create feedback: %v", err)
	}

	list, err := fbRepo.List(ctx, "OPEN", "BUG")
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 open bug feedback, got %d, err: %v", len(list), err)
	}

	if err := fbRepo.Update(ctx, fbID, string(database.FeedbackStatusResolved), "Fixed in v1.1"); err != nil {
		t.Fatalf("failed to update feedback: %v", err)
	}
	updatedFb, err := fbRepo.GetByID(ctx, fbID)
	if err != nil || updatedFb.Status != database.FeedbackStatusResolved || updatedFb.AdminNotes != "Fixed in v1.1" {
		t.Fatalf("unexpected updated feedback: %+v", updatedFb)
	}
}
