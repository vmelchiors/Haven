package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"haven-backend/internal/auth"
	"haven-backend/internal/channel"
	"haven-backend/internal/chat"
	"haven-backend/internal/community"
	"haven-backend/internal/config"
	"haven-backend/internal/donate"
	"haven-backend/internal/feedback"
	"haven-backend/internal/livekit"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func TestFullServerRouter(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "haven-server-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "server_test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	cfg := &config.Config{
		Port:              "8080",
		DBPath:            dbPath,
		JWTSecret:         "server_test_jwt_secret_123456789",
		LiveKitURL:        "http://localhost:7880",
		LiveKitAPIKey:     "testkey",
		LiveKitAPISecret:  "testsecret",
		ToSCurrentVersion: "v1.0.0",
		PixKey:            "pix@haven.org",
		PixMerchantName:   "Haven",
		PixMerchantCity:   "Manaus",
		UploadDir:         filepath.Join(tempDir, "uploads"),
		ReceiptsDir:       filepath.Join(tempDir, "receipts"),
	}

	userRepo := repository.NewUserRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	msgRepo := repository.NewMessageRepository(db)
	fbRepo := repository.NewFeedbackRepository(db)

	authService := auth.NewService(userRepo, cfg.JWTSecret)
	authHandler := auth.NewHandler(authService, cfg)

	commService := community.NewService(commRepo, chanRepo)
	commHandler := community.NewHandler(commService, cfg)

	chanService := channel.NewService(chanRepo, commRepo, msgRepo)
	chanHandler := channel.NewHandler(chanService)

	livekitService := livekit.NewService(chanRepo, commRepo, cfg)
	livekitHandler := livekit.NewHandler(livekitService)

	donateService := donate.NewService(cfg)
	donateHandler := donate.NewHandler(donateService)

	feedbackService := feedback.NewService(fbRepo)
	feedbackHandler := feedback.NewHandler(feedbackService)

	chatHub := chat.NewHub(msgRepo, chanRepo)
	authHandler.SetProfileUpdateNotifier(chatHub)
	go chatHub.Run()
	chatHandler := chat.NewHandler(chatHub)

	router := SetupRouter(cfg, authHandler, commHandler, chanHandler, livekitHandler, donateHandler, chatHandler, feedbackHandler, nil, nil)

	// 1. Health check
	hReq := httptest.NewRequest("GET", "/health", nil)
	hW := httptest.NewRecorder()
	router.ServeHTTP(hW, hReq)
	if hW.Code != http.StatusOK {
		t.Fatalf("expected 200 on /health, got %d", hW.Code)
	}

	// 2. Register Admin User
	regBody, _ := json.Marshal(map[string]string{
		"username":             "superadmin",
		"password":             "superpass123",
		"accepted_tos_version": "v1.0.0",
	})
	rReq := httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(regBody))
	rReq.Header.Set("Content-Type", "application/json")
	rW := httptest.NewRecorder()
	router.ServeHTTP(rW, rReq)
	if rW.Code != http.StatusCreated {
		t.Fatalf("expected 201 on register, got %d: %s", rW.Code, rW.Body.String())
	}

	var regResp auth.AuthResponse
	_ = json.NewDecoder(rW.Body).Decode(&regResp)
	token := regResp.Tokens.AccessToken

	// 3. Create Community Request (Multipart with anti-spam receipt)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("name", "Go Haven Community")
	_ = writer.WriteField("description", "Realtime Go enthusiasts")
	part, _ := writer.CreateFormFile("receipt_file", "pix_receipt.png")
	_, _ = part.Write([]byte("mock pix receipt bytes"))
	_ = writer.Close()

	cReq := httptest.NewRequest("POST", "/api/communities", &body)
	cReq.Header.Set("Content-Type", writer.FormDataContentType())
	cReq.Header.Set("Authorization", "Bearer "+token)
	cW := httptest.NewRecorder()
	router.ServeHTTP(cW, cReq)
	if cW.Code != http.StatusCreated {
		t.Fatalf("expected 201 on create community, got %d: %s", cW.Code, cW.Body.String())
	}

	var comm database.Community
	_ = json.NewDecoder(cW.Body).Decode(&comm)

	// 4. Admin View Receipt
	rcReq := httptest.NewRequest("GET", "/api/admin/communities/"+comm.ID+"/receipt", nil)
	rcReq.Header.Set("Authorization", "Bearer "+token)
	rcW := httptest.NewRecorder()
	router.ServeHTTP(rcW, rcReq)
	if rcW.Code != http.StatusOK {
		t.Fatalf("expected 200 on view receipt, got %d: %s", rcW.Code, rcW.Body.String())
	}

	// 5. Admin Approve Community
	appReq := httptest.NewRequest("POST", "/api/admin/communities/"+comm.ID+"/approve", nil)
	appReq.Header.Set("Authorization", "Bearer "+token)
	appW := httptest.NewRecorder()
	router.ServeHTTP(appW, appReq)
	if appW.Code != http.StatusOK {
		t.Fatalf("expected 200 on approve, got %d: %s", appW.Code, appW.Body.String())
	}

	// 6. Query Approved Communities
	listReq := httptest.NewRequest("GET", "/api/communities", nil)
	listReq.Header.Set("Authorization", "Bearer "+token)
	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, listReq)
	if listW.Code != http.StatusOK {
		t.Fatalf("expected 200 on list communities, got %d", listW.Code)
	}

	// 7. Query PIX Config
	cfgReq := httptest.NewRequest("GET", "/api/config/pix", nil)
	cfgW := httptest.NewRecorder()
	router.ServeHTTP(cfgW, cfgReq)
	if cfgW.Code != http.StatusOK {
		t.Fatalf("expected 200 on config pix, got %d", cfgW.Code)
	}
}
