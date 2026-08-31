package chat

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"haven-backend/internal/repository"
	"haven-backend/pkg/database"
)

// WSEventType defines event types sent over WebSockets
type WSEventType string

const (
	EventChatMessage        WSEventType = "chat_message"
	EventUserTyping         WSEventType = "user_typing"
	EventPresenceUpdate     WSEventType = "presence_update"
	EventUserProfileUpdated WSEventType = "user_profile_updated"
	EventUserJoinedVoice    WSEventType = "user_joined_voice"
	EventUserLeftVoice      WSEventType = "user_left_voice"
	EventVoiceStateUpdate   WSEventType = "voice_state_update"
	EventVoiceSnapshot      WSEventType = "voice_snapshot"
	EventWebRTCSignal       WSEventType = "webrtc_signal"
	EventPing               WSEventType = "ping"
	EventError              WSEventType = "error"
)

// WSMessage is the envelope for WebSocket messages
type WSMessage struct {
	Type      WSEventType     `json:"type"`
	ChannelID string          `json:"channel_id,omitempty"`
	Payload   json.RawMessage `json:"payload"`
}

type ChatMessagePayload struct {
	ChannelID string `json:"channel_id"`
	Content   string `json:"content"`
}

type ChatPayload = ChatMessagePayload

type UserTypingPayload struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id,omitempty"`
	Username  string `json:"username,omitempty"`
	IsTyping  bool   `json:"is_typing"`
}

type TypingPayload = UserTypingPayload

type PresencePayload struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Status   string `json:"status"` // online, idle, busy, offline
}

type UserProfilePayload struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}

type VoiceStatePayload struct {
	ChannelID       string `json:"channel_id"`
	UserID          string `json:"user_id"`
	Username        string `json:"username"`
	IsSpeaking      bool   `json:"is_speaking"`
	IsMuted         bool   `json:"is_muted"`
	IsDeafened      bool   `json:"is_deafened"`
	IsCameraOn      bool   `json:"is_camera_on"`
	IsScreenSharing bool   `json:"is_screen_sharing"`
}

type WebRTCSignalPayload struct {
	ChannelID      string          `json:"channel_id"`
	SenderID       string          `json:"sender_id,omitempty"`
	SenderUsername string          `json:"sender_username,omitempty"`
	TargetUserID   string          `json:"target_user_id"`
	Signal         json.RawMessage `json:"signal"`
}

// Hub maintains the set of active clients and broadcasts messages to rooms
type Hub struct {
	msgRepo  repository.MessageRepository
	chanRepo repository.ChannelRepository
	mu       sync.RWMutex

	// Registered clients mapped by Client pointer
	clients map[*Client]bool

	// Channel rooms: channelID -> map[*Client]bool
	rooms map[string]map[*Client]bool

	// Voice states: channelID -> userID -> VoiceStatePayload
	voiceStates map[string]map[string]*VoiceStatePayload

	// User presence: userID -> status
	presence map[string]string

	// User usernames: userID -> username
	userMeta map[string]string

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Inbound messages from clients
	broadcast chan *BroadcastMessage
}

type BroadcastMessage struct {
	Sender    *Client
	ChannelID string
	Data      []byte
}

