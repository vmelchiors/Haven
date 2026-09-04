package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"

	"haven-backend/internal/auth"
	"haven-backend/internal/channel"
	"haven-backend/internal/chat"
	"haven-backend/internal/community"
	"haven-backend/internal/config"
	"haven-backend/internal/donate"
	"haven-backend/internal/feedback"
	"haven-backend/internal/livekit"
	"haven-backend/internal/middleware"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("[Server] Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize Repositories (Data Access Layer)
	userRepo := repository.NewUserRepository(db)
	commRepo := repository.NewCommunityRepository(db)
	chanRepo := repository.NewChannelRepository(db)
	msgRepo := repository.NewMessageRepository(db)
	fbRepo := repository.NewFeedbackRepository(db)

	// Initialize Services & Handlers with Dependency Injection
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
	commHandler.SetMemberUpdateNotifier(chatHub)
	go chatHub.Run()
	chatHandler := chat.NewHandler(chatHub)

	// Tiered Rate Limiters
	apiRateLimiter := middleware.NewRateLimiter(40, 80) // 40 req/s, burst 80
	authRateLimiter := middleware.NewRateLimiter(5, 10)  // Strict anti-bruteforce: 5 req/s, burst 10

	r := SetupRouter(cfg, authHandler, commHandler, chanHandler, livekitHandler, donateHandler, chatHandler, feedbackHandler, apiRateLimiter, authRateLimiter)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,  // Slowloris protection
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,          // 1 MB max header
	}

	// Graceful shutdown channel
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Server] Haven Core API listening on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Server] HTTP server error: %v", err)
		}
	}()

	<-stop
	log.Println("[Server] Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("[Server] Server forced to shutdown: %v", err)
	}

	log.Println("[Server] Server exited cleanly.")
}

func SetupRouter(
	cfg *config.Config,
	authH *auth.Handler,
	commH *community.Handler,
	chanH *channel.Handler,
	livekitH *livekit.Handler,
	donateH *donate.Handler,
	chatH *chat.Handler,
	feedbackH *feedback.Handler,
	apiRateLimiter *middleware.RateLimiter,
	authRateLimiter *middleware.RateLimiter,
) *chi.Mux {
	r := chi.NewRouter()

	// Global Security & Infrastructure Middlewares
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.MaxBodySize(10 << 20)) // 10MB global body limit
	r.Use(middleware.CORS)

	if apiRateLimiter != nil {
		r.Use(apiRateLimiter.Middleware)
	}

	// Health Check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","timestamp":"` + time.Now().UTC().Format(time.RFC3339) + `"}`))
	})

	// Static Files: User Avatars & Icons
	fs := http.FileServer(http.Dir(cfg.UploadDir))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", fs))

	// API Routes
	r.Route("/api", func(r chi.Router) {
		// Public Auth Routes (With strict anti-bruteforce rate limiting)
		r.Group(func(r chi.Router) {
			if authRateLimiter != nil {
				r.Use(authRateLimiter.Middleware)
			}
			r.Post("/auth/register", authH.Register)
			r.Post("/auth/login", authH.Login)
			r.Post("/auth/refresh", authH.Refresh)
			r.Post("/auth/recovery/question", authH.GetRecoveryQuestion)
			r.Post("/auth/recovery/reset", authH.ResetPassword)
		})

		// Public Donation Config
		r.Get("/config/pix", donateH.GetPixConfig)
		r.Get("/donate/pix", donateH.GetPixDonation)

		// LiveKit Webhook (Server-to-Server)
		r.Post("/livekit/webhook", livekitH.HandleWebhook)

		// Authenticated Routes (Requires Bearer JWT)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(cfg.JWTSecret))

			// ToS Acceptance Route (Pre-Gatekeeper)
			r.Post("/auth/tos/accept", authH.AcceptToS)

			// Gated by ToS: Must accept current ToS version to proceed
			r.Group(func(r chi.Router) {
				r.Use(middleware.ToSGatekeeper(cfg.ToSCurrentVersion))

				// User Profile
				r.Get("/auth/me", authH.GetMe)
				r.Put("/auth/me", authH.UpdateProfile)
				r.Post("/auth/avatar", authH.UploadAvatar)

				// Communities
				r.Get("/communities", commH.ListApproved)
				r.Post("/communities", commH.CreateRequest) // Multipart with anti-spam receipt
				r.Post("/communities/join", commH.Join)
				r.Get("/communities/{id}", commH.GetByID)
				r.Put("/communities/{id}", commH.Update)
				r.Get("/communities/{id}/members", commH.ListMembers)
				r.Delete("/communities/{id}", commH.Delete)

				// Community Channels
				r.Post("/communities/{communityId}/channels", chanH.Create)
				r.Get("/communities/{communityId}/channels", chanH.ListByCommunity)

				// Channels
				r.Get("/channels/{id}", chanH.GetByID)
				r.Delete("/channels/{id}", chanH.Delete)
				r.Get("/channels/{id}/messages", chanH.GetMessages)

				// LiveKit SFU Token
				r.Post("/channels/{id}/rtc-token", livekitH.GetRTCToken)

				// User Feedback & Bug Reports
				r.Post("/feedback", feedbackH.Create)

				// Admin Moderation Queue & Reports
				r.Route("/admin", func(r chi.Router) {
					r.Use(middleware.RequireAdmin)
					r.Get("/communities/pending", commH.ListPending)
					r.Get("/communities/{id}/receipt", commH.GetReceipt)
					r.Post("/communities/{id}/approve", commH.Approve)
					r.Post("/communities/{id}/reject", commH.Reject)

					// Admin Feedback Management
					r.Get("/feedback", feedbackH.List)
					r.Patch("/feedback/{id}", feedbackH.Update)
					r.Delete("/feedback/{id}", feedbackH.Delete)
				})
			})
		})
	})

	// WebSockets Route
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))
		r.Use(middleware.ToSGatekeeper(cfg.ToSCurrentVersion))
		r.Get("/ws", chatH.ServeWS)
		r.Get("/ws/channels/{id}", chatH.ServeWS)
	})

	return r
}
