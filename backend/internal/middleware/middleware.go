package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"haven-backend/internal/auth"
)

// Auth middleware validates JWT access token from Authorization header or 'token' query param (for WebSockets)
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				httpError(w, "authorization token required", http.StatusUnauthorized)
				return
			}

			claims, err := auth.ValidateAccessToken(tokenStr, jwtSecret)
			if err != nil {
				httpError(w, "invalid or expired token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), auth.UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ToSGatekeeper checks if the user has accepted the latest ToS version
func ToSGatekeeper(currentVersion string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Bypass check for ToS acceptance endpoint itself and auth endpoints
			if strings.HasSuffix(r.URL.Path, "/tos/accept") || strings.HasPrefix(r.URL.Path, "/api/auth/tos") {
				next.ServeHTTP(w, r)
				return
			}

			claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
			if ok && claims != nil {
				if claims.AcceptedToSVersion == "" || claims.AcceptedToSVersion < currentVersion {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					_ = json.NewEncoder(w).Encode(map[string]interface{}{
						"error":             "tos_acceptance_required",
						"message":           "You must accept the updated Terms of Service to continue using Haven",
						"current_version":   currentVersion,
						"accepted_version":  claims.AcceptedToSVersion,
						"requires_tos":      true,
					})
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin ensures the authenticated user has is_admin = true
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
		if !ok || claims == nil || !claims.IsAdmin {
			httpError(w, "admin privileges required", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RateLimiter implements an in-memory token bucket rate limiter per IP with automatic eviction
type ipLimiter struct {
	tokens     float64
	lastUpdate time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	rate     float64 // tokens per second
	capacity float64 // max burst capacity
}

func NewRateLimiter(requestsPerSecond float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		rate:     requestsPerSecond,
		capacity: float64(burst),
	}

	// Periodic cleanup of stale limiters
	go func() {
		for {
			time.Sleep(2 * time.Minute)
			rl.mu.Lock()
			now := time.Now()
			for ip, lim := range rl.limiters {
				if now.Sub(lim.lastUpdate) > 5*time.Minute {
					delete(rl.limiters, ip)
				}
			}
			rl.mu.Unlock()
		}
	}()

	return rl
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)

		rl.mu.Lock()
		lim, exists := rl.limiters[ip]
		now := time.Now()
		if !exists {
			lim = &ipLimiter{
				tokens:     rl.capacity - 1,
				lastUpdate: now,
			}
			rl.limiters[ip] = lim
			rl.mu.Unlock()
			next.ServeHTTP(w, r)
			return
		}

		// Replenish tokens based on elapsed time
		elapsed := now.Sub(lim.lastUpdate).Seconds()
		lim.tokens += elapsed * rl.rate
		if lim.tokens > rl.capacity {
			lim.tokens = rl.capacity
		}
		lim.lastUpdate = now

		if lim.tokens < 1.0 {
			rl.mu.Unlock()
			w.Header().Set("Retry-After", "1")
			httpError(w, "rate limit exceeded, please slow down", http.StatusTooManyRequests)
			return
		}

		lim.tokens -= 1.0
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

// CORS middleware adds standard CORS headers
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token, X-Requested-With")
		w.Header().Set("Access-Control-Expose-Headers", "Link, Content-Length, Retry-After")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	if qToken := r.URL.Query().Get("token"); qToken != "" {
		return qToken
	}
	return ""
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	remote := r.RemoteAddr
	if idx := strings.LastIndex(remote, ":"); idx != -1 {
		return remote[:idx]
	}
	return remote
}

func httpError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
