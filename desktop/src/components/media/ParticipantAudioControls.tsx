import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MonitorUp, Volume2, VolumeX } from 'lucide-react';
import { useMediaStore, type RemoteAudioSource } from '../../stores/mediaStore';

interface ParticipantAudioControlsProps {
  identity: string;
  hasScreenAudio?: boolean;
  compact?: boolean;
}

const defaultPreference = {
  voiceVolume: 100,
  voiceMuted: false,
  screenVolume: 100,
  screenMuted: false,
};

export const ParticipantAudioControls: React.FC<ParticipantAudioControlsProps> = ({
  identity,
  hasScreenAudio = false,
  compact = false,
}) => {
  const preference = useMediaStore((state) => state.remoteAudioPreferences[identity]) || defaultPreference;
  const setRemoteAudioVolume = useMediaStore((state) => state.setRemoteAudioVolume);
  const toggleRemoteAudioMuted = useMediaStore((state) => state.toggleRemoteAudioMuted);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 6,
        left: Math.min(Math.max(8, rect.right - 240), window.innerWidth - 248),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const voiceMuted = preference.voiceMuted || preference.voiceVolume === 0;
  const screenMuted = preference.screenMuted || preference.screenVolume === 0;
  const renderControl = (source: RemoteAudioSource) => {
    const isVoice = source === 'voice';
    const volume = isVoice ? preference.voiceVolume : preference.screenVolume;
    const muted = isVoice ? voiceMuted : screenMuted;
    const label = isVoice ? 'Voz da pessoa' : 'Áudio da transmissão';

    return (
      <div key={source} className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
            {isVoice ? <Volume2 className="w-3.5 h-3.5" /> : <MonitorUp className="w-3.5 h-3.5" />}
            {label}
          </span>
          <button
            type="button"
            onClick={() => toggleRemoteAudioMuted(identity, source)}
            className={`rounded-md p-1.5 transition-colors ${
              muted ? 'bg-haven-rose text-white' : 'bg-haven-surface text-zinc-300 hover:text-white'
            }`}
            title={muted ? `Ouvir ${label.toLowerCase()}` : `Silenciar ${label.toLowerCase()}`}
            aria-label={muted ? `Ouvir ${label.toLowerCase()}` : `Silenciar ${label.toLowerCase()}`}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(event) => setRemoteAudioVolume(identity, source, Number(event.target.value))}
            className="w-full accent-haven-emerald"
            aria-label={`Volume de ${label.toLowerCase()}`}
          />
          <span className="w-9 text-right text-[10px] tabular-nums text-zinc-400">{volume}%</span>
        </div>
      </div>
    );
  };

  const panel = isOpen ? createPortal(
    <div
      className="fixed z-[100] w-60 space-y-3 rounded-xl border border-haven-border bg-haven-darker/95 p-3 shadow-2xl backdrop-blur-md"
      style={{ top: position.top, left: position.left }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label="Controles locais de áudio"
    >
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">Somente para você</div>
      {renderControl('voice')}
      {hasScreenAudio && <div className="border-t border-haven-border pt-3">{renderControl('screen')}</div>}
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={`absolute right-2 top-2 z-20 rounded-md border border-haven-border bg-haven-darker/90 text-zinc-200 shadow-md transition-colors hover:bg-haven-surface ${
          compact ? 'p-1' : 'p-1.5'
        }`}
        title="Volume e mute locais"
        aria-label="Abrir controles locais de áudio"
        aria-expanded={isOpen}
      >
        {voiceMuted ? (
          <VolumeX className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        ) : (
          <Volume2 className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        )}
      </button>
      {panel}
    </>
  );
};
