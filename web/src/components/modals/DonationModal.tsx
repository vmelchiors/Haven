import React, { useState, useEffect } from 'react';
import { Copy, Check, QrCode, Send, Heart, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { generatePixPayload } from '../../lib/pix';

export const DonationModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'donate');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const createFeedback = useFeedbackStore((s) => s.createFeedback);

  const [pixPayload, setPixPayload] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState('haven@domain.org');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Comment state
  const [comment, setComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentSent, setCommentSent] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch PIX info from backend (with QR Code image)
    const loadPixInfo = async () => {
      try {
        const res = await fetch('/api/donate/pix');
        if (res.ok) {
          const data = await res.json();
          if (data.payload) setPixPayload(data.payload);
          if (data.qr_code_base64) setQrCodeBase64(data.qr_code_base64);
          if (data.pix_key) setPixKey(data.pix_key);
          return;
        }
      } catch {
        // Fallback
      }

      try {
        const fallback = generatePixPayload({
          key: pixKey,
          merchantName: 'HAVEN PROJECT',
          merchantCity: 'MANAUS',
          txId: 'DONATION',
          description: 'Apoio Haven',
        });
        setPixPayload(fallback);
      } catch {
        setPixPayload('');
      }
    };

    loadPixInfo();
  }, [isOpen, pixKey]);

  const handleCopyPayload = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  };

  const handleCopyKey = () => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSendingComment(true);
    await createFeedback('SUGGESTION', 'Mensagem de Apoio ao Projeto', comment.trim());
    setIsSendingComment(false);
    setCommentSent(true);
    setComment('');
    setTimeout(() => setCommentSent(false), 3500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Apoie o Projeto"
      description="Contribua com qualquer valor para manter os servidores de voz e a infraestrutura operando com baixa latência"
      maxWidth="md"
    >
      <div className="flex flex-col gap-3.5">
        {/* QR Code & Direct Key Display */}
        <div className="bg-haven-card p-4 rounded-xl border border-haven-border flex flex-col items-center gap-3">
          {qrCodeBase64 ? (
            <div className="bg-white p-2 rounded-lg shadow-subtle">
              <img
                src={`data:image/png;base64,${qrCodeBase64}`}
                alt="QR Code PIX"
                className="w-40 h-40 object-contain rounded"
              />
            </div>
          ) : (
            <div className="w-40 h-40 bg-haven-surface border border-dashed border-haven-border rounded-xl flex flex-col items-center justify-center text-zinc-500 gap-2">
              <QrCode className="w-8 h-8 opacity-50" />
              <span className="text-[10px]">Aponte a câmera</span>
            </div>
          )}

          {/* Chave PIX */}
          <div className="flex items-center gap-2 bg-haven-darker border border-haven-border px-3 py-1.5 rounded-lg text-xs">
            <span className="text-zinc-400">Chave PIX:</span>
            <strong className="text-zinc-200 font-mono">{pixKey}</strong>
            <button
              onClick={handleCopyKey}
              className="ml-1 p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Copiar Chave PIX"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* PIX Copia e Cola */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Código PIX "Copia e Cola"
          </label>
          <div className="bg-haven-darker p-2 rounded-xl border border-haven-border flex items-center gap-2">
            <input
              readOnly
              value={pixPayload}
              className="flex-1 bg-transparent font-mono text-xs text-zinc-300 focus:outline-none select-all truncate px-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCopyPayload}
              className="flex-shrink-0 gap-1.5"
            >
              {copiedPayload ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPayload ? 'Copiado!' : 'Copiar'}</span>
            </Button>
          </div>
        </div>

        {/* Mensagem / Comentário */}
        <form onSubmit={handleSendComment} className="flex flex-col gap-2 pt-2 border-t border-haven-border">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            Mensagem para a plataforma (opcional)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva sua mensagem de apoio..."
              className="flex-1 bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-haven-accent"
              maxLength={200}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={isSendingComment}
              disabled={!comment.trim()}
              className="gap-1 text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </Button>
          </div>

          {commentSent && (
            <div className="flex items-center gap-1.5 text-[11px] text-haven-emerald animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mensagem de apoio enviada! Obrigado.</span>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
};
