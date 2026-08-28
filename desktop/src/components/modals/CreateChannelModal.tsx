import React, { useState, useEffect } from 'react';
import { Hash, Volume2, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ChannelType } from '../../types';
import { useCommunityStore } from '../../stores/communityStore';
import { useSettingsStore } from '../../stores/settingsStore';

export const CreateChannelModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'create_channel');
  const initialType = useSettingsStore((s) => s.createChannelType);
  const closeModal = useSettingsStore((s) => s.closeModal);
  const selectedCommunity = useCommunityStore((s) => s.selectedCommunity);
  const createChannel = useCommunityStore((s) => s.createChannel);

  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('TEXT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setType(initialType || 'TEXT');
      setName('');
      setError(null);
    }
  }, [isOpen, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommunity) return;

    const formattedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!formattedName) {
      setError('Nome do canal é obrigatório');
      return;
    }

    setIsLoading(true);
    setError(null);

    const ch = await createChannel(selectedCommunity.id, formattedName, type);
    setIsLoading(false);

    if (ch) {
      closeModal();
    } else {
      setError('Falha ao criar canal. Apenas o proprietário da comunidade pode criar canais.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Criar Canal"
      description={`Novo canal em ${selectedCommunity?.name || 'Comunidade'}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Channel Type Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Tipo de Canal
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setType('TEXT')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                type === 'TEXT'
                  ? 'bg-haven-card border-haven-accent text-white'
                  : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Hash className="w-4 h-4 flex-shrink-0 text-haven-accent" />
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold text-zinc-100">Texto</div>
                <div className="text-[10px] text-zinc-400 truncate">Mensagens e links</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setType('VOICE')}
              className={`p-3 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                type === 'VOICE'
                  ? 'bg-haven-card border-haven-accent text-white'
                  : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Volume2 className="w-4 h-4 flex-shrink-0 text-haven-emerald" />
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold text-zinc-100">Voz & Vídeo</div>
                <div className="text-[10px] text-zinc-400 truncate">Áudio HD e chamadas</div>
              </div>
            </button>
          </div>
        </div>

        {/* Channel Name */}
        <div className="flex flex-col gap-1">
          <Input
            label="Nome do Canal"
            placeholder={type === 'TEXT' ? 'ex: geral' : 'ex: Sala de Reunião'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={32}
          />
          <span className="text-[10px] text-zinc-500">
            Espaços serão automaticamente convertidos em traços.
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-haven-border">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading} className="font-semibold">
            Criar Canal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
