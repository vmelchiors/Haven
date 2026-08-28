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
  const vadLevel = useMediaStore((s) => s.vadLevel);
  const isSpeaking = useMediaStore((s) => s.isSpeaking);

  const toggleMute = useMediaStore((s) => s.toggleMute);
  const toggleDeafen = useMediaStore((s) => s.toggleDeafen);
  const toggleCamera = useMediaStore((s) => s.toggleCamera);
  const toggleScreenShare = useMediaStore((s) => s.toggleScreenShare);
  const toggleNoiseSuppression = useMediaStore((s) => s.toggleNoiseSuppression);
  const disconnectVoice = useMediaStore((s) => s.disconnectVoice);

  const openModal = useSettingsStore((s) => s.openModal);
  const vadThreshold = useSettingsStore((s) => s.vadThreshold);

  return (
    <div className="h-18 bg-haven-darker border-t border-haven-border px-6 flex flex-col justify-center items-center gap-1.5 flex-shrink-0 z-20">
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
            isMuted || isDeafened
              ? 'bg-haven-rose hover:bg-red-600 text-white border-red-500/30'
              : isSpeaking
              ? 'bg-haven-surface text-haven-emerald border-haven-emerald ring-2 ring-haven-emerald/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMuted || isDeafened ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
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
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
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
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isScreenSharing
              ? 'bg-haven-cyan text-white border-cyan-400/30'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border'
          }`}
          title={isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
        >
          {isScreenSharing ? <ScreenShare className="w-4 h-4" /> : <ScreenShareOff className="w-4 h-4" />}
        </button>

        {/* RNNoise Noise Suppression */}
        <button
          onClick={toggleNoiseSuppression}
          className={`p-2.5 rounded-full transition-all duration-150 cursor-pointer flex items-center justify-center border ${
            isNoiseSuppressionEnabled
              ? 'bg-haven-surface text-haven-emerald border-emerald-700/60'
              : 'bg-haven-surface hover:bg-haven-surface-hover text-zinc-400 border-haven-border'
          }`}
          title={isNoiseSuppressionEnabled ? 'Cancelamento de Ruído Ativado' : 'Cancelamento de Ruído Desativado'}
        >
          <Sparkles className="w-4 h-4" />
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
