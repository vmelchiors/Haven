package donate

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type PixConfigResponse struct {
	PixKey       string  `json:"pix_key"`
	MerchantName string  `json:"merchant_name"`
	MerchantCity string  `json:"merchant_city"`
	FixedAmount  float64 `json:"fixed_amount"` // 15.00 default for community creation
	Currency     string  `json:"currency"`
}

// GetPixConfig returns public PIX information for client-side zero-latency QR Code computation
func (h *Handler) GetPixConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(&PixConfigResponse{
		PixKey:       h.service.cfg.PixKey,
		MerchantName: h.service.cfg.PixMerchantName,
		MerchantCity: h.service.cfg.PixMerchantCity,
		FixedAmount:  15.00,
		Currency:     "BRL",
	})
}

// GetPixDonation returns PIX Copia e Cola and QR Code generated on the server
func (h *Handler) GetPixDonation(w http.ResponseWriter, r *http.Request) {
	amountStr := r.URL.Query().Get("amount")
	desc := r.URL.Query().Get("description")

	var amount float64
	if amountStr != "" {
		if val, err := strconv.ParseFloat(amountStr, 64); err == nil && val > 0 {
			amount = val
		}
	}

	res, err := h.service.GeneratePixDonation(amount, desc)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(res)
}
