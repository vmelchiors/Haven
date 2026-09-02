package community

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"haven-backend/internal/auth"
	"haven-backend/internal/config"
	"haven-backend/pkg/avatar"
)

type Handler struct {
	service        *Service
	cfg            *config.Config
	memberNotifier MemberUpdateNotifier
}

type MemberUpdateNotifier interface {
	NotifyCommunityMembersUpdated(communityID string)
}

func NewHandler(service *Service, cfg *config.Config) *Handler {
	return &Handler{
		service: service,
		cfg:     cfg,
	}
}

func (h *Handler) SetMemberUpdateNotifier(notifier MemberUpdateNotifier) {
	h.memberNotifier = notifier
}

type RejectRequest struct {
	RejectionReason string `json:"rejection_reason"`
}

type JoinCommunityRequest struct {
	InviteCode string `json:"invite_code"`
	Identifier string `json:"identifier"`
}

type UpdateCommunityRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPrivate   bool   `json:"is_private"`
}

// CreateRequest handles user submitting a new community with mandatory anti-spam receipt (multipart/form-data)
func (h *Handler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// 10 MB max multipart form limit (5MB receipt + 2MB icon + form fields)
	const maxFormSize = 10 * 1024 * 1024
	if err := r.ParseMultipartForm(maxFormSize); err != nil {
		httpError(w, "form data too large or invalid multipart form", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	description := r.FormValue("description")
	isPrivate := r.FormValue("is_private") == "true" || r.FormValue("is_private") == "1"

	// 1. Process optional Icon
	iconURL := ""
	iconFile, iconHeader, err := r.FormFile("icon")
	if err == nil && iconFile != nil {
		defer iconFile.Close()
		processedIconURL, procErr := avatar.ProcessAvatar(iconFile, h.cfg.UploadDir, iconHeader.Filename)
		if procErr == nil {
			iconURL = processedIconURL
		}
	}

	// 2. Process required Receipt File (.pdf, .png, .jpeg, max 5 MB)
	receiptFile, receiptHeader, err := r.FormFile("receipt_file")
	if err != nil || receiptFile == nil {
		httpError(w, "o comprovante de doação PIX (R$ 15,00) é obrigatório", http.StatusBadRequest)
		return
	}
	defer receiptFile.Close()

	ext := strings.ToLower(filepath.Ext(receiptHeader.Filename))
	allowedExts := map[string]bool{
		".pdf":  true,
		".png":  true,
		".jpg":  true,
		".jpeg": true,
	}
	if !allowedExts[ext] {
		httpError(w, "formato de comprovante inválido (apenas .pdf, .png, .jpeg permitidos)", http.StatusBadRequest)
		return
	}

	// Ensure receipts directory exists
	if err := os.MkdirAll(h.cfg.ReceiptsDir, 0755); err != nil {
		httpError(w, "erro interno ao preparar diretório de comprovantes", http.StatusInternalServerError)
		return
	}

	receiptFilename := fmt.Sprintf("receipt_%s%s", uuid.New().String(), ext)
	receiptPath := filepath.Join(h.cfg.ReceiptsDir, receiptFilename)

	dst, err := os.Create(receiptPath)
	if err != nil {
		httpError(w, "falha ao salvar arquivo de comprovante", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Enforce 5MB limit on receipt
	const maxReceiptSize = 5 * 1024 * 1024
	lr := io.LimitReader(receiptFile, maxReceiptSize+1)
	written, err := io.Copy(dst, lr)
	if err != nil {
		_ = os.Remove(receiptPath)
		httpError(w, "erro ao gravar comprovante", http.StatusInternalServerError)
		return
	}
	if written > maxReceiptSize {
		_ = os.Remove(receiptPath)
		httpError(w, "o arquivo de comprovante excede o tamanho máximo de 5MB", http.StatusBadRequest)
		return
	}

	comm, err := h.service.CreateRequest(claims.UserID, name, description, iconURL, receiptPath, 1500, isPrivate)
	if err != nil {
		_ = os.Remove(receiptPath)
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusCreated, comm)
}

// Update handles modifying an existing community (Owner or Admin only)
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var name, description, iconURL string
	var isPrivate bool

	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		const maxFormSize = 10 * 1024 * 1024
		if err := r.ParseMultipartForm(maxFormSize); err != nil {
			httpError(w, "form data too large or invalid multipart form", http.StatusBadRequest)
			return
		}
		name = r.FormValue("name")
		description = r.FormValue("description")
		isPrivate = r.FormValue("is_private") == "true" || r.FormValue("is_private") == "1"

		iconFile, iconHeader, err := r.FormFile("icon")
		if err == nil && iconFile != nil {
			defer iconFile.Close()
			processedIconURL, procErr := avatar.ProcessAvatar(iconFile, h.cfg.UploadDir, iconHeader.Filename)
			if procErr == nil {
				iconURL = processedIconURL
			}
		}
	} else {
		var req UpdateCommunityRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpError(w, "invalid request body", http.StatusBadRequest)
			return
		}
		name = req.Name
		description = req.Description
		isPrivate = req.IsPrivate
	}

	updated, err := h.service.Update(communityID, claims.UserID, claims.IsAdmin, name, description, iconURL, isPrivate)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorized) {
			httpError(w, "apenas o proprietário ou administrador pode editar esta comunidade", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	jsonResponse(w, http.StatusOK, updated)
}

// ListApproved lists all approved communities accessible to user
func (h *Handler) ListApproved(w http.ResponseWriter, r *http.Request) {
	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	list, err := h.service.ListApproved(userID, isAdmin)
	if err != nil {
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, list)
}

// GetByID returns community info with channels
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	comm, err := h.service.GetByID(communityID, userID, isAdmin)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrCommunityPending) || errors.Is(err, ErrCommunityRejected) || errors.Is(err, ErrUnauthorized) {
			httpError(w, err.Error(), http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, comm)
}

// Join handles joining a community using either an invite code OR community ID
func (h *Handler) Join(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req JoinCommunityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	code := req.InviteCode
	if code == "" {
		code = req.Identifier
	}

	comm, err := h.service.Join(claims.UserID, code)
	if err != nil {
		if errors.Is(err, ErrInvalidInviteCode) {
			httpError(w, "ID ou código de convite inválido ou comunidade ainda não aprovada", http.StatusBadRequest)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if h.memberNotifier != nil {
		h.memberNotifier.NotifyCommunityMembersUpdated(comm.ID)
	}

	jsonResponse(w, http.StatusOK, comm)
}

// ListPending returns pending communities for admin moderation
func (h *Handler) ListPending(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListPending()
	if err != nil {
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, list)
}

// GetReceipt serves the protected receipt file to admin
func (h *Handler) GetReceipt(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	filePath, err := h.service.GetReceiptFilePath(communityID)
	if err != nil {
		httpError(w, "comprovante não encontrado", http.StatusNotFound)
		return
	}

	file, err := os.Open(filePath)
	if err != nil {
		httpError(w, "erro ao ler arquivo de comprovante", http.StatusNotFound)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".pdf":
		w.Header().Set("Content-Type", "application/pdf")
	case ".png":
		w.Header().Set("Content-Type", "image/png")
	case ".jpg", ".jpeg":
		w.Header().Set("Content-Type", "image/jpeg")
	default:
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%s", filepath.Base(filePath)))
	_, _ = io.Copy(w, file)
}

// Approve handles admin approval of a pending community
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	comm, err := h.service.Approve(communityID)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, comm)
}

// Reject handles admin rejection of a pending community
func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	var req RejectRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	comm, err := h.service.Reject(communityID, req.RejectionReason)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, comm)
}

// Delete handles community deletion
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims)
	if !ok || claims == nil {
		httpError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.service.Delete(communityID, claims.UserID, claims.IsAdmin)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		if errors.Is(err, ErrUnauthorized) {
			httpError(w, "unauthorized", http.StatusForbidden)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"message": "community deleted"})
}

// ListMembers handles GET /api/communities/{id}/members
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	communityID := chi.URLParam(r, "id")
	if communityID == "" {
		httpError(w, "community id required", http.StatusBadRequest)
		return
	}

	var userID string
	var isAdmin bool
	if claims, ok := r.Context().Value(auth.UserContextKey).(*auth.Claims); ok && claims != nil {
		userID = claims.UserID
		isAdmin = claims.IsAdmin
	}

	members, err := h.service.ListMembers(communityID, userID, isAdmin)
	if err != nil {
		if errors.Is(err, ErrCommunityNotFound) {
			httpError(w, "community not found", http.StatusNotFound)
			return
		}
		httpError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, members)
}

func httpError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(data)
}
