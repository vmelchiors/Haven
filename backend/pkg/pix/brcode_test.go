package pix_test

import (
	"strings"
	"testing"

	"haven-backend/pkg/pix"
)

func TestGenerateBRCode_Valid(t *testing.T) {
	cfg := pix.PixPayloadConfig{
		Key:          "haven@domain.org",
		MerchantName: "HAVEN FOUNDATION",
		MerchantCity: "SAO PAULO",
		Amount:       25.50,
		TxID:         "DONATION123",
		Description:  "Donation",
	}

	brcode, err := pix.GenerateBRCode(cfg)
	if err != nil {
		t.Fatalf("GenerateBRCode failed: %v", err)
	}

	// Must start with EMV 000201 (Payload format)
	if !strings.HasPrefix(brcode, "000201") {
		t.Errorf("expected brcode to start with '000201', got %s", brcode)
	}

	// Must contain PIX GUI
	if !strings.Contains(brcode, "br.gov.bcb.pix") {
		t.Errorf("expected brcode to contain PIX GUI 'br.gov.bcb.pix'")
	}

	// Must contain Key
	if !strings.Contains(brcode, "haven@domain.org") {
		t.Errorf("expected brcode to contain Pix key")
	}

	// Must contain Merchant Name
	if !strings.Contains(brcode, "HAVEN FOUNDATION") {
		t.Errorf("expected brcode to contain Merchant Name")
	}

	// Must contain City
	if !strings.Contains(brcode, "SAO PAULO") {
		t.Errorf("expected brcode to contain City")
	}

	// Must contain Amount 25.50 (Tag 54)
	if !strings.Contains(brcode, "540525.50") {
		t.Errorf("expected brcode to contain amount tag 540525.50")
	}

	// Must end with 6304 + 4-char CRC16 hex
	if len(brcode) < 8 || !strings.Contains(brcode, "6304") {
		t.Errorf("expected brcode to contain CRC16 tag '6304'")
	}
}

func TestGenerateBRCode_EmptyKey(t *testing.T) {
	cfg := pix.PixPayloadConfig{
		Key: "",
	}
	_, err := pix.GenerateBRCode(cfg)
	if err == nil {
		t.Errorf("expected error when Pix key is empty")
	}
}

func TestGenerateBRCode_OpenAmount(t *testing.T) {
	cfg := pix.PixPayloadConfig{
		Key:          "user@haven.chat",
		MerchantName: "Haven",
		MerchantCity: "Rio",
		Amount:       0, // Open donation
	}

	brcode, err := pix.GenerateBRCode(cfg)
	if err != nil {
		t.Fatalf("GenerateBRCode failed: %v", err)
	}

	// When amount is 0, tag 54 should NOT be present
	if strings.Contains(brcode, "540") {
		t.Errorf("expected brcode with amount 0 to omit tag 54")
	}
}

func TestGenerateQRCodeBase64(t *testing.T) {
	content := "00020126580014br.gov.bcb.pix0116haven@domain.org5204000053039865802BR5916HAVEN FOUNDATION6009SAO PAULO62150511DONATION1236304"
	qr, err := pix.GenerateQRCodeBase64(content, 256)
	if err != nil {
		t.Fatalf("GenerateQRCodeBase64 failed: %v", err)
	}

	if !strings.HasPrefix(qr, "data:image/png;base64,") {
		t.Errorf("expected data URI format, got %s", qr)
	}
}
