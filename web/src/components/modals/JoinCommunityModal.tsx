import React, { useState } from 'react';
import { ShieldAlert, ArrowRight, Fingerprint } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useCommunityStore } from '../../stores/communityStore';
import { useSettingsStore } from '../../stores/settingsStore';

export const JoinCommunityModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'join_community');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const joinCommunity = useCommunityStore((s) => s.joinCommunity);

  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Insira o ID da comunidade ou o código de convite');
      return;
    }

    setIsLoading(true);
    setError(null);

    const comm = await joinCommunity(identifier.trim());
    setIsLoading(false);

    if (comm) {
      setIdentifier('');
      closeModal();
    } else {
      setError('ID ou código de convite inválido ou comunidade ainda não aprovada.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Entrar em uma Comunidade"
      description="Insira o ID da Comunidade ou o Código de Convite de 8 caracteres"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-haven-surface text-haven-accent mt-0.5">
            <Fingerprint className="w-4 h-4 flex-shrink-0" />
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-normal">
            Você pode ingressar em qualquer comunidade aprovada usando o <strong className="text-zinc-100">ID da Comunidade</strong> ou o <strong className="text-zinc-100">Código de Convite</strong> (ex: <code className="font-mono bg-haven-darker px-1 rounded text-zinc-300">a3f89b1c</code>).
          </p>
        </div>

        <Input
          label="ID da Comunidade ou Código de Convite"
          placeholder="Ex: a3f89b1c ou 3fe6fe43-b99b..."
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
          className="font-mono text-xs"
        />

        {error && (
          <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-haven-border">
          <Button type="button" variant="ghost" size="sm" onClick={closeModal} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading} className="gap-1.5 font-semibold">
            <span>Entrar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </Modal>
  );
};
