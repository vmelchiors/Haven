import React, { useEffect, useRef } from 'react';
import { MicOff, Monitor, Video, VolumeX } from 'lucide-react';
import { VoiceParticipant } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Track } from 'livekit-client';
import { useAuthStore } from '../../stores/authStore';

interface VideoTileProps {
  participant: VoiceParticipant;
  isScreenShare?: boolean;
  isCamera?: boolean;
  compact?: boolean;
  onVisibilityChange?: (source: Track.Source, isVisible: boolean) => void;
  isFocused?: boolean;
  onClick?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isScreenShare = false,
  isCamera = false,
  compact = false,
  onVisibilityChange,
  isFocused = false,
  onClick,
}) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isLocal = participant.identity === currentUserId;
  // Only mirror local camera preview (selfie mode). NEVER mirror screenshares or remote viewers!
  const shouldMirror = isLocal && isCamera && !isScreenShare;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Strictly isolate screenTrack for screen share and cameraTrack for camera, with fallback if only one stream is active
  const activeTrack = isScreenShare
    ? participant.screenTrack || (participant.isScreenSharing && !participant.isCameraOn ? participant.cameraTrack : undefined)
    : isCamera
    ? participant.cameraTrack || (participant.isCameraOn && !participant.isScreenSharing ? participant.screenTrack : undefined)
    : undefined;

  const onVisibilityChangeRef = useRef(onVisibilityChange);
  useEffect(() => {
    onVisibilityChangeRef.current = onVisibilityChange;
  });

  // Attach MediaStream to HTML video element
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (activeTrack) {
      activeTrack.enabled = true;
      const mediaStream = new MediaStream([activeTrack]);
      videoEl.srcObject = mediaStream;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.setAttribute('autoplay', 'true');
      videoEl.setAttribute('muted', 'true');

      const playVideo = () => {
        if (videoEl && videoEl.srcObject) {
          videoEl.play().catch((err) => {
            console.warn('[VideoTile] Play error:', err);
          });
        }
      };

      videoEl.onloadedmetadata = playVideo;
      playVideo();

      const handleUnmute = () => playVideo();
      activeTrack.addEventListener('unmute', handleUnmute);

      return () => {
        activeTrack.removeEventListener('unmute', handleUnmute);
        if (videoEl) {
          videoEl.srcObject = null;
        }
      };
    } else {
      videoEl.srcObject = null;
    }
  }, [activeTrack, isScreenShare, isCamera]);

  // IntersectionObserver for Dynamic Track Subscriptions
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onVisibilityChangeRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting;
          if (isScreenShare) {
            onVisibilityChangeRef.current?.(Track.Source.ScreenShare, isVisible);
          } else if (isCamera) {
            onVisibilityChangeRef.current?.(Track.Source.Camera, isVisible);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isScreenShare, isCamera]);

  const hasVideo = Boolean(activeTrack);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full h-full min-h-0 bg-haven-card rounded-xl overflow-hidden border transition-all duration-150 flex items-center justify-center cursor-pointer select-none ${
        participant.isSpeaking
          ? 'border-haven-emerald ring-2 ring-haven-emerald/40'
          : 'border-haven-border hover:border-zinc-500'
      } ${isFocused ? 'ring-2 ring-haven-accent' : ''}`}
    >
      {hasVideo && !compact ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain bg-black ${shouldMirror ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-3">
          <Avatar
            name={participant.name}
            size={compact ? 'md' : 'xl'}
            isSpeaking={participant.isSpeaking}
            className={compact ? 'w-10 h-10 text-xs' : 'w-16 h-16 text-xl shadow-subtle'}
          />
        </div>
      )}

      {/* Name and State Badges Overlay */}
      <div className={`absolute ${compact ? 'bottom-1.5 left-1.5 right-1.5' : 'bottom-2.5 left-2.5 right-2.5'} flex items-center justify-between pointer-events-none z-10`}>
        <div className={`flex items-center gap-1.5 bg-haven-darker/90 backdrop-blur-md ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-xs'} rounded-md border border-haven-border font-medium text-zinc-100 max-w-[80%] truncate shadow-subtle`}>
          {isScreenShare ? (
            <Monitor className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-haven-cyan flex-shrink-0`} />
          ) : isCamera ? (
            <Video className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-haven-accent flex-shrink-0`} />
          ) : null}
          <span className="truncate">
            {participant.name} {isScreenShare ? '(Tela)' : isCamera ? '(Câmera)' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {participant.isDeafened ? (
            <div className={`bg-haven-rose/90 ${compact ? 'p-1' : 'p-1.5'} rounded-md text-white`} title="Ensurdecido">
              <VolumeX className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            </div>
          ) : participant.isMuted ? (
            <div className={`bg-haven-rose/90 ${compact ? 'p-1' : 'p-1.5'} rounded-md text-white`} title="Mutado">
              <MicOff className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
