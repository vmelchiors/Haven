package chat

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"haven-backend/internal/auth"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for Desktop / web client
	},
}

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

// ServeWS handles WebSocket requests from clients
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		log.Printf("[WS Auth Failed] Missing or invalid JWT claims on %s", r.RemoteAddr)
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS Upgrade Error] %v from %s", err, claims.Username)
		return
	}

	log.Printf("[WS Connected] user=%s id=%s from=%s", claims.Username, claims.UserID, r.RemoteAddr)
	client := NewClient(h.hub, conn, claims.UserID, claims.Username)
	h.hub.register <- client

	// Auto-join channel if specified in query param
	if chID := r.URL.Query().Get("channel_id"); chID != "" {
		h.hub.JoinChannel(client, chID)
	}

	go client.WritePump()
	go client.ReadPump()
}
