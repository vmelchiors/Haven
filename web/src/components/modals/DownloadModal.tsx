import React, { useState, useEffect } from 'react';
import { Download, Monitor, Apple, Terminal, Cpu, Mic, ShieldCheck, Zap, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../stores/settingsStore';

type Platform = 'windows' | 'macos' | 'linux';

export const DownloadModal: React.FC = () => {
  const activeModal = useSettingsStore((s) => s.activeModal);
  const closeModal = useSettingsStore((s) => s.closeModal);

  const [detectedOS, setDetectedOS] = useState<Platform>('windows');
  const [selectedOS, setSelectedOS] = useState<Platform>('windows');

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
    { id: 'windows', label: 'Windows', icon: <Monitor className="w-4 h-4" /> },
    { id: 'macos', label: 'macOS', icon: <Apple className="w-4 h-4" /> },
    { id: 'linux', label: 'Linux', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <Modal
      isOpen={activeModal === 'download'}
      onClose={closeModal}
      maxWidth="lg"
      title="Baixar Haven para Desktop"
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Banner Hero */}
        <div className="bg-gradient-to-br from-indigo-950/60 via-haven-dark to-slate-900 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2 text-haven-accent font-bold text-sm">
              <Zap className="w-4 h-4 text-haven-cyan" />
              <span>Experiência Desktop Nativa com Tauri v2</span>
            </div>
            <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/40 font-medium">
              v1.0.0 Estável
            </span>
          </div>

          <p className="text-xs text-slate-300 z-10 leading-relaxed">
            Tenha máxima performance, menor latência de voz, cancelamento de ruído acelerado por hardware e atalhos globais de Push-to-Talk enquanto joga.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-1 z-10">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <Mic className="w-3.5 h-3.5 text-haven-emerald" />
              <span>Push-to-Talk Global</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-haven-cyan" />
              <span>Consumo ~15MB RAM</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Zero-PII & Criptografia</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-haven-accent" />
              <span>Notificações Nativas</span>
            </div>
          </div>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex bg-haven-darker p-1 rounded-xl border border-haven-border/60">
          {platforms.map((p) => {
            const isSelected = selectedOS === p.id;
            const isDetected = detectedOS === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedOS(p.id)}
                className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-haven-accent text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-haven-surface/50'
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

        {/* Download Options for Selected Platform */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Arquivos Disponíveis para {selectedOS.toUpperCase()}:
          </span>

          {downloadLinks[selectedOS].map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-haven-darker/90 border border-haven-border hover:border-haven-accent/60 rounded-xl flex items-center justify-between gap-3 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg bg-haven-surface flex items-center justify-center font-mono font-bold text-xs text-haven-cyan group-hover:bg-haven-accent/20 group-hover:text-white transition-colors flex-shrink-0 border border-haven-border/40">
                  {item.badge}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-100 truncate">{item.name}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                    <span className="truncate">{item.file}</span>
                    <span className="text-slate-600 flex-shrink-0">•</span>
                    <span className="text-slate-400 font-sans text-[10px] bg-haven-surface px-1.5 py-0.5 rounded border border-haven-border/40 flex-shrink-0">
                      {item.size}
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-haven-accent hover:bg-haven-accent-hover text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex-shrink-0 ml-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar</span>
              </a>
            </div>
          ))}
        </div>

        {/* Footer GitHub Link */}
        <div className="flex items-center justify-between pt-2 border-t border-haven-border/60 text-xs text-slate-400">
          <span>Código aberto & Livre de Telemetria</span>
          <a
            href="https://github.com/vinicius/Haven/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-haven-cyan hover:underline text-[11px]"
          >
            <span>Ver todas as versões no GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </Modal>
  );
};