func NewHub(msgRepo repository.MessageRepository, chanRepo repository.ChannelRepository) *Hub {
	return &Hub{
		msgRepo:     msgRepo,
		chanRepo:    chanRepo,
		clients:     make(map[*Client]bool),
		rooms:       make(map[string]map[*Client]bool),
		voiceStates: make(map[string]map[string]*VoiceStatePayload),
		presence:    make(map[string]string),
		userMeta:    make(map[string]string),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		broadcast:   make(chan *BroadcastMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.presence[client.UserID] = "online"
			h.userMeta[client.UserID] = client.Username
			log.Printf("[WS Register] user=%s id=%s total_clients=%d", client.Username, client.UserID, len(h.clients))

			// Send current presence snapshot of existing online users to the newly connected client
			for uID, status := range h.presence {
				if status != "offline" && uID != client.UserID {
					uName := h.userMeta[uID]
					if uName == "" {
						uName = uID
					}
					pBytes, _ := json.Marshal(PresencePayload{
						UserID:   uID,
						Username: uName,
						Status:   status,
					})
					outMsg, _ := json.Marshal(WSMessage{
						Type:    EventPresenceUpdate,
						Payload: pBytes,
					})
					select {
					case client.send <- outMsg:
					default:
					}
				}
			}

			// Send current voice snapshot (who is in which voice channel)
			allVoiceStates := make([]*VoiceStatePayload, 0)
			for _, chUsers := range h.voiceStates {
				for _, vs := range chUsers {
					allVoiceStates = append(allVoiceStates, vs)
				}
			}
			if len(allVoiceStates) > 0 {
				vBytes, _ := json.Marshal(allVoiceStates)
				vMsg, _ := json.Marshal(WSMessage{
					Type:    EventVoiceSnapshot,
					Payload: vBytes,
				})
				select {
				case client.send <- vMsg:
				default:
				}
				log.Printf("[WS Voice Snapshot Sent] to=%s states_count=%d", client.Username, len(allVoiceStates))
			}

			h.mu.Unlock()

			// Broadcast new client's presence to everyone
			h.BroadcastPresence(client.UserID, client.Username, "online")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("[WS Unregister] user=%s id=%s remaining_clients=%d", client.Username, client.UserID, len(h.clients))

				// Remove from all text rooms
				for chID, room := range h.rooms {
					delete(room, client)
					if len(room) == 0 {
						delete(h.rooms, chID)
					}
				}

				// Remove from any active voice channels
				for chID, chUsers := range h.voiceStates {
					if _, inVoice := chUsers[client.UserID]; inVoice {
						delete(chUsers, client.UserID)
						if len(chUsers) == 0 {
							delete(h.voiceStates, chID)
						}

						// Broadcast user left voice
						leavePayload, _ := json.Marshal(VoiceStatePayload{
							ChannelID: chID,
							UserID:    client.UserID,
							Username:  client.Username,
						})
						outMsg, _ := json.Marshal(WSMessage{
							Type:      EventUserLeftVoice,
							ChannelID: chID,
							Payload:   leavePayload,
						})
						go func(data []byte) {
							h.broadcast <- &BroadcastMessage{ChannelID: "", Data: data}
						}(outMsg)
					}
				}

				// Check if user has no other connections before marking offline
				hasOtherConns := false
				for c := range h.clients {
					if c.UserID == client.UserID {
						hasOtherConns = true
						break
					}
				}
				if !hasOtherConns {
					h.presence[client.UserID] = "offline"
				}
			}
			h.mu.Unlock()

			h.BroadcastPresence(client.UserID, client.Username, "offline")

		case msg := <-h.broadcast:
			h.mu.RLock()
			if msg.ChannelID != "" {
				// Send to specific room
				if room, ok := h.rooms[msg.ChannelID]; ok {
					for client := range room {
						if client.send == nil {
							continue
						}
						select {
						case client.send <- msg.Data:
						default:
							// Buffer full, handled cleanly
						}
					}
				}
			} else {
				// Global broadcast to all connected clients
				for client := range h.clients {
					if client.send == nil {
						continue
					}
					select {
					case client.send <- msg.Data:
					default:
						// Buffer full, handled cleanly
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) JoinRoom(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.rooms[channelID]; !ok {
		h.rooms[channelID] = make(map[*Client]bool)
	}
	h.rooms[channelID][client] = true
	log.Printf("[WS JoinRoom] user=%s channel=%s total_in_room=%d", client.Username, channelID, len(h.rooms[channelID]))
}

func (h *Hub) LeaveRoom(client *Client, channelID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[channelID]; ok {
		delete(room, client)
		if len(room) == 0 {
			delete(h.rooms, channelID)
		}
		log.Printf("[WS LeaveRoom] user=%s channel=%s remaining_in_room=%d", client.Username, channelID, len(room))
	}
}

func (h *Hub) JoinChannel(client *Client, channelID string) {
	h.JoinRoom(client, channelID)
}

func (h *Hub) LeaveChannel(client *Client, channelID string) {
	h.LeaveRoom(client, channelID)
}

func (h *Hub) ProcessMessage(client *Client, rawData []byte) {
	var msg WSMessage
	if err := json.Unmarshal(rawData, &msg); err != nil {
		log.Printf("[WS Parse Error] from %s: %v", client.Username, err)
		return
	}

	log.Printf("[WS Recv] user=%s type=%s channel=%s", client.Username, msg.Type, msg.ChannelID)

	switch msg.Type {
	case EventChatMessage:
		var payload ChatMessagePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		payload.Content = payload.Content
		if payload.Content == "" || payload.ChannelID == "" {
			return
		}

		// Look up community_id for the channel via repository
		communityID, _ := h.chanRepo.GetCommunityID(context.Background(), payload.ChannelID)

		msgID := uuid.New().String()
		now := time.Now()

		dbMsg := &database.Message{
			ID:          msgID,
			ChannelID:   payload.ChannelID,
			CommunityID: communityID,
			UserID:      client.UserID,
			Username:    client.Username,
			Content:     payload.Content,
			CreatedAt:   now,
		}

		if err := h.msgRepo.Create(context.Background(), dbMsg); err != nil {
			log.Printf("[WS] Failed to save message: %v", err)
			return
		}

		pBytes, _ := json.Marshal(dbMsg)
		broadcastMsg, _ := json.Marshal(WSMessage{
			Type:      EventChatMessage,
			ChannelID: payload.ChannelID,
			Payload:   pBytes,
		})

		h.broadcast <- &BroadcastMessage{
			Sender:    client,
			ChannelID: "",
			Data:      broadcastMsg,
		}

	case EventUserTyping:
		var typing UserTypingPayload
		if err := json.Unmarshal(msg.Payload, &typing); err != nil {
			return
		}
		typing.UserID = client.UserID
		typing.Username = client.Username

		pBytes, _ := json.Marshal(typing)
		outMsg, _ := json.Marshal(WSMessage{
			Type:      EventUserTyping,
			ChannelID: typing.ChannelID,
			Payload:   pBytes,
		})

		h.broadcast <- &BroadcastMessage{
			Sender:    client,
			ChannelID: "",
			Data:      outMsg,
		}

	case EventPresenceUpdate:
		var presence PresencePayload
		if err := json.Unmarshal(msg.Payload, &presence); err != nil {
			return
		}
		h.BroadcastPresence(client.UserID, client.Username, presence.Status)

	case EventUserProfileUpdated:
		var profile UserProfilePayload
		if err := json.Unmarshal(msg.Payload, &profile); err != nil {
			return
		}
		profile.UserID = client.UserID
		profile.Username = client.Username
		if profile.AvatarURL == "" {
			return
		}

		pBytes, _ := json.Marshal(profile)
		outMsg, _ := json.Marshal(WSMessage{
			Type:    EventUserProfileUpdated,
			Payload: pBytes,
		})
		h.broadcast <- &BroadcastMessage{Sender: client, ChannelID: "", Data: outMsg}

	case EventUserJoinedVoice:
		var vs VoiceStatePayload
		if err := json.Unmarshal(msg.Payload, &vs); err != nil {
			log.Printf("[WS Voice Join Unmarshal Error] %v", err)
			return
		}
		vs.UserID = client.UserID
		vs.Username = client.Username

		h.mu.Lock()
		if _, ok := h.voiceStates[vs.ChannelID]; !ok {
			h.voiceStates[vs.ChannelID] = make(map[string]*VoiceStatePayload)
		}
		h.voiceStates[vs.ChannelID][client.UserID] = &vs

		// Send all current members in this channel to the joining client so they immediately see everyone and connect
		currentRoomMembers := make([]*VoiceStatePayload, 0, len(h.voiceStates[vs.ChannelID]))
		for _, memberVS := range h.voiceStates[vs.ChannelID] {
			currentRoomMembers = append(currentRoomMembers, memberVS)
		}
		totalInChannel := len(h.voiceStates[vs.ChannelID])
		h.mu.Unlock()

		log.Printf("[WS Voice Join] user=%s channel=%s total_in_channel=%d", client.Username, vs.ChannelID, totalInChannel)

		snapBytes, _ := json.Marshal(currentRoomMembers)
		snapMsg, _ := json.Marshal(WSMessage{
			Type:      EventVoiceSnapshot,
			ChannelID: vs.ChannelID,
			Payload:   snapBytes,
		})
		select {
		case client.send <- snapMsg:
		default:
		}

		pBytes, _ := json.Marshal(vs)
		outMsg, _ := json.Marshal(WSMessage{
			Type:      EventUserJoinedVoice,
			ChannelID: vs.ChannelID,
			Payload:   pBytes,
		})

		// Broadcast globally so all users see voice sidebar updates
		h.broadcast <- &BroadcastMessage{
			Sender:    client,
			ChannelID: "",
			Data:      outMsg,
		}

	case EventUserLeftVoice:
		var vs VoiceStatePayload
		if err := json.Unmarshal(msg.Payload, &vs); err != nil {
			return
		}
		vs.UserID = client.UserID
		vs.Username = client.Username

		h.mu.Lock()
		if chUsers, ok := h.voiceStates[vs.ChannelID]; ok {
			delete(chUsers, client.UserID)
			if len(chUsers) == 0 {
				delete(h.voiceStates, vs.ChannelID)
			}
		}
		h.mu.Unlock()

		log.Printf("[WS Voice Leave] user=%s channel=%s", client.Username, vs.ChannelID)

		pBytes, _ := json.Marshal(vs)
		outMsg, _ := json.Marshal(WSMessage{
			Type:      EventUserLeftVoice,
			ChannelID: vs.ChannelID,
			Payload:   pBytes,
		})

		h.broadcast <- &BroadcastMessage{
			Sender:    client,
			ChannelID: "",
			Data:      outMsg,
		}

	case EventVoiceStateUpdate:
		var vs VoiceStatePayload
		if err := json.Unmarshal(msg.Payload, &vs); err != nil {
			return
		}
		vs.UserID = client.UserID
		vs.Username = client.Username

		h.mu.Lock()
		if chUsers, ok := h.voiceStates[vs.ChannelID]; ok {
			if existing, exists := chUsers[client.UserID]; exists {
				*existing = vs
			} else {
				chUsers[client.UserID] = &vs
			}
		}
		h.mu.Unlock()

		pBytes, _ := json.Marshal(vs)
		outMsg, _ := json.Marshal(WSMessage{
			Type:      EventVoiceStateUpdate,
			ChannelID: vs.ChannelID,
			Payload:   pBytes,
		})

		h.broadcast <- &BroadcastMessage{
			Sender:    client,
			ChannelID: "",
			Data:      outMsg,
		}

	case EventWebRTCSignal:
		var sig WebRTCSignalPayload
		if err := json.Unmarshal(msg.Payload, &sig); err != nil {
			log.Printf("[WS Signal Unmarshal Error] %v", err)
			return
		}
		sig.SenderID = client.UserID
		sig.SenderUsername = client.Username

		pBytes, _ := json.Marshal(sig)
		outMsg, _ := json.Marshal(WSMessage{
			Type:      EventWebRTCSignal,
			ChannelID: sig.ChannelID,
			Payload:   pBytes,
		})

		targetCount := 0
		h.mu.RLock()
		for c := range h.clients {
			if c.UserID == sig.TargetUserID {
				targetCount++
				select {
				case c.send <- outMsg:
				default:
					log.Printf("[WS Signal Buffer Full] target=%s", c.Username)
				}
			}
		}
		h.mu.RUnlock()
		log.Printf("[WS WebRTCSignal] from=%s target=%s matched=%d channel=%s", client.Username, sig.TargetUserID, targetCount, sig.ChannelID)
	}
}

func (h *Hub) BroadcastPresence(userID, username, status string) {
	h.mu.Lock()
	h.presence[userID] = status
	if username != "" {
		h.userMeta[userID] = username
	}
	h.mu.Unlock()

	pBytes, _ := json.Marshal(PresencePayload{
		UserID:   userID,
		Username: username,
		Status:   status,
	})
	outMsg, _ := json.Marshal(WSMessage{
		Type:    EventPresenceUpdate,
		Payload: pBytes,
	})

	h.broadcast <- &BroadcastMessage{
		ChannelID: "", // global broadcast
		Data:      outMsg,
	}
}
