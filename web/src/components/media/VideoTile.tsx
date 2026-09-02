import React, { useEffect, useRef } from 'react';
import { EyeOff, MicOff, Monitor, Play, Radio, Video, VolumeX } from 'lucide-react';
import { VoiceParticipant } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Track } from 'livekit-client';
import { useAuthStore } from '../../stores/authStore';
import { useCommunityStore } from '../../stores/communityStore';
import { ParticipantAudioControls } from './ParticipantAudioControls';

interface VideoTileProps {
  participant: VoiceParticipant;
  isScreenShare?: boolean;
  isCamera?: boolean;
  compact?: boolean;
  onVisibilityChange?: (source: Track.Source, isVisible: boolean) => void;
  isFocused?: boolean;
  onClick?: () => void;
  showWatchPrompt?: boolean;
  onWatchScreenShare?: () => void;
  onStopWatching?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isScreenShare = false,
  isCamera = false,
  compact = false,
  onVisibilityChange,
  isFocused = false,
  onClick,
  showWatchPrompt = false,
  onWatchScreenShare,
  onStopWatching,
}) => {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserAvatar = useAuthStore((s) => s.user?.avatar_url);
  const memberAvatar = useCommunityStore((s) => s.members.find((member) => member.id === participant.identity)?.avatar_url);
  const isLocal = participant.identity === currentUserId;
  const avatarUrl = isLocal ? currentUserAvatar : memberAvatar;
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
      className={`group relative w-full h-full min-h-0 bg-gradient-to-br from-haven-card to-haven-darker rounded-2xl overflow-hidden border transition-all duration-200 flex items-center justify-center cursor-pointer select-none ${
        participant.isSpeaking
          ? 'border-haven-emerald shadow-[0_0_0_2px_rgba(16,185,129,0.18),0_18px_50px_rgba(16,185,129,0.10)]'
          : 'border-haven-border hover:border-zinc-600'
      } ${isFocused ? 'ring-2 ring-haven-accent/80' : ''}`}
    >
      {!isLocal && (
        <ParticipantAudioControls
          identity={participant.identity}
          hasScreenAudio={participant.isScreenSharing}
          compact={compact}
        />
      )}
      {hasVideo && !compact ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${compact || isCamera ? 'object-cover' : 'object-contain'} bg-black ${shouldMirror ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-3">
          <Avatar
            src={avatarUrl}
            name={participant.name}
            size={compact ? 'md' : 'xl'}
            isSpeaking={participant.isSpeaking}
            className={compact ? 'w-11 h-11 text-xs rounded-xl' : 'w-20 h-20 text-xl rounded-2xl shadow-subtle'}
          />
        </div>
      )}

      {showWatchPrompt && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-haven-darkest/82 backdrop-blur-sm p-4 text-center">
          <div className="relative w-12 h-12 rounded-2xl bg-cyan-500/12 border border-cyan-400/25 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-haven-cyan" />
            <Radio className="absolute -right-1 -top-1 w-4 h-4 text-haven-rose animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">{participant.name} está transmitindo</p>
            <p className="mt-1 text-[11px] text-zinc-400">Entre apenas quando quiser assistir.</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onWatchScreenShare?.();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-haven-cyan px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Assistir transmissão
          </button>
        </div>
      )}

      {isScreenShare && onStopWatching && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onStopWatching();
          }}
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/65 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md transition hover:bg-haven-rose hover:text-white"
          title="Parar de receber esta transmissão"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Sair da transmissão
        </button>
      )}

      {/* Name and State Badges Overlay */}
      <div className={`absolute ${compact ? 'bottom-1.5 left-1.5 right-1.5' : 'bottom-2.5 left-2.5 right-2.5'} flex items-center justify-between pointer-events-none z-10`}>
        <div className={`flex items-center gap-1.5 bg-haven-darkest/80 backdrop-blur-md ${compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-xs'} rounded-lg border border-white/5 font-medium text-zinc-100 max-w-[82%] truncate shadow-subtle`}>
          {isScreenShare ? (
            <Monitor className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-haven-cyan flex-shrink-0`} />
          ) : isCamera ? (
            <Video className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-haven-accent flex-shrink-0`} />
          ) : null}
          <span className="truncate">
            {participant.name}{isLocal ? ' · você' : ''} {isScreenShare ? '· Tela' : isCamera ? '· Câmera' : ''}
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
