import React, { useState } from 'react';
import { Bug, Lightbulb, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FeedbackType } from '../../types';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useSettingsStore } from '../../stores/settingsStore';

export const FeedbackModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'feedback');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const createFeedback = useFeedbackStore((s) => s.createFeedback);

  const [type, setType] = useState<FeedbackType>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor, informe um título ou resumo');
      return;
    }
    if (!description.trim()) {
      setError('Por favor, descreva os detalhes');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createFeedback(type, title.trim(), description.trim());
    setIsLoading(false);

    if (result) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setTitle('');
        setDescription('');
        closeModal();
      }, 2000);
    } else {
      setError('Erro ao enviar relatório. Tente novamente mais tarde.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Enviar Feedback & Relatar Bugs"
      description="Ajude a aprimorar o Haven compartilhando problemas encontrados ou ideias de novas funcionalidades"
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-fadeIn">
          <div className="w-10 h-10 rounded-full bg-emerald-950/40 text-haven-emerald border border-emerald-800/40 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-100">Feedback Enviado com Sucesso!</h4>
          <p className="text-xs text-zinc-400 max-w-sm">
            Nossa equipe analisará seu relato. Obrigado por ajudar a construir o Haven!
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Type Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Tipo de Envio
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setType('BUG')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                  type === 'BUG'
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${type === 'BUG' ? 'bg-rose-500/20 text-rose-400' : 'bg-haven-card text-zinc-400'}`}>
                  <Bug className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold text-zinc-100">Relatar Bug</div>
                  <div className="text-[10px] text-zinc-400 truncate">Falhas ou travamentos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('SUGGESTION')}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-colors cursor-pointer ${
                  type === 'SUGGESTION'
                    ? 'bg-haven-card border-haven-accent text-white'
                    : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${type === 'SUGGESTION' ? 'bg-indigo-500/20 text-haven-accent' : 'bg-haven-card text-zinc-400'}`}>
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold text-zinc-100">Nova Sugestão</div>
                  <div className="text-[10px] text-zinc-400 truncate">Ideias e melhorias</div>
                </div>
              </button>
            </div>
          </div>

          <Input
            label="Título / Resumo"
            placeholder={type === 'BUG' ? 'Ex: Áudio falhando ao entrar em canal...' : 'Ex: Modo escuro OLED ou atalhos...'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Descrição Detalhada
            </label>
            <textarea
              rows={4}
              maxLength={1000}
              placeholder={
                type === 'BUG'
                  ? 'Descreva o que aconteceu e os passos para reproduzir o problema...'
                  : 'Descreva como você imagina esse recurso e por que seria útil...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-haven-darker border border-haven-border rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-haven-accent transition-colors resize-none"
            />
          </div>

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
              <span>Enviar {type === 'BUG' ? 'Relato' : 'Sugestão'}</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
