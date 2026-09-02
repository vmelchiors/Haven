package auth_test

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

	"haven-backend/internal/auth"
	"haven-backend/internal/config"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
	"image"
	"image/color"
	"image/png"
)

type profileUpdateNotifierSpy struct {
	userID    string
	username  string
	avatarURL string
}

func (s *profileUpdateNotifierSpy) NotifyUserProfileUpdated(userID, username, avatarURL string) {
	s.userID = userID
	s.username = username
	s.avatarURL = avatarURL
}

func createSamplePNG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: 100, G: 150, B: 200, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func setupHandlerTestEnv(t *testing.T) (*auth.Handler, *database.DB, *config.Config, func()) {
	tempDir, err := os.MkdirTemp("", "haven-handler-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "handler_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}

	cfg := &config.Config{
		JWTSecret:         "test_jwt_secret_handler_123",
		ToSCurrentVersion: "v1.0.0",
		UploadDir:         filepath.Join(tempDir, "uploads"),
	}

	userRepo := repository.NewUserRepository(db)
	svc := auth.NewService(userRepo, cfg.JWTSecret)
	handler := auth.NewHandler(svc, cfg)

	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
	}

	return handler, db, cfg, cleanup
}

func TestAuthHandler_RegisterAndLogin(t *testing.T) {
	handler, _, _, cleanup := setupHandlerTestEnv(t)
	defer cleanup()

	// 1. Register
	regPayload := map[string]string{
		"username":             "alice",
		"password":             "password123",
		"accepted_tos_version": "v1.0.0",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Register(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected StatusCreated (201), got %d: %s", w.Code, w.Body.String())
	}

	var regResp auth.AuthResponse
	if err := json.NewDecoder(w.Body).Decode(&regResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if regResp.User.Username != "alice" {
		t.Errorf("expected username alice, got %s", regResp.User.Username)
	}
	if regResp.Tokens.AccessToken == "" {
		t.Errorf("expected access token")
	}

	// 2. Login
	loginPayload := map[string]string{
		"username": "alice",
		"password": "password123",
	}
	loginBody, _ := json.Marshal(loginPayload)
	lReq := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(loginBody))
	lReq.Header.Set("Content-Type", "application/json")
	lW := httptest.NewRecorder()

	handler.Login(lW, lReq)

	if lW.Code != http.StatusOK {
		t.Fatalf("expected StatusOK (200), got %d: %s", lW.Code, lW.Body.String())
	}

	// 3. Refresh
	refreshPayload := map[string]string{
		"refresh_token": regResp.Tokens.RefreshToken,
	}
	refBody, _ := json.Marshal(refreshPayload)
	refReq := httptest.NewRequest("POST", "/api/auth/refresh", bytes.NewReader(refBody))
	refReq.Header.Set("Content-Type", "application/json")
	refW := httptest.NewRecorder()

	handler.Refresh(refW, refReq)

	if refW.Code != http.StatusOK {
		t.Fatalf("expected StatusOK (200) on refresh, got %d: %s", refW.Code, refW.Body.String())
	}
}

func TestAuthHandler_GetMeAndAcceptToS(t *testing.T) {
	handler, _, cfg, cleanup := setupHandlerTestEnv(t)
	defer cleanup()

	// Register user first
	regPayload := map[string]string{
		"username": "bob",
		"password": "password123",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.Register(w, req)

	var regResp auth.AuthResponse
	_ = json.NewDecoder(w.Body).Decode(&regResp)

	claims := &auth.Claims{
		UserID:             regResp.User.ID,
		Username:           regResp.User.Username,
		IsAdmin:            regResp.User.IsAdmin,
		AcceptedToSVersion: regResp.User.AcceptedToSVersion,
	}

	// Test GetMe
	meReq := httptest.NewRequest("GET", "/api/auth/me", nil)
	meReq = meReq.WithContext(context.WithValue(meReq.Context(), auth.UserContextKey, claims))
	meW := httptest.NewRecorder()

	handler.GetMe(meW, meReq)
	if meW.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetMe, got %d", meW.Code)
	}

	// Test AcceptToS
	tosPayload := map[string]string{
		"version": cfg.ToSCurrentVersion,
	}
	tosBody, _ := json.Marshal(tosPayload)
	tosReq := httptest.NewRequest("POST", "/api/auth/tos/accept", bytes.NewReader(tosBody))
	tosReq = tosReq.WithContext(context.WithValue(tosReq.Context(), auth.UserContextKey, claims))
	tosW := httptest.NewRecorder()

	handler.AcceptToS(tosW, tosReq)
	if tosW.Code != http.StatusOK {
		t.Fatalf("expected 200 on AcceptToS, got %d: %s", tosW.Code, tosW.Body.String())
	}
}

func TestAuthHandler_UploadAvatar(t *testing.T) {
	handler, db, _, cleanup := setupHandlerTestEnv(t)
	defer cleanup()
	notifier := &profileUpdateNotifierSpy{}
	handler.SetProfileUpdateNotifier(notifier)

	regPayload := map[string]string{
		"username": "avatar-user",
		"password": "password123",
	}
	regBody, _ := json.Marshal(regPayload)
	regReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(regBody))
	regW := httptest.NewRecorder()
	handler.Register(regW, regReq)
	if regW.Code != http.StatusCreated {
		t.Fatalf("expected registration before avatar upload, got %d: %s", regW.Code, regW.Body.String())
	}
	var regResp auth.AuthResponse
	_ = json.NewDecoder(regW.Body).Decode(&regResp)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("avatar", "test.png")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	_, _ = part.Write(createSamplePNG(100, 100))
	_ = writer.Close()

	req := httptest.NewRequest("POST", "/api/auth/avatar", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req = req.WithContext(context.WithValue(req.Context(), auth.UserContextKey, &auth.Claims{
		UserID: regResp.User.ID, Username: regResp.User.Username,
	}))
	w := httptest.NewRecorder()

	handler.UploadAvatar(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on avatar upload, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]string
	_ = json.NewDecoder(w.Body).Decode(&res)
	if res["avatar_url"] == "" {
		t.Errorf("expected avatar_url in response")
	}

	var storedAvatar string
	if err := db.QueryRow("SELECT avatar_url FROM users WHERE id = ?", regResp.User.ID).Scan(&storedAvatar); err != nil {
		t.Fatalf("failed to read persisted avatar: %v", err)
	}
	if storedAvatar != res["avatar_url"] {
		t.Fatalf("expected persisted avatar %q, got %q", res["avatar_url"], storedAvatar)
	}
	if notifier.userID != regResp.User.ID || notifier.username != regResp.User.Username {
		t.Fatalf("expected authoritative profile notification for %s, got user=%s username=%s", regResp.User.ID, notifier.userID, notifier.username)
	}
	if notifier.avatarURL != res["avatar_url"] {
		t.Fatalf("expected notified avatar %q, got %q", res["avatar_url"], notifier.avatarURL)
	}
}

func TestAuthHandler_RecoveryEndpoints(t *testing.T) {
	handler, _, _, cleanup := setupHandlerTestEnv(t)
	defer cleanup()

	// 1. Register user with security question & answer
	regPayload := map[string]string{
		"username":          "carol",
		"password":          "initialpass123",
		"security_question": "Qual sua cor favorita?",
		"security_answer":   "Azul",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.Register(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 on register, got %d", w.Code)
	}

	// 2. Get recovery question
	qPayload := map[string]string{"username": "carol"}
	qBody, _ := json.Marshal(qPayload)
	qReq := httptest.NewRequest("POST", "/api/auth/recovery/question", bytes.NewReader(qBody))
	qW := httptest.NewRecorder()
	handler.GetRecoveryQuestion(qW, qReq)
	if qW.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetRecoveryQuestion, got %d: %s", qW.Code, qW.Body.String())
	}
	var qResp auth.RecoveryQuestionResponse
	_ = json.NewDecoder(qW.Body).Decode(&qResp)
	if qResp.SecurityQuestion != "Qual sua cor favorita?" {
		t.Errorf("expected 'Qual sua cor favorita?', got '%s'", qResp.SecurityQuestion)
	}

	// 3. Reset password with wrong answer -> 400
	badReset := map[string]string{
		"username":        "carol",
		"security_answer": "Verde",
		"new_password":    "newpassword999",
	}
	badResetBody, _ := json.Marshal(badReset)
	badReq := httptest.NewRequest("POST", "/api/auth/recovery/reset", bytes.NewReader(badResetBody))
	badW := httptest.NewRecorder()
	handler.ResetPassword(badW, badReq)
	if badW.Code != http.StatusBadRequest {
		t.Errorf("expected 400 on wrong answer, got %d", badW.Code)
	}

	// 4. Reset password with correct answer -> 200
	goodReset := map[string]string{
		"username":        "carol",
		"security_answer": "azul",
		"new_password":    "newpassword999",
	}
	goodResetBody, _ := json.Marshal(goodReset)
	goodReq := httptest.NewRequest("POST", "/api/auth/recovery/reset", bytes.NewReader(goodResetBody))
	goodW := httptest.NewRecorder()
	handler.ResetPassword(goodW, goodReq)
	if goodW.Code != http.StatusOK {
		t.Fatalf("expected 200 on ResetPassword, got %d: %s", goodW.Code, goodW.Body.String())
	}
	var resetResp auth.AuthResponse
	_ = json.NewDecoder(goodW.Body).Decode(&resetResp)
	if resetResp.User.Username != "carol" || resetResp.Tokens.AccessToken == "" {
		t.Errorf("expected valid auth response on password reset")
	}
}
