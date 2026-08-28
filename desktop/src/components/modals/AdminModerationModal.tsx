import React, { useEffect, useState } from 'react';
import { Shield, Check, X, Eye, ArrowLeft, Bug, Lightbulb, MessageSquarePlus, Trash2, Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FeedbackStatus } from '../../types';
import { useCommunityStore } from '../../stores/communityStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';

type AdminTab = 'COMMUNITIES' | 'FEEDBACK';

export const AdminModerationModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'admin_moderation');
  const closeModal = useSettingsStore((s) => s.closeModal);
  
  // Community Moderation Store
  const pendingCommunities = useCommunityStore((s) => s.pendingCommunities);
  const fetchPendingCommunities = useCommunityStore((s) => s.fetchPendingCommunities);
  const approveCommunity = useCommunityStore((s) => s.approveCommunity);
  const rejectCommunity = useCommunityStore((s) => s.rejectCommunity);
  const selectCommunity = useCommunityStore((s) => s.selectCommunity);
  const tokens = useAuthStore((s) => s.tokens);

  // Feedback Store
  const feedbacks = useFeedbackStore((s) => s.feedbacks);
  const fetchFeedbacks = useFeedbackStore((s) => s.fetchFeedbacks);
  const updateFeedbackStatus = useFeedbackStore((s) => s.updateFeedbackStatus);
  const deleteFeedback = useFeedbackStore((s) => s.deleteFeedback);

  // State
  const [activeTab, setActiveTab] = useState<AdminTab>('COMMUNITIES');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // In-app Receipt Viewer State
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [viewingReceiptType, setViewingReceiptType] = useState<string>('image');
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);

  // Feedback Filters & Notes State
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPendingCommunities();
      fetchFeedbacks(statusFilter, typeFilter);
    } else {
      setViewingReceiptUrl(null);
      setRejectingId(null);
    }
  }, [isOpen, fetchPendingCommunities, fetchFeedbacks, statusFilter, typeFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    const success = await approveCommunity(id);
    setActionLoading(null);

    if (success) {
      await selectCommunity(id);
      closeModal();
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    await rejectCommunity(id, rejectReason || 'Comprovante não verificado');
    setActionLoading(null);
    setRejectingId(null);
    setRejectReason('');
    if (pendingCommunities.length <= 1) {
      closeModal();
    }
  };

  const handleViewReceipt = async (id: string) => {
    if (!tokens) return;
    setIsReceiptLoading(true);
    try {
      const res = await fetch(`/api/admin/communities/${id}/receipt`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok) throw new Error('Falha ao obter comprovante');

      const contentType = res.headers.get('content-type') || '';
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (contentType.includes('pdf')) {
        setViewingReceiptType('pdf');
      } else {
        setViewingReceiptType('image');
      }
      setViewingReceiptUrl(blobUrl);
    } catch {
      alert('Não foi possível carregar o arquivo de comprovante.');
    } finally {
      setIsReceiptLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    const notes = editingNotes[id] !== undefined ? editingNotes[id] : (feedbacks.find((f) => f.id === id)?.admin_notes || '');
    await updateFeedbackStatus(id, newStatus, notes);
  };

  const handleSaveNotes = async (id: string) => {
    setSavingNotesId(id);
    const fb = feedbacks.find((f) => f.id === id);
    if (fb) {
      const notes = editingNotes[id] !== undefined ? editingNotes[id] : fb.admin_notes || '';
      await updateFeedbackStatus(id, fb.status, notes);
    }
    setSavingNotesId(null);
  };

  const handleDeleteFeedback = async (id: string) => {
    if (confirm('Deseja excluir permanentemente este relato?')) {
      await deleteFeedback(id);
    }
  };

  const pendingFeedbackCount = feedbacks.filter((f) => f.status === 'OPEN' || f.status === 'IN_PROGRESS').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={viewingReceiptUrl ? "Visualização do Comprovante" : "Painel Administrativo"}
      description={
        viewingReceiptUrl
          ? "Inspecione o comprovante de R$ 15,00 anexado pelo solicitante"
          : "Gestão centralizada de aprovações de comunidades e relatos de usuários"
      }
      maxWidth="xl"
    >
      {/* 1. Inline Receipt Preview Stage */}
      {viewingReceiptUrl ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewingReceiptUrl(null)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Button>
          </div>

          <div className="w-full bg-haven-darker border border-haven-border rounded-xl overflow-hidden flex items-center justify-center p-2 min-h-[300px] max-h-[500px]">
            {viewingReceiptType === 'pdf' ? (
              <iframe
                src={viewingReceiptUrl}
                title="Comprovante PDF"
                className="w-full h-[450px] rounded-lg border-0"
              />
            ) : (
              <img
                src={viewingReceiptUrl}
                alt="Comprovante de Doação"
                className="max-h-[450px] max-w-full object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Top Tab Bar */}
          <div className="flex items-center gap-1 bg-haven-darker p-1 rounded-lg border border-haven-border">
            <button
              onClick={() => setActiveTab('COMMUNITIES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'COMMUNITIES'
                  ? 'bg-haven-surface text-white shadow-subtle'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Comunidades</span>
              {pendingCommunities.length > 0 && (
                <span className="px-1.5 py-0.2 bg-haven-rose text-white text-[9px] rounded-full font-bold">
                  {pendingCommunities.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('FEEDBACK')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'FEEDBACK'
                  ? 'bg-haven-surface text-white shadow-subtle'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Feedback & Bugs</span>
              {pendingFeedbackCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-zinc-950 text-[9px] rounded-full font-bold">
                  {pendingFeedbackCount}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Communities Approval Queue */}
          {activeTab === 'COMMUNITIES' && (
            <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {pendingCommunities.length === 0 ? (
                <div className="py-10 text-center text-zinc-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-40 text-haven-emerald" />
                  <h4 className="text-xs font-semibold text-zinc-300">Fila limpa</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Nenhuma solicitação de comunidade pendente.</p>
                </div>
              ) : (
                pendingCommunities.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-zinc-100">{comm.name}</h4>
                          <Badge variant="warning">Pendente</Badge>
                          {comm.is_private && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                              PRIVADA
                            </span>
                          )}
                        </div>
                        {comm.description && (
                          <p className="text-[11px] text-zinc-400 mt-1">{comm.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1.5">
                          <span>Solicitante: <strong className="text-zinc-300">{comm.owner_username || comm.owner_id}</strong></span>
                          <span>•</span>
                          <span>Taxa: <strong className="text-haven-emerald">R$ {(comm.donation_amount / 100).toFixed(2)}</strong></span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewReceipt(comm.id)}
                        isLoading={isReceiptLoading}
                        className="gap-1 text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Comprovante
                      </Button>
                    </div>

                    {/* Rejection reason box */}
                    {rejectingId === comm.id ? (
                      <div className="bg-haven-darker p-3 rounded-lg border border-haven-rose/30 flex flex-col gap-2">
                        <span className="text-xs font-medium text-haven-rose">
                          Motivo da rejeição:
                        </span>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Ex: Comprovante ilegível"
                          className="bg-haven-card border border-haven-border rounded px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-rose"
                        />
                        <div className="flex items-center justify-end gap-2 mt-0.5">
                          <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>
                            Cancelar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={actionLoading === comm.id}
                            onClick={() => handleReject(comm.id)}
                          >
                            Confirmar Rejeição
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-haven-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-haven-rose hover:bg-rose-950/20"
                          onClick={() => {
                            setRejectingId(comm.id);
                            setRejectReason('');
                          }}
                          disabled={Boolean(actionLoading)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Rejeitar
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoading === comm.id}
                          onClick={() => handleApprove(comm.id)}
                          className="bg-haven-emerald hover:bg-emerald-600 border-emerald-500/30"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Aprovar
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Suggestions & Bug Reports */}
          {activeTab === 'FEEDBACK' && (
            <div className="flex flex-col gap-3">
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-haven-card p-2 rounded-xl border border-haven-border text-xs">
                {/* Type Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 mr-1 text-[10px] font-semibold">TIPO:</span>
                  {(['ALL', 'BUG', 'SUGGESTION'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`px-2 py-0.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                        typeFilter === t
                          ? 'bg-haven-surface text-white shadow-subtle'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {t === 'ALL' ? 'Todos' : t === 'BUG' ? 'Bugs' : 'Sugestões'}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 mr-1 text-[10px] font-semibold">STATUS:</span>
                  {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                        statusFilter === s
                          ? 'bg-haven-surface text-white shadow-subtle'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {s === 'ALL'
                        ? 'Todos'
                        : s === 'OPEN'
                        ? 'Aberto'
                        : s === 'IN_PROGRESS'
                        ? 'Em Andamento'
                        : s === 'RESOLVED'
                        ? 'Resolvido'
                        : 'Fechado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback List */}
              <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {feedbacks.length === 0 ? (
                  <div className="py-10 text-center text-zinc-500">
                    <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-400" />
                    <h4 className="text-xs font-semibold text-zinc-300">Nenhum relato encontrado</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Nenhuma sugestão ou bug com os filtros selecionados.</p>
                  </div>
                ) : (
                  feedbacks.map((fb) => {
                    const isBug = fb.type === 'BUG';
                    const currentNotes = editingNotes[fb.id] !== undefined ? editingNotes[fb.id] : fb.admin_notes || '';

                    return (
                      <div
                        key={fb.id}
                        className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex flex-col gap-2.5"
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isBug ? (
                                <span className="flex items-center gap-1 text-[9px] font-semibold bg-rose-950/30 text-haven-rose border border-rose-800/40 px-1.5 py-0.2 rounded">
                                  <Bug className="w-3 h-3" /> BUG
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[9px] font-semibold bg-indigo-950/30 text-haven-accent border border-indigo-800/40 px-1.5 py-0.2 rounded">
                                  <Lightbulb className="w-3 h-3" /> SUGESTÃO
                                </span>
                              )}
                              <h4 className="text-xs font-semibold text-zinc-100">{fb.title}</h4>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1 leading-relaxed font-normal whitespace-pre-wrap">{fb.description}</p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFeedback(fb.id)}
                            className="text-zinc-500 hover:text-haven-rose p-1"
                            title="Excluir relato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Status Change & Admin Notes */}
                        <div className="pt-2 border-t border-haven-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Status:</span>
                            <select
                              value={fb.status}
                              onChange={(e) => handleStatusChange(fb.id, e.target.value as FeedbackStatus)}
                              className="bg-haven-darker border border-haven-border rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-haven-accent"
                            >
                              <option value="OPEN">Aberto</option>
                              <option value="IN_PROGRESS">Em Andamento</option>
                              <option value="RESOLVED">Resolvido</option>
                              <option value="CLOSED">Fechado</option>
                            </select>
                          </div>

                          {/* Admin Notes Input */}
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <input
                              type="text"
                              placeholder="Notas do Admin..."
                              value={currentNotes}
                              onChange={(e) => setEditingNotes({ ...editingNotes, [fb.id]: e.target.value })}
                              className="flex-1 sm:w-48 bg-haven-darker border border-haven-border rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-haven-accent"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              isLoading={savingNotesId === fb.id}
                              onClick={() => handleSaveNotes(fb.id)}
                              className="p-1 px-2 text-xs"
                              title="Salvar Notas"
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
