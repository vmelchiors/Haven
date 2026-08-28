package donate

import (
	"fmt"

	"haven-backend/internal/config"
	"haven-backend/pkg/pix"
)

type Service struct {
	cfg *config.Config
}

func NewService(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

type PixDonationResponse struct {
	Payload      string  `json:"payload"`        // Copia e Cola BRCode
	QRCodeBase64 string  `json:"qr_code_base64"` // data:image/png;base64,...
	PixKey       string  `json:"pix_key"`
	MerchantName string  `json:"merchant_name"`
	MerchantCity string  `json:"merchant_city"`
	Currency     string  `json:"currency"`
	Description  string  `json:"description"`
	Amount       float64 `json:"amount,omitempty"`
}

// GeneratePixDonation creates the static BRCode and Base64 QR Code image for Haven donations
func (s *Service) GeneratePixDonation(amount float64, description string) (*PixDonationResponse, error) {
	if description == "" {
		description = "Doacao Haven Project"
	}

	pixConfig := pix.PixPayloadConfig{
		Key:          s.cfg.PixKey,
		MerchantName: s.cfg.PixMerchantName,
		MerchantCity: s.cfg.PixMerchantCity,
		Amount:       amount,
		TxID:         "***",
		Description:  description,
	}

	payload, err := pix.GenerateBRCode(pixConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate pix brcode: %w", err)
	}

	qrCodeB64, err := pix.GenerateQRCodeBase64(payload, 300)
	if err != nil {
		return nil, fmt.Errorf("failed to generate qr code: %w", err)
	}

	return &PixDonationResponse{
		Payload:      payload,
		QRCodeBase64: qrCodeB64,
		PixKey:       s.cfg.PixKey,
		MerchantName: s.cfg.PixMerchantName,
		MerchantCity: s.cfg.PixMerchantCity,
		Currency:     "BRL (R$)",
		Description:  description,
		Amount:       amount,
	}, nil
}
