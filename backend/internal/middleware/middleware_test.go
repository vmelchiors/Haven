package middleware_test

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"haven-backend/internal/auth"
	"haven-backend/internal/middleware"
)

func TestAuthMiddleware(t *testing.T) {
	secret := "secret_key_middleware_test"
	token, _ := auth.GenerateAccessToken("user1", "alice", false, "v1.0.0", secret)

	authMw := middleware.Auth(secret)
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
		if !ok || claims == nil {
			t.Errorf("expected claims in request context")
		}
		w.WriteHeader(http.StatusOK)
	})

	// 1. Valid token in header
	req := httptest.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	authMw(nextHandler).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for valid token, got %d", w.Code)
	}

	// 2. Valid token in query param
	reqQ := httptest.NewRequest("GET", "/protected?token="+token, nil)
	wQ := httptest.NewRecorder()
	authMw(nextHandler).ServeHTTP(wQ, reqQ)
	if wQ.Code != http.StatusOK {
		t.Errorf("expected 200 for query token, got %d", wQ.Code)
	}

	// 3. Missing token
	reqMissing := httptest.NewRequest("GET", "/protected", nil)
	wMissing := httptest.NewRecorder()
	authMw(nextHandler).ServeHTTP(wMissing, reqMissing)
	if wMissing.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d", wMissing.Code)
	}

	// 4. Invalid token
	reqInvalid := httptest.NewRequest("GET", "/protected", nil)
	reqInvalid.Header.Set("Authorization", "Bearer invalid.token.str")
	wInvalid := httptest.NewRecorder()
	authMw(nextHandler).ServeHTTP(wInvalid, reqInvalid)
	if wInvalid.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid token, got %d", wInvalid.Code)
	}
}

func TestToSGatekeeperMiddleware(t *testing.T) {
	currentToS := "v1.2.0"
	gatekeeper := middleware.ToSGatekeeper(currentToS)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// 1. User with matching ToS version -> 200
	reqAccepted := httptest.NewRequest("GET", "/api/channels", nil)
	reqAccepted = reqAccepted.WithContext(context.WithValue(reqAccepted.Context(), auth.UserContextKey, &auth.Claims{AcceptedToSVersion: "v1.2.0"}))
	wAccepted := httptest.NewRecorder()
	gatekeeper(nextHandler).ServeHTTP(wAccepted, reqAccepted)
	if wAccepted.Code != http.StatusOK {
		t.Errorf("expected 200 for accepted ToS, got %d", wAccepted.Code)
	}

	// 2. User with outdated ToS version -> 403 Forbidden
	reqOutdated := httptest.NewRequest("GET", "/api/channels", nil)
	reqOutdated = reqOutdated.WithContext(context.WithValue(reqOutdated.Context(), auth.UserContextKey, &auth.Claims{AcceptedToSVersion: "v1.0.0"}))
	wOutdated := httptest.NewRecorder()
	gatekeeper(nextHandler).ServeHTTP(wOutdated, reqOutdated)
	if wOutdated.Code != http.StatusForbidden {
		t.Errorf("expected 403 for outdated ToS, got %d", wOutdated.Code)
	}

	// 3. User with empty ToS version -> 403 Forbidden
	reqEmpty := httptest.NewRequest("GET", "/api/channels", nil)
	reqEmpty = reqEmpty.WithContext(context.WithValue(reqEmpty.Context(), auth.UserContextKey, &auth.Claims{AcceptedToSVersion: ""}))
	wEmpty := httptest.NewRecorder()
	gatekeeper(nextHandler).ServeHTTP(wEmpty, reqEmpty)
	if wEmpty.Code != http.StatusForbidden {
		t.Errorf("expected 403 for empty ToS, got %d", wEmpty.Code)
	}

	// 4. Accept ToS endpoint itself must bypass check
	reqBypass := httptest.NewRequest("POST", "/api/auth/tos/accept", nil)
	reqBypass = reqBypass.WithContext(context.WithValue(reqBypass.Context(), auth.UserContextKey, &auth.Claims{AcceptedToSVersion: ""}))
	wBypass := httptest.NewRecorder()
	gatekeeper(nextHandler).ServeHTTP(wBypass, reqBypass)
	if wBypass.Code != http.StatusOK {
		t.Errorf("expected 200 for ToS accept bypass endpoint, got %d", wBypass.Code)
	}
}

