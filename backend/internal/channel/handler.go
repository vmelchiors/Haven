package channel

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"haven-backend/internal/auth"
	"haven-backend/pkg/database"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type CreateChannelRequest struct {
	Name     string               `json:"name"`
	Type     database.ChannelType `json:"type"`
	Position int                  `json:"position"`
}

// Create handles creating a channel in a community
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "communityId")
	if communityID == "" {
		httpError(w, "communityId required", http.StatusBadRequest)
		return
	}

	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	ch, err := h.service.Create(communityID, req.Name, req.Type, req.Position, claims.UserID, claims.IsAdmin)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrAccessDenied) {
			httpError(w, err.Error(), http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusCreated, ch)
}

// ListByCommunity lists channels for a community
func (h *Handler) ListByCommunity(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "communityId")
	if communityID == "" {
		httpError(w, "communityId required", http.StatusBadRequest)
		return
	}

	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	list, err := h.service.ListByCommunity(communityID, userID, isAdmin)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrAccessDenied) {
			httpError(w, "access denied", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, list)
}

// GetByID gets single channel info
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		httpError(w, "channel id required", http.StatusBadRequest)
		return
	}

	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	ch, err := h.service.GetByID(channelID, userID, isAdmin)
	if err != nil {
		if errors.Is(err, ErrChannelNotFound) {
			httpError(w, "channel not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrAccessDenied) {
			httpError(w, "access denied", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, ch)
}

// Delete removes a channel
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		httpError(w, "channel id required", http.StatusBadRequest)
		return
	}

	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.service.Delete(channelID, claims.UserID, claims.IsAdmin)
	if err != nil {
		if errors.Is(err, ErrChannelNotFound) {
			httpError(w, "channel not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorized) {
			httpError(w, "unauthorized", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"message": "channel deleted"})
}

// GetMessages returns paginated message history
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		httpError(w, "channel id required", http.StatusBadRequest)
		return
	}

	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	beforeID := r.URL.Query().Get("before")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	messages, err := h.service.GetMessageHistory(channelID, beforeID, limit, userID, isAdmin)
	if err != nil {
		if errors.Is(err, ErrChannelNotFound) {
			httpError(w, "channel not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrAccessDenied) {
			httpError(w, "access denied", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, messages)
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
