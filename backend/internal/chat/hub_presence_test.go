package chat

import (
	"encoding/json"
	"testing"
	"time"
)

func waitForHubCondition(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("timed out waiting for hub state")
}

func drainClientMessages(client *Client) {
	for {
		select {
		case <-client.send:
		default:
			return
		}
	}
}

func TestPresenceStaysOnlineUntilLastConnectionCloses(t *testing.T) {
	hub := NewHub(nil, nil)
	go hub.Run()

	first := NewClient(hub, nil, "user-1", "Alice")
	second := NewClient(hub, nil, "user-1", "Alice")
	observer := NewClient(hub, nil, "user-2", "Bob")

	hub.register <- first
	hub.register <- second
	hub.register <- observer
	waitForHubCondition(t, func() bool {
		hub.mu.RLock()
		defer hub.mu.RUnlock()
		return len(hub.clients) == 3
	})
	drainClientMessages(first)
	drainClientMessages(second)
	drainClientMessages(observer)

	hub.unregister <- first
	waitForHubCondition(t, func() bool {
		hub.mu.RLock()
		defer hub.mu.RUnlock()
		return len(hub.clients) == 2
	})

	hub.mu.RLock()
	statusAfterFirstClose := hub.presence["user-1"]
	hub.mu.RUnlock()
	if statusAfterFirstClose != "online" {
		t.Fatalf("expected user to remain online, got %q", statusAfterFirstClose)
	}

	select {
	case data := <-observer.send:
		var message WSMessage
		_ = json.Unmarshal(data, &message)
		if message.Type == EventPresenceUpdate {
			var payload PresencePayload
			_ = json.Unmarshal(message.Payload, &payload)
			if payload.UserID == "user-1" && payload.Status == "offline" {
				t.Fatal("received offline event while another connection was active")
			}
		}
	case <-time.After(75 * time.Millisecond):
	}

	hub.unregister <- second
	deadline := time.After(time.Second)
	for {
		select {
		case data := <-observer.send:
			var message WSMessage
			if err := json.Unmarshal(data, &message); err != nil || message.Type != EventPresenceUpdate {
				continue
			}
			var payload PresencePayload
			if err := json.Unmarshal(message.Payload, &payload); err == nil && payload.UserID == "user-1" && payload.Status == "offline" {
				return
			}
		case <-deadline:
			t.Fatal("expected offline event after final connection closed")
		}
	}
}