func TestRequireAdminMiddleware(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// 1. Admin user -> 200 OK
	reqAdmin := httptest.NewRequest("GET", "/api/admin/metrics", nil)
	reqAdmin = reqAdmin.WithContext(context.WithValue(reqAdmin.Context(), auth.UserContextKey, &auth.Claims{IsAdmin: true}))
	wAdmin := httptest.NewRecorder()
	middleware.RequireAdmin(nextHandler).ServeHTTP(wAdmin, reqAdmin)
	if wAdmin.Code != http.StatusOK {
		t.Errorf("expected 200 for admin, got %d", wAdmin.Code)
	}

	// 2. Non-admin user -> 403 Forbidden
	reqNonAdmin := httptest.NewRequest("GET", "/api/admin/metrics", nil)
	reqNonAdmin = reqNonAdmin.WithContext(context.WithValue(reqNonAdmin.Context(), auth.UserContextKey, &auth.Claims{IsAdmin: false}))
	wNonAdmin := httptest.NewRecorder()
	middleware.RequireAdmin(nextHandler).ServeHTTP(wNonAdmin, reqNonAdmin)
	if wNonAdmin.Code != http.StatusForbidden {
		t.Errorf("expected 403 for non-admin, got %d", wNonAdmin.Code)
	}
}

func TestRateLimiter(t *testing.T) {
	limiter := middleware.NewRateLimiter(1, 2) // 1 req/s, burst 2
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// 1st request -> ok
	req1 := httptest.NewRequest("GET", "/", nil)
	req1.RemoteAddr = "192.168.1.100:1234"
	w1 := httptest.NewRecorder()
	limiter.Middleware(nextHandler).ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("expected 200 on first request, got %d", w1.Code)
	}

	// 2nd request -> ok
	w2 := httptest.NewRecorder()
	limiter.Middleware(nextHandler).ServeHTTP(w2, req1)
	if w2.Code != http.StatusOK {
		t.Errorf("expected 200 on second request (burst capacity), got %d", w2.Code)
	}

	// 3rd request -> rate limit exceeded (429)
	w3 := httptest.NewRecorder()
	limiter.Middleware(nextHandler).ServeHTTP(w3, req1)
	if w3.Code != http.StatusTooManyRequests {
		t.Errorf("expected 429 Too Many Requests when exceeding limit, got %d", w3.Code)
	}
}

func TestCORSMiddleware(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// OPTIONS preflight
	reqOpts := httptest.NewRequest("OPTIONS", "/api/test", nil)
	wOpts := httptest.NewRecorder()
	middleware.CORS(nextHandler).ServeHTTP(wOpts, reqOpts)
	if wOpts.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS, got %d", wOpts.Code)
	}
	if wOpts.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Errorf("expected CORS Allow-Origin *")
	}
}

func TestSecurityHeadersMiddleware(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	middleware.SecurityHeaders(nextHandler).ServeHTTP(w, req)

	if w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("expected X-Content-Type-Options: nosniff")
	}
	if w.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("expected X-Frame-Options: DENY")
	}
	if w.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Errorf("expected Referrer-Policy: strict-origin-when-cross-origin")
	}
}

func TestMaxBodySizeMiddleware(t *testing.T) {
	limit := int64(10) // 10 bytes
	maxBodyMw := middleware.MaxBodySize(limit)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	// 1. Small body <= 10 bytes -> 200 OK
	smallReq := httptest.NewRequest("POST", "/", bytes.NewReader([]byte("small")))
	smallW := httptest.NewRecorder()
	maxBodyMw(nextHandler).ServeHTTP(smallW, smallReq)
	if smallW.Code != http.StatusOK {
		t.Errorf("expected 200 for small body, got %d", smallW.Code)
	}

	// 2. Large body > 10 bytes -> 413 Payload Too Large
	largeReq := httptest.NewRequest("POST", "/", bytes.NewReader([]byte("this is a very long body that exceeds the limit")))
	largeW := httptest.NewRecorder()
	maxBodyMw(nextHandler).ServeHTTP(largeW, largeReq)
	if largeW.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413 for oversized body, got %d", largeW.Code)
	}
}
