import React, { useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  AudioLines,
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
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);

  const toggleMute = useMediaStore((s) => s.toggleMute);
  const toggleDeafen = useMediaStore((s) => s.toggleDeafen);
  const toggleCamera = useMediaStore((s) => s.toggleCamera);
  const toggleScreenShare = useMediaStore((s) => s.toggleScreenShare);
  const toggleNoiseSuppression = useMediaStore((s) => s.toggleNoiseSuppression);
  const disconnectVoice = useMediaStore((s) => s.disconnectVoice);

  const openModal = useSettingsStore((s) => s.openModal);
  const vadThreshold = useSettingsStore((s) => s.vadThreshold);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  const runAction = (message: string, action: () => void) => {
    action();
    setFeedback(message);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 1500);
  };

  const baseButton =
    'w-11 h-11 rounded-xl transition-all duration-150 cursor-pointer flex items-center justify-center border focus:outline-none focus-visible:ring-2 focus-visible:ring-haven-accent disabled:cursor-not-allowed disabled:opacity-35';
  const neutralButton =
    'bg-haven-surface/95 hover:bg-haven-surface-hover text-zinc-300 hover:text-white border-haven-border';

  return (
    <div className="absolute z-30 bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center haven-dock-enter">
      <div
        aria-live="polite"
        className={`mb-2 rounded-lg border border-haven-border bg-haven-darkest/90 px-3 py-1.5 text-[11px] font-medium text-zinc-200 shadow-popover backdrop-blur-md transition-all duration-150 ${
          feedback ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
        }`}
      >
        {feedback || ' '}
      </div>

      <div className="relative flex items-center gap-2 rounded-2xl border border-haven-border bg-haven-darker/90 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="absolute -top-px left-4 right-4 -translate-y-1/2 overflow-hidden rounded-full bg-haven-border">
          <AudioMeter level={vadLevel} threshold={vadThreshold} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => runAction(isMuted ? 'Microfone ativado' : 'Microfone desativado', toggleMute)}
            aria-label={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
            aria-pressed={isMuted}
            className={`${baseButton} ${
              isMuted || isDeafened
                ? 'bg-haven-rose text-white border-red-400/30'
                : isSpeaking
                ? 'bg-haven-surface text-haven-emerald border-haven-emerald shadow-[0_0_18px_rgba(16,185,129,0.18)]'
                : neutralButton
            }`}
            title={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
          >
            {isMuted || isDeafened ? <MicOff className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
          </button>

          <button
            type="button"
            onClick={() => runAction(isDeafened ? 'Áudio recebido ativado' : 'Áudio recebido desativado', toggleDeafen)}
            aria-label={isDeafened ? 'Ativar áudio recebido' : 'Desativar áudio recebido'}
            aria-pressed={isDeafened}
            className={`${baseButton} ${isDeafened ? 'bg-haven-rose text-white border-red-400/30' : neutralButton}`}
            title={isDeafened ? 'Ativar áudio recebido' : 'Desativar áudio recebido'}
          >
            {isDeafened ? <VolumeX className="w-[18px] h-[18px]" /> : <Headphones className="w-[18px] h-[18px]" />}
          </button>
        </div>

        <span className="h-7 w-px bg-haven-border" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => runAction(isCameraOn ? 'Câmera desativada' : 'Câmera ativada', toggleCamera)}
            disabled={!isVoiceConnected}
            aria-label={isCameraOn ? 'Desativar câmera' : 'Ativar câmera'}
            aria-pressed={isCameraOn}
            className={`${baseButton} ${isCameraOn ? 'bg-haven-accent text-white border-indigo-400/30' : neutralButton}`}
            title={isCameraOn ? 'Desativar câmera' : 'Ativar câmera'}
          >
            {isCameraOn ? <Video className="w-[18px] h-[18px]" /> : <VideoOff className="w-[18px] h-[18px]" />}
          </button>

          <button
            type="button"
            onClick={() => runAction(isScreenSharing ? 'Transmissão encerrada' : 'Transmissão iniciada', toggleScreenShare)}
            disabled={!isVoiceConnected}
            aria-label={isScreenSharing ? 'Encerrar transmissão' : 'Iniciar transmissão'}
            aria-pressed={isScreenSharing}
            className={`${baseButton} ${isScreenSharing ? 'bg-haven-cyan text-white border-cyan-300/30' : neutralButton}`}
            title={isScreenSharing ? 'Encerrar transmissão' : 'Compartilhar tela'}
          >
            {isScreenSharing ? <ScreenShare className="w-[18px] h-[18px]" /> : <ScreenShareOff className="w-[18px] h-[18px]" />}
          </button>
        </div>

        <span className="h-7 w-px bg-haven-border" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => runAction(
              isNoiseSuppressionEnabled ? 'Tratamento de voz desativado' : 'Tratamento de voz ativado',
              toggleNoiseSuppression,
            )}
            aria-label={isNoiseSuppressionEnabled ? 'Desativar tratamento de voz' : 'Ativar tratamento de voz'}
            aria-pressed={isNoiseSuppressionEnabled}
            className={`${baseButton} ${
              isNoiseSuppressionEnabled
                ? 'bg-emerald-950/80 text-haven-emerald border-emerald-700/60'
                : neutralButton
            }`}
            title="Tratamento de voz"
          >
            <AudioLines className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => openModal('settings')}
            aria-label="Abrir configurações de voz"
            className={`${baseButton} ${neutralButton}`}
            title="Configurações de voz"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => runAction('Você saiu da chamada', disconnectVoice)}
          aria-label="Sair da chamada"
          className={`${baseButton} ml-1 bg-haven-rose hover:bg-red-600 text-white border-red-400/30`}
          title="Sair da chamada"
        >
          <PhoneOff className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
};
