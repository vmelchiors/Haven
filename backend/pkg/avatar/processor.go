package avatar

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	MaxAvatarSizeBytes = 2 * 1024 * 1024 // 2 MB max
	TargetWidth        = 256
	TargetHeight       = 256
)

// ProcessAvatar validates, strips EXIF, resizes to 256x256, and saves as clean PNG
func ProcessAvatar(r io.Reader, uploadDir string, filenameHint string) (string, error) {
	// Read with limit to prevent unbounded memory usage
	limitedReader := io.LimitReader(r, MaxAvatarSizeBytes+1)
	buf, err := io.ReadAll(limitedReader)
	if err != nil {
		return "", fmt.Errorf("failed to read avatar data: %w", err)
	}

	if len(buf) > MaxAvatarSizeBytes {
		return "", fmt.Errorf("avatar file exceeds maximum size of 2MB")
	}

	if len(buf) == 0 {
		return "", fmt.Errorf("avatar file is empty")
	}

	// Validate extension
	ext := strings.ToLower(filepath.Ext(filenameHint))
	allowed := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".webp": true,
	}
	if ext != "" && !allowed[ext] {
		return "", fmt.Errorf("unsupported image format: %s (only .png, .jpg, .webp allowed)", ext)
	}

	// Decode image (this automatically strips EXIF metadata since we only take raw decoded image.Image)
	img, format, err := image.Decode(bytes.NewReader(buf))
	if err != nil {
		return "", fmt.Errorf("failed to decode image (format: %s): %w", format, err)
	}

	// Create 256x256 clean canvas
	dst := image.NewRGBA(image.Rect(0, 0, TargetWidth, TargetHeight))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)

	// Ensure upload directory exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Generate unique filename
	newFilename := fmt.Sprintf("avatar_%s.png", uuid.New().String())
	targetPath := filepath.Join(uploadDir, newFilename)

	outFile, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create avatar file: %w", err)
	}
	defer outFile.Close()

	if err := png.Encode(outFile, dst); err != nil {
		return "", fmt.Errorf("failed to encode avatar png: %w", err)
	}

	// Return public URL path
	return fmt.Sprintf("/uploads/%s", newFilename), nil
}

// ProcessImageDirectly processes image.Image directly for unit testing
func ProcessImageDirectly(img image.Image) (*image.RGBA, error) {
	if img == nil {
		return nil, fmt.Errorf("nil image provided")
	}
	dst := image.NewRGBA(image.Rect(0, 0, TargetWidth, TargetHeight))
	draw.BiLinear.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
	return dst, nil
}

// Ensure JPEG decoder registration
func init() {
	_ = jpeg.DefaultQuality
}
