import React, { useState, useEffect } from 'react';
import { Copy, Check, Lock, Globe, Trash2, Camera } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useCommunityStore } from '../../stores/communityStore';
import { useSettingsStore } from '../../stores/settingsStore';

export const EditCommunityModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'edit_community');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const selectedCommunity = useCommunityStore((s) => s.selectedCommunity);
  const updateCommunity = useCommunityStore((s) => s.updateCommunity);
  const deleteCommunity = useCommunityStore((s) => s.deleteCommunity);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedCommunity) {
      setName(selectedCommunity.name || '');
      setDescription(selectedCommunity.description || '');
      setIsPrivate(Boolean(selectedCommunity.is_private));
      setIconFile(null);
      setIconPreview(null);
      setIsConfirmingDelete(false);
      setError(null);
    }
  }, [isOpen, selectedCommunity]);

  if (!selectedCommunity) return null;

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIconFile(file);
      setIconPreview(URL.createObjectURL(file));
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(selectedCommunity.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyInvite = () => {
    if (!selectedCommunity.invite_code) return;
    navigator.clipboard.writeText(selectedCommunity.invite_code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome da comunidade é obrigatório');
      return;
    }

    setIsLoading(true);
    setError(null);

    const updated = await updateCommunity(
      selectedCommunity.id,
      name.trim(),
      description.trim(),
      isPrivate,
      iconFile || undefined
    );
    setIsLoading(false);

    if (updated) {
      closeModal();
    } else {
      setError('Erro ao salvar alterações da comunidade.');
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    const success = await deleteCommunity(selectedCommunity.id);
    setIsLoading(false);

    if (success) {
      closeModal();
    } else {
      setError('Erro ao excluir comunidade.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Configurações da Comunidade"
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Quick Share Bar (ID and Invite Code) */}
        <div className="flex flex-wrap items-center gap-2 bg-haven-card p-2.5 rounded-xl border border-haven-border">
          {/* Community ID */}
          <button
            type="button"
            onClick={handleCopyId}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-haven-surface hover:bg-haven-surface-hover border border-haven-border rounded-lg text-xs text-zinc-300 transition-colors cursor-pointer"
          >
            <span className="font-mono text-[11px] text-zinc-400">ID: {selectedCommunity.id.slice(0, 8)}...</span>
            {copiedId ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span className="text-[11px] font-medium">{copiedId ? 'Copiado' : 'Copiar ID'}</span>
          </button>

          {/* Invite Code */}
          {selectedCommunity.is_private && selectedCommunity.invite_code && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs text-amber-300 transition-colors cursor-pointer"
            >
              <span className="font-mono text-[11px] font-bold text-amber-200">Convite: {selectedCommunity.invite_code}</span>
              {copiedInvite ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span className="text-[11px] font-medium">{copiedInvite ? 'Copiado' : 'Copiar'}</span>
            </button>
          )}
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {/* Icon & Basic Info */}
          <div className="flex items-center gap-3.5 bg-haven-card p-3 rounded-xl border border-haven-border">
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-haven-surface border border-haven-border group-hover:border-haven-accent flex items-center justify-center transition-colors">
                {iconPreview ? (
                  <img src={iconPreview} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <Avatar
                    src={selectedCommunity.icon_url}
                    name={selectedCommunity.name}
                    size="md"
                    className="w-full h-full rounded-none"
                  />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleIconChange}
                className="hidden"
              />
            </label>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-zinc-100 block truncate">{selectedCommunity.name}</span>
              <span className="text-[10px] text-zinc-500">Clique para trocar a imagem</span>
            </div>
          </div>

          <Input
            label="Nome da Comunidade"
            placeholder="Nome da comunidade"
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
              placeholder="Sobre a comunidade..."
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
                  {isPrivate ? 'Acesso via código de convite ou ID' : 'Visível para todos os membros'}
                </div>
              </div>
            </div>
            <div className={`w-8 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${isPrivate ? 'bg-amber-500' : 'bg-zinc-700'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </div>

          {error && (
            <div className="text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
              {error}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-haven-border">
            <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isLoading} className="font-semibold">
              Salvar Alterações
            </Button>
          </div>
        </form>

        {/* Danger Zone: Delete Community */}
        <div className="pt-2 border-t border-haven-border flex items-center justify-between">
          {!isConfirmingDelete ? (
            <>
              <span className="text-xs text-zinc-500">Excluir permanentemente</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setIsConfirmingDelete(true)}
                className="gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>
            </>
          ) : (
            <div className="w-full flex items-center justify-between bg-rose-950/30 border border-rose-600/40 p-2.5 rounded-xl">
              <span className="text-xs font-semibold text-rose-300">Confirmar exclusão irreversível?</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={isLoading}
                  className="gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sim, Excluir
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
