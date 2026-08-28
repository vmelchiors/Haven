package donate_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"haven-backend/internal/config"
	"haven-backend/internal/donate"
)

func TestDonateService_GeneratePixDonation(t *testing.T) {
	cfg := &config.Config{
		PixKey:          "donate@haven.chat",
		PixMerchantName: "HAVEN FOUNDATION",
		PixMerchantCity: "SAO PAULO",
	}

	svc := donate.NewService(cfg)
	res, err := svc.GeneratePixDonation(50.0, "Haven Support")
	if err != nil {
		t.Fatalf("GeneratePixDonation failed: %v", err)
	}

	if res.Payload == "" {
		t.Errorf("expected non-empty PIX BRCode payload")
	}
	if res.QRCodeBase64 == "" {
		t.Errorf("expected non-empty QR Code Base64")
	}
	if res.Amount != 50.0 {
		t.Errorf("expected amount 50.0, got %f", res.Amount)
	}
	if res.PixKey != "donate@haven.chat" {
		t.Errorf("expected pix key match")
	}
}

func TestDonateHandler_HTTP(t *testing.T) {
	cfg := &config.Config{
		PixKey:          "donate@haven.chat",
		PixMerchantName: "HAVEN FOUNDATION",
		PixMerchantCity: "SAO PAULO",
	}
	svc := donate.NewService(cfg)
	handler := donate.NewHandler(svc)

	req := httptest.NewRequest("GET", "/api/donate/pix?amount=25.0&description=Coffee", nil)
	w := httptest.NewRecorder()

	handler.GetPixDonation(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on GetPixDonation, got %d: %s", w.Code, w.Body.String())
	}

	var res donate.PixDonationResponse
	if err := json.NewDecoder(w.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res.Amount != 25.0 {
		t.Errorf("expected amount 25.0, got %f", res.Amount)
	}
	if res.Payload == "" || res.QRCodeBase64 == "" {
		t.Errorf("expected payload and qr code")
	}
}
