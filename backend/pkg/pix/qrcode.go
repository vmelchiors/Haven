package pix

import (
	"encoding/base64"
	"fmt"

	"github.com/skip2/go-qrcode"
)

// GenerateQRCodeBase64 generates a base64-encoded PNG QR Code for a given payload string
func GenerateQRCodeBase64(content string, size int) (string, error) {
	if size <= 0 {
		size = 256
	}

	pngData, err := qrcode.Encode(content, qrcode.Medium, size)
	if err != nil {
		return "", fmt.Errorf("failed to generate qr code png: %w", err)
	}

	b64 := base64.StdEncoding.EncodeToString(pngData)
	return fmt.Sprintf("data:image/png;base64,%s", b64), nil
}
