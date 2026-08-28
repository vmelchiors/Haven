package avatar_test

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"haven-backend/pkg/avatar"
)

func createSamplePNG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 255), G: uint8(y % 255), B: 100, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func createSampleJPEG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: 200, G: 50, B: 50, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, nil)
	return buf.Bytes()
}

func TestProcessAvatar_ValidPNG(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "avatar-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	data := createSamplePNG(500, 500)
	url, err := avatar.ProcessAvatar(bytes.NewReader(data), tempDir, "profile.png")
	if err != nil {
		t.Fatalf("ProcessAvatar failed: %v", err)
	}

	if url == "" {
		t.Errorf("expected non-empty avatar url")
	}

	// Verify the saved file is 256x256
	filename := filepath.Base(url)
	savedPath := filepath.Join(tempDir, filename)
	savedFile, err := os.Open(savedPath)
	if err != nil {
		t.Fatalf("failed to open saved avatar: %v", err)
	}
	defer savedFile.Close()

	cfg, _, err := image.DecodeConfig(savedFile)
	if err != nil {
		t.Fatalf("failed to decode saved avatar config: %v", err)
	}

	if cfg.Width != avatar.TargetWidth || cfg.Height != avatar.TargetHeight {
		t.Errorf("expected 256x256 avatar, got %dx%d", cfg.Width, cfg.Height)
	}
}

func TestProcessAvatar_ValidJPEG(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "avatar-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	data := createSampleJPEG(300, 400)
	url, err := avatar.ProcessAvatar(bytes.NewReader(data), tempDir, "avatar.jpg")
	if err != nil {
		t.Fatalf("ProcessAvatar failed for JPEG: %v", err)
	}
	if url == "" {
		t.Errorf("expected non-empty avatar url")
	}
}

func TestProcessAvatar_EmptyFile(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "avatar-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	_, err = avatar.ProcessAvatar(bytes.NewReader([]byte{}), tempDir, "empty.png")
	if err == nil {
		t.Errorf("expected error for empty avatar file")
	}
}

func TestProcessAvatar_ExceedsSizeLimit(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "avatar-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create >2MB fake buffer
	largeData := make([]byte, avatar.MaxAvatarSizeBytes+100)
	_, err = avatar.ProcessAvatar(bytes.NewReader(largeData), tempDir, "huge.png")
	if err == nil {
		t.Errorf("expected error for file exceeding 2MB")
	}
}

func TestProcessAvatar_InvalidExtension(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "avatar-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	data := createSamplePNG(100, 100)
	_, err = avatar.ProcessAvatar(bytes.NewReader(data), tempDir, "virus.exe")
	if err == nil {
		t.Errorf("expected error for unsupported extension")
	}
}

func TestProcessImageDirectly(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 100, 100))
	dst, err := avatar.ProcessImageDirectly(src)
	if err != nil {
		t.Fatalf("ProcessImageDirectly failed: %v", err)
	}
	if dst.Bounds().Dx() != avatar.TargetWidth || dst.Bounds().Dy() != avatar.TargetHeight {
		t.Errorf("expected 256x256, got %dx%d", dst.Bounds().Dx(), dst.Bounds().Dy())
	}

	_, err = avatar.ProcessImageDirectly(nil)
	if err == nil {
		t.Errorf("expected error for nil image")
	}
}
