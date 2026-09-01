import React from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Sparkles,
  Settings,
  PhoneOff,
  Laptop2,
} from 'lucide-react';
import { useMediaStore } from '../../stores/mediaStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { AudioMeter } from '../ui/AudioMeter';

export const ControlBar: React.FC = () => {
  const isMuted = useMediaStore((s) => s.isMuted);
  const isDeafened = useMediaStore((s) => s.isDeafened);
  const isCameraOn = useMediaStore((s) => s.isCameraOn);
  const isScreenSharing = useMediaStore((s) => s.isScreenSharing);
  const isNoiseSuppressionEnabled = useMediaStore((s) => s.isNoiseSuppressionEnabled);
  const noiseSuppressionStatus = useMediaStore((s) => s.noiseSuppressionStatus);
  const vadLevel = useMediaStore((s) => s.vadLevel);
  const isSpeaking = useMediaStore((s) => s.isSpeaking);
  const isCompanionModeEnabled = useMediaStore((s) => s.isCompanionModeEnabled);
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);

  const toggleMute = useMediaStore((s) => s.toggleMute);
  const toggleDeafen = useMediaStore((s) => s.toggleDeafen);
  const toggleCamera = useMediaStore((s) => s.toggleCamera);
  const toggleScreenShare = useMediaStore((s) => s.toggleScreenShare);
  const toggleNoiseSuppression = useMediaStore((s) => s.toggleNoiseSuppression);
  const toggleCompanionMode = useMediaStore((s) => s.toggleCompanionMode);
  const disconnectVoice = useMediaStore((s) => s.disconnectVoice);

  const openModal = useSettingsStore((s) => s.openModal);
  const vadThreshold = useSettingsStore((s) => s.vadThreshold);
  const effectiveNoiseSuppressionStatus = noiseSuppressionStatus
    ?? (isNoiseSuppressionEnabled ? 'idle' : 'disabled');
  const noiseSuppressionTitle = {
    idle: 'IA pronta para iniciar ao entrar na chamada',
    loading: 'Carregando modelo DTLN...',
    active: 'Cancelamento de ruído por IA ativo',
    fallback: 'IA indisponível; usando supressão nativa do navegador',
    disabled: 'Cancelamento de ruído por IA desativado',
  }[effectiveNoiseSuppressionStatus] ?? 'Status do cancelamento de ruído indisponível';

  return (
    <div className="min-h-[92px] bg-haven-darker border-t border-haven-border px-6 py-3 flex flex-col justify-center items-center gap-2.5 flex-shrink-0 z-20">
      {/* Audio Activity Bar */}
      <div className="w-56 max-w-full">
        <AudioMeter level={vadLevel} threshold={vadThreshold} />
      </div>

      {/* Buttons Row */}
      <div className="flex items-center gap-2.5">
        {/* Microphone Mute */}
        <button
          onClick={toggleMute}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isMuted || isDeafened || isCompanionModeEnabled
              ? 'bg-haven-rose hover:bg-red-600 text-white border-red-500/30'
              : isSpeaking
              ? 'bg-haven-surface text-haven-emerald border-haven-emerald ring-2 ring-haven-emerald/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isCompanionModeEnabled ? 'Microfone desativado pelo modo dispositivo próximo' : isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMuted || isDeafened || isCompanionModeEnabled ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Headphones Deafen */}
        <button
          onClick={toggleDeafen}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isDeafened
              ? 'bg-haven-rose hover:bg-red-600 text-white border-red-500/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isDeafened ? 'Ativar Áudio' : 'Ensurdecer'}
        >
          {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={toggleCamera}
          disabled={!isVoiceConnected}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center border ${
            isCameraOn
              ? 'bg-haven-accent text-white border-indigo-400/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isCameraOn ? 'Desativar Câmera' : 'Ligar Câmera'}
        >
          {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          disabled={!isVoiceConnected}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center border ${
            isScreenSharing
              ? 'bg-haven-cyan text-white border-cyan-400/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
        >
          {isScreenSharing ? <ScreenShare className="w-4 h-4" /> : <ScreenShareOff className="w-4 h-4" />}
        </button>

        {/* DTLN AI Noise Suppression */}
        <button
          onClick={toggleNoiseSuppression}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isNoiseSuppressionEnabled
              ? 'bg-haven-surface text-haven-emerald border-emerald-700/60'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-400 border-haven-border'
          }`}
          title={noiseSuppressionTitle}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Nearby companion device mode */}
        <button
          onClick={toggleCompanionMode}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isCompanionModeEnabled
              ? 'bg-haven-cyan text-white border-cyan-400/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isCompanionModeEnabled ? 'Desativar modo dispositivo próximo' : 'Usar como dispositivo próximo sem áudio'}
        >
          <Laptop2 className="w-4 h-4" />
        </button>

        {/* Settings */}
        <button
          onClick={() => openModal('settings')}
          className="p-2.5 rounded-full bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border border-haven-border transition-colors cursor-pointer"
          title="Configurações de Voz"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Disconnect Voice */}
        <button
          onClick={disconnectVoice}
          className="p-2.5 rounded-full bg-haven-rose hover:bg-red-600 text-white border border-red-500/30 transition-all duration-150 cursor-pointer flex items-center justify-center ml-1"
          title="Desconectar"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
