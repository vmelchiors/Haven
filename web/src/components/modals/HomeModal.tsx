import React, { useState, useEffect } from 'react';
import { 
  Download, Monitor, Apple, Terminal, Cpu, Mic, ShieldCheck, 
  Zap, ExternalLink, Heart, QrCode, Copy, Check, Send, CheckCircle2,
  Sparkles, Lock, Radio
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { generatePixPayload } from '../../lib/pix';

type Tab = 'overview' | 'download' | 'donate';
type Platform = 'windows' | 'macos' | 'linux';

export const HomeModal: React.FC = () => {
  const activeModal = useSettingsStore((s) => s.activeModal);
  const closeModal = useSettingsStore((s) => s.closeModal);
  const createFeedback = useFeedbackStore((s) => s.createFeedback);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [detectedOS, setDetectedOS] = useState<Platform>('windows');
  const [selectedOS, setSelectedOS] = useState<Platform>('windows');

  // PIX State
  const [pixPayload, setPixPayload] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pixKey, setPixKey] = useState('haven@domain.org');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [comment, setComment] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [commentSent, setCommentSent] = useState(false);

  useEffect(() => {
    if (activeModal === 'download') {
      setActiveTab('download');
    } else if (activeModal === 'donate') {
      setActiveTab('donate');
    } else if (activeModal === 'home') {
      setActiveTab('overview');
    }
  }, [activeModal]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('mac')) {
        setDetectedOS('macos');
        setSelectedOS('macos');
      } else if (userAgent.includes('linux')) {
        setDetectedOS('linux');
        setSelectedOS('linux');
      } else {
        setDetectedOS('windows');
        setSelectedOS('windows');
      }
    }
  }, []);

  useEffect(() => {
    if (activeModal !== 'home' && activeModal !== 'donate' && activeModal !== 'download') return;

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
  }, [activeModal, pixKey]);

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
    setTimeout(() => setCommentSent(false), 4000);
  };

  const releaseBaseUrl = import.meta.env.VITE_GITHUB_RELEASE_URL ?? 'https://github.com/SEU_USUARIO/Haven/releases/latest';


  const downloadLinks: Record<Platform, { name: string; ext: string; badge: string; file: string; url: string; size: string }[]> = {
    windows: [
      {
        name: 'Instalador Executável (Recomendado)',
        ext: '.exe',
        badge: 'EXE',
        file: 'Haven_1.0.0_x64-setup.exe',
        url: `${releaseBaseUrl}/download/Haven_1.0.0_x64-setup.exe`,
        size: '~14.8 MB',
      },
      {
        name: 'Pacote MSI Corporativo',
        ext: '.msi',
        badge: 'MSI',
        file: 'Haven_1.0.0_x64_en-US.msi',
        url: `${releaseBaseUrl}/download/Haven_1.0.0_x64_en-US.msi`,
        size: '~15.2 MB',
      },
    ],
    macos: [
      {
        name: 'Apple Silicon (M1 / M2 / M3 / M4)',
        ext: '.dmg',
        badge: 'DMG',
        file: 'Haven_1.0.0_aarch64.dmg',
        url: `${releaseBaseUrl}/download/Haven_1.0.0_aarch64.dmg`,
        size: '~12.4 MB',
      },
      {
        name: 'Intel Mac (x64)',
        ext: '.dmg',
        badge: 'DMG',
        file: 'Haven_1.0.0_x64.dmg',
        url: `${releaseBaseUrl}/download/Haven_1.0.0_x64.dmg`,
        size: '~14.1 MB',
      },
    ],
    linux: [
      {
        name: 'Pacote Debian / Ubuntu',
        ext: '.deb',
        badge: 'DEB',
        file: 'haven_1.0.0_amd64.deb',
        url: `${releaseBaseUrl}/download/haven_1.0.0_amd64.deb`,
        size: '~13.6 MB',
      },
      {
        name: 'AppImage Universal',
        ext: '.AppImage',
        badge: 'APP',
        file: 'Haven_1.0.0_amd64.AppImage',
        url: `${releaseBaseUrl}/download/Haven_1.0.0_amd64.AppImage`,
        size: '~16.0 MB',
      },
    ],
  };

  const platforms: { id: Platform; label: string; icon: React.ReactNode }[] = [
    { id: 'windows', label: 'Windows', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'macos', label: 'macOS', icon: <Apple className="w-3.5 h-3.5" /> },
    { id: 'linux', label: 'Linux', icon: <Terminal className="w-3.5 h-3.5" /> },
  ];

  const isModalOpen = activeModal === 'home' || activeModal === 'download' || activeModal === 'donate';

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeModal}
      maxWidth="lg"
      title="Haven Central — Início & Downloads"
    >
      <div className="flex flex-col gap-4 py-0.5">
        {/* Navigation Tabs */}
        <div className="flex bg-haven-darker p-1 rounded-lg border border-haven-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-haven-surface text-white shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>
          <button
            onClick={() => setActiveTab('download')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'bg-haven-surface text-white shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>App Desktop</span>
          </button>
          <button
            onClick={() => setActiveTab('donate')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'donate'
                ? 'bg-haven-surface text-rose-300 shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>Apoiar (PIX)</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-3">
            {/* Minimalist Hero Card */}
            <div className="bg-haven-card border border-haven-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-100 font-semibold text-xs">
                  <Zap className="w-4 h-4 text-haven-accent" />
                  <span>Haven Core</span>
                </div>
                <span className="text-[10px] bg-haven-surface text-zinc-300 px-2 py-0.5 rounded border border-haven-border font-mono font-medium">
                  v1.0.0
                </span>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                Comunicação em grupo ultrarrápida, segura e livre de telemetria corporativa.
              </p>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-300 bg-haven-surface/70 px-2.5 py-1.5 rounded-lg border border-haven-border/60">
                  <Lock className="w-3.5 h-3.5 text-haven-cyan flex-shrink-0" />
                  <span className="truncate">Zero-PII & Seguro</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-300 bg-haven-surface/70 px-2.5 py-1.5 rounded-lg border border-haven-border/60">
                  <Radio className="w-3.5 h-3.5 text-haven-emerald flex-shrink-0" />
                  <span className="truncate">Áudio WebRTC Opus</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-300 bg-haven-surface/70 px-2.5 py-1.5 rounded-lg border border-haven-border/60">
                  <Cpu className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">Ultraleve (Tauri / Rust)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-300 bg-haven-surface/70 px-2.5 py-1.5 rounded-lg border border-haven-border/60">
                  <Mic className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span className="truncate">Push-to-Talk Global</span>
                </div>
              </div>

              {/* Community & Private Spaces Info */}
              <div className="bg-haven-darker/60 border border-haven-border rounded-lg p-3 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-haven-accent flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Você pode usar os <strong className="text-zinc-200">chats públicos</strong> livremente. Para criar seu próprio servidor exclusivo, basta fazer uma contribuição anti-spam de R$ 15,00.
                </p>
              </div>

              {/* Quick Download CTA */}
              <div className="pt-2 border-t border-haven-border flex items-center justify-between gap-3">
                <span className="text-[11px] text-zinc-400 font-medium truncate">
                  Disponível para Windows, macOS e Linux
                </span>
                <Button
                  onClick={() => setActiveTab('download')}
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Desktop</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DOWNLOADS */}
        {activeTab === 'download' && (
          <div className="flex flex-col gap-4">
            {/* OS Selector */}
            <div className="flex bg-haven-darker p-1 rounded-lg border border-haven-border">
              {platforms.map((p) => {
                const isSelected = selectedOS === p.id;
                const isDetected = detectedOS === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedOS(p.id)}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-haven-surface text-white shadow-subtle'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                    {isDetected && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-haven-accent/20 text-haven-accent'
                      }`}>
                        Seu SO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Download Links */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Arquivos para {selectedOS.toUpperCase()}:
              </span>

              {downloadLinks[selectedOS].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-haven-card border border-haven-border hover:border-haven-accent/40 rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-haven-surface flex items-center justify-center font-mono font-bold text-xs text-zinc-300 flex-shrink-0 border border-haven-border">
                      {item.badge}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-zinc-200 truncate">{item.name}</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono mt-0.5">
                        <span className="truncate">{item.file}</span>
                        <span className="text-zinc-600 flex-shrink-0">•</span>
                        <span className="text-zinc-400 font-sans text-[10px] bg-haven-surface px-1.5 py-0.2 rounded border border-haven-border flex-shrink-0">
                          {item.size}
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-haven-accent hover:bg-haven-accent-hover text-white text-xs font-medium rounded-lg shadow-subtle transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </a>
                </div>
              ))}
            </div>

            {/* GitHub Links */}
            <div className="flex items-center justify-between pt-2 border-t border-haven-border text-xs text-zinc-400">
              <span>Código Aberto & Sem Telemetria</span>
              <a
                href="https://github.com/vinicius/Haven/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-white text-[11px]"
              >
                <span>Releases no GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* TAB 3: DONATE (PIX) */}
        {activeTab === 'donate' && (
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <p className="text-xs text-zinc-400 leading-relaxed">
                O Haven é mantido pela comunidade. Toda contribuição apoia a infraestrutura de voz e servidores de baixa latência.
              </p>
            </div>

            {/* QR Code & Copy Section */}
            <div className="flex flex-col items-center gap-3 bg-haven-card p-4 rounded-xl border border-haven-border">
              {qrCodeBase64 ? (
                <div className="bg-white p-2 rounded-lg shadow-subtle">
                  <img
                    src={`data:image/png;base64,${qrCodeBase64}`}
                    alt="QR Code PIX Haven"
                    className="w-36 h-36 object-contain"
                  />
                </div>
              ) : (
                <div className="w-36 h-36 bg-white/5 border border-dashed border-haven-border rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <QrCode className="w-8 h-8 opacity-60" />
                  <span className="text-[10px]">QR Code PIX</span>
                </div>
              )}

              {/* PIX Copia e Cola */}
              <div className="w-full flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Código PIX (Copia e Cola):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload || 'Carregando código PIX...'}
                    className="flex-1 bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none select-all"
                  />
                  <Button
                    onClick={handleCopyPayload}
                    disabled={!pixPayload}
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                  >
                    {copiedPayload ? <Check className="w-3.5 h-3.5 text-haven-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPayload ? 'Copiado' : 'Copiar'}</span>
                  </Button>
                </div>
              </div>

              {/* PIX Key */}
              <div className="w-full flex items-center justify-between pt-1 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-zinc-300">Chave:</span>
                  <span className="font-mono text-zinc-400">{pixKey}</span>
                </div>
                <button
                  onClick={handleCopyKey}
                  className="text-zinc-400 hover:text-white text-[11px] font-medium cursor-pointer"
                >
                  {copiedKey ? 'Copiada!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Send Support Message / Feedback */}
            <form onSubmit={handleSendComment} className="flex flex-col gap-2 bg-haven-card p-3 rounded-xl border border-haven-border">
              <span className="text-xs font-semibold text-zinc-300">
                Mensagem ou sugestão de melhoria:
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ex: Ótima qualidade de áudio..."
                rows={2}
                className="w-full bg-haven-darker border border-haven-border rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-haven-accent transition-colors resize-none placeholder:text-zinc-600"
              />
              <div className="flex items-center justify-between">
                {commentSent ? (
                  <span className="text-xs text-haven-emerald flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mensagem enviada!
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500">Anônimo</span>
                )}
                <Button
                  type="submit"
                  disabled={!comment.trim() || isSendingComment}
                  size="sm"
                  variant="secondary"
                  className="gap-1 ml-auto"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSendingComment ? 'Enviando...' : 'Enviar'}</span>
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
