package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"haven-backend/internal/config"
	"haven-backend/pkg/avatar"
	"haven-backend/pkg/database"
)

type Handler struct {
	service *Service
	cfg     *config.Config
}

func NewHandler(service *Service, cfg *config.Config) *Handler {
	return &Handler{
		service: service,
		cfg:     cfg,
	}
}

type RegisterRequest struct {
	Username           string `json:"username"`
	Password           string `json:"password"`
	AvatarURL          string `json:"avatar_url"`
	AcceptedToSVersion string `json:"accepted_tos_version"`
	SecurityQuestion   string `json:"security_question"`
	SecurityAnswer     string `json:"security_answer"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AcceptToSRequest struct {
	Version string `json:"version"`
}

type UpdateProfileRequest struct {
	Username        string `json:"username,omitempty"`
	CurrentPassword string `json:"current_password,omitempty"`
	NewPassword     string `json:"new_password,omitempty"`
}

type RecoveryQuestionRequest struct {
	Username string `json:"username"`
}

type RecoveryQuestionResponse struct {
	SecurityQuestion string `json:"security_question"`
}

type ResetPasswordRequest struct {
	Username       string `json:"username"`
	SecurityAnswer string `json:"security_answer"`
	NewPassword    string `json:"new_password"`
}

type AuthResponse struct {
	User   *database.User `json:"user"`
	Tokens *TokenPair     `json:"tokens"`
}

// Register handles user registration (Zero-PII)
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, tokens, err := h.service.Register(req.Username, req.Password, req.AvatarURL, req.AcceptedToSVersion, req.SecurityQuestion, req.SecurityAnswer)
	if err != nil {
		if errors.Is(err, ErrUserAlreadyExists) {
			httpError(w, "username already taken", http.StatusConflict)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusCreated, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// Login handles user authentication
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, tokens, err := h.service.Login(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			httpError(w, "invalid username or password", http.StatusUnauthorized)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// Refresh handles token rotation using opaque refresh token
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		httpError(w, "refresh_token required", http.StatusBadRequest)
		return
	}

	user, tokens, err := h.service.Refresh(req.RefreshToken)
	if err != nil {
		httpError(w, "invalid or expired refresh token", http.StatusUnauthorized)
		return
	}

	jsonResponse(w, http.StatusOK, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// AcceptToS updates the ToS version accepted by the authenticated user
func (h *Handler) AcceptToS(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req AcceptToSRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	version := req.Version
	if strings.TrimSpace(version) == "" {
		version = h.cfg.ToSCurrentVersion
	}

	if err := h.service.AcceptToS(claims.UserID, version); err != nil {
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch updated user
	user, err := h.service.GetUserByID(claims.UserID)
	if err != nil {
		httpError(w, "user not found", http.StatusNotFound)
		return
	}

	// Re-issue tokens with updated accepted ToS version
	tokens, err := h.service.generateTokensForUser(user)
	if err != nil {
		httpError(w, "failed to re-issue tokens", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// GetMe returns current user info from DB
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	user, err := h.service.GetUserByID(claims.UserID)
	if err != nil {
		httpError(w, "user not found", http.StatusNotFound)
		return
	}

	jsonResponse(w, http.StatusOK, user)
}

// UpdateProfile updates username and/or password
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, tokens, err := h.service.UpdateProfile(claims.UserID, req.Username, req.CurrentPassword, req.NewPassword)
	if err != nil {
		if errors.Is(err, ErrUserAlreadyExists) {
			httpError(w, "nome de usuário já está em uso", http.StatusConflict)
			return
		}
		if errors.Is(err, ErrInvalidCredentials) {
			httpError(w, "senha atual incorreta", http.StatusUnauthorized)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusOK, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// GetRecoveryQuestion returns the registered security question for account recovery
func (h *Handler) GetRecoveryQuestion(w http.ResponseWriter, r *http.Request) {
	var req RecoveryQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Username) == "" {
		httpError(w, "nome de usuário é obrigatório", http.StatusBadRequest)
		return
	}

	question, err := h.service.GetSecurityQuestion(req.Username)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpError(w, "usuário não encontrado", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusOK, &RecoveryQuestionResponse{
		SecurityQuestion: question,
	})
}

// ResetPassword handles account recovery and password reset using security answer
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, tokens, err := h.service.ResetPasswordWithSecurityAnswer(req.Username, req.SecurityAnswer, req.NewPassword)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			httpError(w, "usuário não encontrado", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusOK, &AuthResponse{
		User:   user,
		Tokens: tokens,
	})
}

// UploadAvatar processes and stores an avatar image
func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// 2 MB max upload limit in multipart reader
	if err := r.ParseMultipartForm(avatar.MaxAvatarSizeBytes); err != nil {
		httpError(w, "file too large or invalid multipart form (max 2MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		httpError(w, "missing 'avatar' field in form", http.StatusBadRequest)
		return
	}
	defer file.Close()

	avatarURL, err := avatar.ProcessAvatar(file, h.cfg.UploadDir, header.Filename)
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.service.UpdateAvatar(claims.UserID, avatarURL); err != nil {
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{
		"avatar_url": avatarURL,
	})
}

func httpError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}
