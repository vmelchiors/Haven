package community_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"haven-backend/internal/auth"
	"haven-backend/internal/community"
	"haven-backend/internal/config"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

type memberUpdateSpy struct {
	communityIDs []string
}

func (s *memberUpdateSpy) NotifyCommunityMembersUpdated(communityID string) {
	s.communityIDs = append(s.communityIDs, communityID)
}

func setupCommunityTest(t *testing.T) (*community.Service, *community.Handler, *database.DB, *config.Config, func()) {
	tempDir, err := os.MkdirTemp("", "haven-comm-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "comm_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	cfg := &config.Config{
		UploadDir:   filepath.Join(tempDir, "uploads"),
		ReceiptsDir: filepath.Join(tempDir, "receipts"),
	}

	// Insert test users
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_owner', 'owner', 'hash', 0)`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_other', 'other', 'hash', 0)`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u_admin', 'admin', 'hash', 1)`)

	commRepo := repository.NewCommunityRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	svc := community.NewService(commRepo, chanRepo)
	handler := community.NewHandler(svc, cfg)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return svc, handler, db, cfg, cleanup
}

func TestCommunityService_FullLifecycle(t *testing.T) {
	svc, _, _, cfg, cleanup := setupCommunityTest(t)
	defer cleanup()

	receiptPath := filepath.Join(cfg.ReceiptsDir, "sample_receipt.pdf")
	_ = os.MkdirAll(cfg.ReceiptsDir, 0755)
	_ = os.WriteFile(receiptPath, []byte("%PDF-1.4 mock receipt"), 0644)

	// 1. Create request with R$ 15,00 donation receipt
	comm, err := svc.CreateRequest("u_owner", "Golang Haven", "Community for Go developers", "/uploads/icon.png", receiptPath, 1500, false)
	if err != nil {
		t.Fatalf("CreateRequest failed: %v", err)
	}
	if comm.Status != database.StatusPending {
		t.Errorf("expected status PENDING, got %s", comm.Status)
	}
	if comm.DonationAmount != 1500 {
		t.Errorf("expected donation amount 1500, got %d", comm.DonationAmount)
	}

	// 2. ListApproved should NOT show pending community
	approved, err := svc.ListApproved("u_owner", false)
	if err != nil {
		t.Fatalf("ListApproved failed: %v", err)
	}
	if len(approved) != 0 {
		t.Errorf("expected 0 approved communities, got %d", len(approved))
	}

	// 3. ListPending should show it
	pending, err := svc.ListPending()
	if err != nil {
		t.Fatalf("ListPending failed: %v", err)
	}
	if len(pending) != 1 || pending[0].ID != comm.ID {
		t.Errorf("expected community in pending list")
	}

	// 4. Other normal user should be denied access to pending community
	_, err = svc.GetByID(comm.ID, "u_other", false)
	if err != community.ErrCommunityPending {
		t.Errorf("expected ErrCommunityPending for other user, got %v", err)
	}

	// 5. Admin retrieves receipt
	rPath, err := svc.GetReceiptFilePath(comm.ID)
	if err != nil || rPath != receiptPath {
		t.Errorf("expected receipt file path %s, got %s (err: %v)", receiptPath, rPath, err)
	}

	// 6. Admin approves community -> should create default channels
	approvedComm, err := svc.Approve(comm.ID)
	if err != nil {
		t.Fatalf("Approve failed: %v", err)
	}
	if approvedComm.Status != database.StatusApproved {
		t.Errorf("expected status APPROVED, got %s", approvedComm.Status)
	}

	// 7. Check channels generated automatically
	approvedDetail, err := svc.GetByID(comm.ID, "u_other", false)
	if err != nil {
		t.Fatalf("GetByID failed for approved community: %v", err)
	}
	if len(approvedDetail.Channels) < 2 {
		t.Errorf("expected default channels (geral & Voz Geral), got %d channels", len(approvedDetail.Channels))
	}

	// 7b. List members
	members, err := svc.ListMembers(comm.ID, "u_other", false)
	if err != nil {
		t.Fatalf("ListMembers failed: %v", err)
	}
	if len(members) != 1 || members[0].ID != "u_owner" {
		t.Errorf("expected public community to list only its owner member, got %+v", members)
	}

	joinedPublic, err := svc.Join("u_other", comm.ID)
	if err != nil {
		t.Fatalf("failed to join public community: %v", err)
	}
	if joinedPublic.ID != comm.ID {
		t.Errorf("expected joined public community ID %s, got %s", comm.ID, joinedPublic.ID)
	}
	members, err = svc.ListMembers(comm.ID, "u_other", false)
	if err != nil {
		t.Fatalf("ListMembers failed after joining public community: %v", err)
	}
	if len(members) != 2 || members[0].ID != "u_owner" || members[1].ID != "u_other" {
		t.Errorf("expected only explicit public community members, got %+v", members)
	}

	// 8. Update community as owner
	updatedComm, err := svc.Update(comm.ID, "u_owner", false, "Golang Brasil", "Comunidade Oficial", "", false)
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if updatedComm.Name != "Golang Brasil" || updatedComm.Description != "Comunidade Oficial" {
		t.Errorf("expected updated name and description, got %s (%s)", updatedComm.Name, updatedComm.Description)
	}

	// Non-owner update should fail
	_, err = svc.Update(comm.ID, "u_other", false, "Hacked", "Hacked", "", false)
	if err != community.ErrUnauthorized {
		t.Errorf("expected ErrUnauthorized for other user update, got %v", err)
	}

	// 9. Create and test private community with invite code
	privComm, err := svc.CreateRequest("u_owner", "VIP Haven", "Private Club", "", receiptPath, 1500, true)
	if err != nil {
		t.Fatalf("failed to create private community: %v", err)
	}
	if !privComm.IsPrivate || privComm.InviteCode == "" {
		t.Fatalf("expected private community with invite code, got %+v", privComm)
	}

	_, _ = svc.Approve(privComm.ID)
	_, err = svc.ListMembers(privComm.ID, "u_other", false)
	if err != community.ErrUnauthorized {
		t.Errorf("expected private member list to reject non-member, got %v", err)
	}

	// User u_other joins private community using Community ID (UUID)
	joinedComm, err := svc.Join("u_other", privComm.ID)
	if err != nil {
		t.Fatalf("Join by ID failed: %v", err)
	}
	if joinedComm.ID != privComm.ID {
		t.Errorf("expected joined community ID %s, got %s", privComm.ID, joinedComm.ID)
	}
	privateMembers, err := svc.ListMembers(privComm.ID, "u_other", false)
	if err != nil {
		t.Fatalf("ListMembers failed for private community: %v", err)
	}
	if len(privateMembers) != 2 {
		t.Errorf("expected private community to list only owner and joined member, got %d", len(privateMembers))
	}

	// After joining, u_other sees both communities in approved list
	otherListAfter, _ := svc.ListApproved("u_other", false)
	if len(otherListAfter) != 2 {
		t.Errorf("expected 2 communities for u_other after joining, got %d", len(otherListAfter))
	}

	// 10. Reject another community with reason
	comm2, _ := svc.CreateRequest("u_owner", "Bad Community", "spam", "", receiptPath, 1500, false)
	rejectedComm, err := svc.Reject(comm2.ID, "Comprovante ilegivel")
	if err != nil {
		t.Fatalf("Reject failed: %v", err)
	}
	if rejectedComm.Status != database.StatusRejected || rejectedComm.RejectionReason != "Comprovante ilegivel" {
		t.Errorf("expected status REJECTED with reason 'Comprovante ilegivel', got %s (%s)", rejectedComm.Status, rejectedComm.RejectionReason)
	}

	// 11. Delete community
	err = svc.Delete(comm.ID, "u_other", false)
	if err != community.ErrUnauthorized {
		t.Errorf("expected ErrUnauthorized for other user delete attempt, got %v", err)
	}

	err = svc.Delete(comm.ID, "u_owner", false)
	if err != nil {
		t.Fatalf("owner failed to delete community: %v", err)
	}
}

