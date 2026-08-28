package chat

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer (64 KB)
	maxMessageSize = 64 * 1024

	// WebSocket per-connection rate limit
	wsRateLimitPerSec = 20.0
	wsBurstCapacity   = 30.0
)

type Client struct {
	Hub        *Hub
	Conn       *websocket.Conn
	send       chan []byte
	UserID     string
	Username   string
	rateTokens float64
	lastRate   time.Time
}

func NewClient(hub *Hub, conn *websocket.Conn, userID, username string) *Client {
	now := time.Now()
	return &Client{
		Hub:        hub,
		Conn:       conn,
		send:       make(chan []byte, 256),
		UserID:     userID,
		Username:   username,
		rateTokens: wsBurstCapacity,
		lastRate:   now,
	}
}

// readPump pumps messages from the websocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] Error reading message from user %s: %v", c.Username, err)
			}
			break
		}

		// Per-connection Anti-Flood Rate Limiting
		now := time.Now()
		elapsed := now.Sub(c.lastRate).Seconds()
		c.rateTokens += elapsed * wsRateLimitPerSec
		if c.rateTokens > wsBurstCapacity {
			c.rateTokens = wsBurstCapacity
		}
		c.lastRate = now

		if c.rateTokens < 1.0 {
			log.Printf("[WS Anti-Flood] Throttling message from %s (UserID=%s)", c.Username, c.UserID)
			continue
		}
		c.rateTokens -= 1.0

		c.Hub.ProcessMessage(c, message)
	}
}

// writePump pumps messages from the hub to the websocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
