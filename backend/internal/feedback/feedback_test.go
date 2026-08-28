package feedback_test

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
	"haven-backend/internal/feedback"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func setupFeedbackTest(t *testing.T) (*feedback.Service, *feedback.Handler, *database.DB, func()) {
	tempDir, err := os.MkdirTemp("", "haven-feedback-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "feedback_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u1', 'alice', 'hash', 0)`)
	_, _ = db.Exec(`INSERT INTO users (id, username, password_hash, is_admin) VALUES ('u2', 'bob', 'hash', 1)`)

	fbRepo := repository.NewFeedbackRepository(db)
	svc := feedback.NewService(fbRepo)
	handler := feedback.NewHandler(svc)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return svc, handler, db, cleanup
}

func TestFeedbackService_CRUD(t *testing.T) {
	svc, _, _, cleanup := setupFeedbackTest(t)
	defer cleanup()

	// 1. Create BUG report
	bug, err := svc.Create("u1", "BUG", "Audio robotico no canal de voz", "Quando dois usuarios falam ao mesmo tempo o audio trava.")
	if err != nil {
		t.Fatalf("Create BUG failed: %v", err)
	}
	if bug.Type != database.FeedbackTypeBug || bug.Status != database.FeedbackStatusOpen {
		t.Errorf("unexpected bug report properties: %+v", bug)
	}

	// 2. Create SUGGESTION report
	sug, err := svc.Create("u1", "SUGGESTION", "Adicionar tema escuro OLED", "Seria otimo ter um modo com preto puro.")
	if err != nil {
		t.Fatalf("Create SUGGESTION failed: %v", err)
	}
	if sug.Type != database.FeedbackTypeSuggestion {
		t.Errorf("unexpected suggestion properties: %+v", sug)
	}

	// 3. List all
	all, err := svc.List("", "")
	if err != nil || len(all) != 2 {
		t.Fatalf("expected 2 reports, got %d (err: %v)", len(all), err)
	}

	// 4. Filter by type BUG
	bugsOnly, err := svc.List("", "BUG")
	if err != nil || len(bugsOnly) != 1 {
		t.Fatalf("expected 1 bug, got %d", len(bugsOnly))
	}

	// 5. Update status to IN_PROGRESS
	updated, err := svc.UpdateStatus(bug.ID, "IN_PROGRESS", "Investigando codecs Opus")
	if err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}
	if updated.Status != database.FeedbackStatusInProgress || updated.AdminNotes != "Investigando codecs Opus" {
		t.Errorf("unexpected updated properties: %+v", updated)
	}

	// 6. Delete
	err = svc.Delete(bug.ID)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	_, err = svc.GetByID(bug.ID)
	if err != feedback.ErrFeedbackNotFound {
		t.Errorf("expected ErrFeedbackNotFound after delete")
	}
}

func TestFeedbackHandler_HTTP(t *testing.T) {
	_, handler, _, cleanup := setupFeedbackTest(t)
	defer cleanup()

	userClaims := &auth.Claims{UserID: "u1", Username: "alice", IsAdmin: false}
	adminClaims := &auth.Claims{UserID: "u2", Username: "bob", IsAdmin: true}

	r := chi.NewRouter()
	r.Post("/api/feedback", handler.Create)
	r.Get("/api/admin/feedback", handler.List)
	r.Patch("/api/admin/feedback/{id}", handler.Update)
	r.Delete("/api/admin/feedback/{id}", handler.Delete)

	// 1. Submit feedback
	cPayload := map[string]string{
		"type":        "BUG",
		"title":       "Botao de mutar falha",
		"description": "Ao usar atalho de teclado o icone nao atualiza",
	}
	cBody, _ := json.Marshal(cPayload)
	req := httptest.NewRequest("POST", "/api/feedback", bytes.NewReader(cBody))
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, userClaims))
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created database.Feedback
	_ = json.NewDecoder(w.Body).Decode(&created)

	// 2. Admin list
	lReq := httptest.NewRequest("GET", "/api/admin/feedback?type=BUG", nil)
	lReq = lReq.WithContext(context.WithValue(lReq.Context(), auth.UserContextKey, adminClaims))
	lW := httptest.NewRecorder()

	r.ServeHTTP(lW, lReq)
	if lW.Code != http.StatusOK {
		t.Fatalf("expected 200 on List, got %d", lW.Code)
	}

	// 3. Admin update status
	uPayload := map[string]string{
		"status":      "RESOLVED",
		"admin_notes": "Corrigido na versao v1.1.0",
	}
	uBody, _ := json.Marshal(uPayload)
	uReq := httptest.NewRequest("PATCH", "/api/admin/feedback/"+created.ID, bytes.NewReader(uBody))
	uReq = uReq.WithContext(context.WithValue(uReq.Context(), auth.UserContextKey, adminClaims))
	uW := httptest.NewRecorder()

	r.ServeHTTP(uW, uReq)
	if uW.Code != http.StatusOK {
		t.Fatalf("expected 200 on Update, got %d: %s", uW.Code, uW.Body.String())
	}
}
