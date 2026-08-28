package pix

import (
	"fmt"
	"strings"
	"unicode"
)

// PixPayloadConfig contains the configuration for generating a static PIX BRCode
type PixPayloadConfig struct {
	Key          string
	MerchantName string
	MerchantCity string
	Amount       float64 // 0 for open donation amount
	TxID         string  // "***" default
	Description  string
}

// GenerateBRCode generates the EMVCo compliant BRCode payload string for PIX
func GenerateBRCode(config PixPayloadConfig) (string, error) {
	if config.Key == "" {
		return "", fmt.Errorf("pix key cannot be empty")
	}

	merchantName := sanitizeString(config.MerchantName)
	if merchantName == "" {
		merchantName = "HAVEN PROJECT"
	}
	if len(merchantName) > 25 {
		merchantName = merchantName[:25]
	}

	merchantCity := sanitizeString(config.MerchantCity)
	if merchantCity == "" {
		merchantCity = "SAO PAULO"
	}
	if len(merchantCity) > 15 {
		merchantCity = merchantCity[:15]
	}

	txID := config.TxID
	if txID == "" {
		txID = "***"
	}
	if len(txID) > 25 {
		txID = txID[:25]
	}

	// 00: Payload Format Indicator
	payload := formatEMV("00", "01")

	// 26: Merchant Account Information - Pix
	maiGUI := formatEMV("00", "br.gov.bcb.pix")
	maiKey := formatEMV("01", config.Key)
	maiDesc := ""
	if config.Description != "" {
		descSanitized := sanitizeString(config.Description)
		if len(descSanitized) > 40 {
			descSanitized = descSanitized[:40]
		}
		maiDesc = formatEMV("02", descSanitized)
	}
	payload += formatEMV("26", maiGUI+maiKey+maiDesc)

	// 52: Merchant Category Code
	payload += formatEMV("52", "0000")

	// 53: Transaction Currency (986 = BRL)
	payload += formatEMV("53", "986")

	// 54: Transaction Amount (optional)
	if config.Amount > 0 {
		amountStr := fmt.Sprintf("%.2f", config.Amount)
		payload += formatEMV("54", amountStr)
	}

	// 58: Country Code
	payload += formatEMV("58", "BR")

	// 59: Merchant Name
	payload += formatEMV("59", merchantName)

	// 60: Merchant City
	payload += formatEMV("60", merchantCity)

	// 62: Additional Data Field (TxID)
	addTxID := formatEMV("05", txID)
	payload += formatEMV("62", addTxID)

	// 63: CRC16 calculation placeholder
	payloadWithCRCKey := payload + "6304"
	crc := calculateCRC16CCITT([]byte(payloadWithCRCKey))
	finalPayload := payloadWithCRCKey + fmt.Sprintf("%04X", crc)

	return finalPayload, nil
}

func formatEMV(id, value string) string {
	return fmt.Sprintf("%s%02d%s", id, len(value), value)
}

func sanitizeString(s string) string {
	var builder strings.Builder
	for _, r := range strings.ToUpper(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
			builder.WriteRune(r)
		}
	}
	return strings.TrimSpace(builder.String())
}

// calculateCRC16CCITT computes the standard EMV CRC16 (poly 0x1021, init 0xFFFF)
func calculateCRC16CCITT(data []byte) uint16 {
	var crc uint16 = 0xFFFF
	const poly uint16 = 0x1021

	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if (crc & 0x8000) != 0 {
				crc = (crc << 1) ^ poly
			} else {
				crc = crc << 1
			}
		}
	}

	return crc
}
