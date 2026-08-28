package livekit

import (
	"encoding/json"
	"io"
	"log"
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

func (h *Handler) GetRTCToken(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	channelID := chi.URLParam(r, "id")
	if channelID == "" {
		http.Error(w, `{"error":"channel id required"}`, http.StatusBadRequest)
		return
	}

	res, err := h.service.GenerateChannelToken(claims.UserID, claims.Username, channelID, claims.IsAdmin)
	if err != nil {
		if err == ErrChannelNotFound {
			http.Error(w, `{"error":"channel not found"}`, http.StatusNotFound)
			return
		}
		if err == ErrAccessDenied {
			http.Error(w, `{"error":"access denied"}`, http.StatusForbidden)
			return
		}
		http.Error(w, fmtError(err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (h *Handler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// Read webhook payload
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read webhook body"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// In a full deployment, LiveKit webhooks can be verified using the auth token header
	var event map[string]interface{}
	if err := json.Unmarshal(body, &event); err == nil {
		eventName, _ := event["event"].(string)
		log.Printf("[LiveKit Webhook] Received event: %s", eventName)
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func fmtError(err error) string {
	b, _ := json.Marshal(map[string]string{"error": err.Error()})
	return string(b)
}
