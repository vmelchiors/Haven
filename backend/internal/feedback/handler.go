package feedback

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"haven-backend/internal/auth"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type CreateFeedbackRequest struct {
	Type        string `json:"type"` // BUG or SUGGESTION
	Title       string `json:"title"`
	Description string `json:"description"`
}

type UpdateFeedbackRequest struct {
	Status     string `json:"status"`
	AdminNotes string `json:"admin_notes"`
}

// Create handles user submitting a bug report or suggestion
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateFeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	fb, err := h.service.Create(claims.UserID, req.Type, req.Title, req.Description)
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusCreated, fb)
}

// List handles admin querying feedback with filters
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")
	typeFilter := r.URL.Query().Get("type")

	list, err := h.service.List(statusFilter, typeFilter)
	if err != nil {
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, list)
}

// Update handles admin modifying status and notes
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpError(w, "feedback id required", http.StatusBadRequest)
		return
	}

	var req UpdateFeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	updated, err := h.service.UpdateStatus(id, req.Status, req.AdminNotes)
	if err != nil {
		if errors.Is(err, ErrFeedbackNotFound) {
			httpError(w, "feedback not found", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusOK, updated)
}

// Delete handles admin removing a feedback report
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		httpError(w, "feedback id required", http.StatusBadRequest)
		return
	}

	err := h.service.Delete(id)
	if err != nil {
		if errors.Is(err, ErrFeedbackNotFound) {
			httpError(w, "feedback not found", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"message": "feedback deleted"})
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
