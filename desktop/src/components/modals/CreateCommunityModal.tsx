import React, { useState, useEffect } from 'react';
import { Copy, Check, Lock, Globe, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCommunityStore } from '../../stores/communityStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { generatePixPayload } from '../../lib/pix';

export const CreateCommunityModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'create_community');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const createCommunity = useCommunityStore((s) => s.createCommunity);
  const fetchPendingCommunities = useCommunityStore((s) => s.fetchPendingCommunities);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixPayload, setPixPayload] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate R$ 15,00 PIX Payload
  useEffect(() => {
    try {
      const payload = generatePixPayload({
        key: 'haven@domain.org',
        merchantName: 'HAVEN PROJECT',
        merchantCity: 'MANAUS',
        amount: 15.0,
        txId: 'COMMUNITY_FEE',
        description: 'Criacao de Comunidade Haven',
      });
      setPixPayload(payload);
    } catch {
      setPixPayload('00020126580014br.gov.bcb.pix0116haven@domain.org520400005303986540515.005802BR5913HAVEN PROJECT6006MANAUS62170513COMMUNITY_FEE6304');
    }
  }, []);

  const handleCopyPix = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome da comunidade é obrigatório');
      return;
    }
    if (name.length < 3 || name.length > 32) {
      setError('Nome deve ter entre 3 e 32 caracteres');
      return;
    }
    if (!receiptFile) {
      setError('Anexe o comprovante PIX (R$ 15,00)');
      return;
    }

    setIsLoading(true);
    setError(null);

    const comm = await createCommunity(name.trim(), description.trim(), receiptFile, iconFile || undefined, isPrivate);
    setIsLoading(false);

    if (comm) {
      setName('');
      setDescription('');
      setIsPrivate(false);
      setIconFile(null);
      setReceiptFile(null);
      await fetchPendingCommunities();
      closeModal();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Criar Comunidade"
      description="Configure os dados da sua comunidade e anexe o comprovante da taxa anti-spam de R$ 15,00"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Name and Description */}
        <Input
          label="Nome da Comunidade"
          placeholder="Ex: Haven Devs, Amigos..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={32}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Descrição (Opcional)
          </label>
          <textarea
            rows={2}
            maxLength={200}
            placeholder="Sobre o que é a comunidade..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-haven-darker border border-haven-border rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-haven-accent transition-colors resize-none"
          />
        </div>

        {/* Privacy Switch */}
        <div
          onClick={() => setIsPrivate(!isPrivate)}
          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-colors ${
            isPrivate ? 'bg-amber-950/20 border-amber-500/30' : 'bg-haven-darker border-haven-border hover:border-zinc-500'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isPrivate ? 'bg-amber-500/20 text-amber-400' : 'bg-haven-card text-zinc-400'}`}>
              {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                {isPrivate ? 'Comunidade Privada' : 'Comunidade Pública'}
              </div>
              <div className="text-[10px] text-zinc-400">
                {isPrivate ? 'Apenas com código de convite ou ID' : 'Visível para todos os usuários'}
              </div>
            </div>
          </div>
          <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${isPrivate ? 'bg-amber-500' : 'bg-zinc-700'}`}>
            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </div>

        {/* Anti-spam Fee & Receipt */}
        <div className="bg-haven-card border border-haven-border rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Taxa Anti-Spam: <strong className="text-haven-emerald">R$ 15,00</strong></span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyPix}
              className="gap-1 text-xs py-1 px-2.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar PIX'}</span>
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Comprovante PIX (Obrigatório)
            </label>
            <input
              type="file"
              required
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              className="text-xs text-zinc-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-haven-surface file:text-zinc-200 hover:file:bg-haven-surface-hover cursor-pointer"
            />
          </div>
        </div>

        {error && <div className="text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">{error}</div>}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-haven-border">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading} className="text-xs font-semibold">
            Criar Comunidade
          </Button>
        </div>
      </form>
    </Modal>
  );
};