func TestCommunityHandler_HTTP(t *testing.T) {
	_, handler, _, _, cleanup := setupCommunityTest(t)
	defer cleanup()
	memberNotifier := &memberUpdateSpy{}
	handler.SetMemberUpdateNotifier(memberNotifier)

	ownerClaims := &auth.Claims{UserID: "u_owner", Username: "owner", IsAdmin: false}
	adminClaims := &auth.Claims{UserID: "u_admin", Username: "admin", IsAdmin: true}

	r := chi.NewRouter()
	r.Post("/api/communities", handler.CreateRequest)
	r.Get("/api/communities", handler.ListApproved)
	r.Put("/api/communities/{id}", handler.Update)
	r.Delete("/api/communities/{id}", handler.Delete)
	r.Post("/api/communities/join", handler.Join)
	r.Get("/api/admin/communities/pending", handler.ListPending)
	r.Get("/api/admin/communities/{id}/receipt", handler.GetReceipt)
	r.Post("/api/admin/communities/{id}/approve", handler.Approve)
	r.Post("/api/admin/communities/{id}/reject", handler.Reject)

	// 1. Create request HTTP with multipart receipt and is_private
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("name", "React Developers")
	_ = writer.WriteField("description", "Haven React Community")
	_ = writer.WriteField("is_private", "true")

	part, err := writer.CreateFormFile("receipt_file", "comprovante_pix.png")
	if err != nil {
		t.Fatalf("failed to create receipt form file: %v", err)
	}
	_, _ = part.Write([]byte("mock receipt bytes"))
	_ = writer.Close()

	req := httptest.NewRequest("POST", "/api/communities", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, ownerClaims))
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created database.Community
	_ = json.NewDecoder(w.Body).Decode(&created)

	// 2. Approve community
	appReq := httptest.NewRequest("POST", "/api/admin/communities/"+created.ID+"/approve", nil)
	appReq = appReq.WithContext(context.WithValue(appReq.Context(), auth.UserContextKey, adminClaims))
	appW := httptest.NewRecorder()
	r.ServeHTTP(appW, appReq)
	if appW.Code != http.StatusOK {
		t.Fatalf("expected 200 on Approve, got %d: %s", appW.Code, appW.Body.String())
	}

	// 3. Update community HTTP (JSON)
	upPayload := map[string]interface{}{
		"name":        "React Core Team",
		"description": "Comunidade oficial React",
		"is_private":  false,
	}
	upBody, _ := json.Marshal(upPayload)
	upReq := httptest.NewRequest("PUT", "/api/communities/"+created.ID, bytes.NewReader(upBody))
	upReq.Header.Set("Content-Type", "application/json")
	upReq = upReq.WithContext(context.WithValue(upReq.Context(), auth.UserContextKey, ownerClaims))
	upW := httptest.NewRecorder()
	r.ServeHTTP(upW, upReq)

	if upW.Code != http.StatusOK {
		t.Fatalf("expected 200 on Update, got %d: %s", upW.Code, upW.Body.String())
	}

	var updated database.Community
	_ = json.NewDecoder(upW.Body).Decode(&updated)
	if updated.Name != "React Core Team" {
		t.Errorf("expected updated name, got %s", updated.Name)
	}

	// 4. Join via Community ID HTTP
	joinPayload := map[string]string{"identifier": created.ID}
	jBody, _ := json.Marshal(joinPayload)
	jReq := httptest.NewRequest("POST", "/api/communities/join", bytes.NewReader(jBody))
	jReq = jReq.WithContext(context.WithValue(jReq.Context(), auth.UserContextKey, &auth.Claims{UserID: "u_other", Username: "other"}))
	jW := httptest.NewRecorder()
	r.ServeHTTP(jW, jReq)
	if jW.Code != http.StatusOK {
		t.Fatalf("expected 200 on Join by ID, got %d: %s", jW.Code, jW.Body.String())
	}
	if len(memberNotifier.communityIDs) != 1 || memberNotifier.communityIDs[0] != created.ID {
		t.Fatalf("expected member update notification for %s, got %v", created.ID, memberNotifier.communityIDs)
	}

	// 5. Delete community HTTP
	delReq := httptest.NewRequest("DELETE", "/api/communities/"+created.ID, nil)
	delReq = delReq.WithContext(context.WithValue(delReq.Context(), auth.UserContextKey, ownerClaims))
	delW := httptest.NewRecorder()
	r.ServeHTTP(delW, delReq)
	if delW.Code != http.StatusOK {
		t.Fatalf("expected 200 on Delete, got %d: %s", delW.Code, delW.Body.String())
	}
}
