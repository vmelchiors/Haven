import React, { useEffect, useRef } from 'react';
import { Maximize2, Radio } from 'lucide-react';
import type { VoiceParticipant } from '../../types';

interface DesktopPipProps {
  participant: VoiceParticipant;
  onRestore: () => void;
  onStartDragging: () => void;
}

export const DesktopPip: React.FC<DesktopPipProps> = ({ participant, onRestore, onStartDragging }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const track = participant.screenTrack;
    if (!video || !track) return;
    video.srcObject = new MediaStream([track]);
    video.muted = true;
    void video.play().catch(() => undefined);
    return () => {
      video.srcObject = null;
    };
  }, [participant.screenTrack]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-black text-white select-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain bg-black"
        onDoubleClick={onRestore}
      />
      <div
        className="absolute inset-x-0 top-0 z-20 flex h-10 cursor-move items-center justify-between bg-gradient-to-b from-black/85 to-transparent px-3"
        onMouseDown={(event) => {
          if (event.button === 0) onStartDragging();
        }}
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
          <Radio className="h-3.5 w-3.5 flex-shrink-0 text-haven-rose" />
          <span className="truncate">{participant.name} · transmissão</span>
        </span>
        <button
          type="button"
          aria-label="Restaurar Haven"
          title="Restaurar Haven"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onRestore}
          className="rounded-lg border border-white/15 bg-black/55 p-1.5 text-zinc-100 transition hover:bg-haven-accent"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-7 text-[10px] text-zinc-300">
        Duplo clique para voltar ao Haven
      </div>
    </div>
  );
};
