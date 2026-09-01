import React, { useMemo } from 'react';
import { useMediaStore } from '../../stores/mediaStore';
import { useAuthStore } from '../../stores/authStore';
import { VideoTile } from './VideoTile';
import { Track } from 'livekit-client';

interface VideoGridProps {
  onVisibilityChange?: (identity: string, source: Track.Source, isVisible: boolean) => void;
}

interface StreamTileItem {
  id: string;
  participantId: string;
  isScreenShare: boolean;
  isCamera: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ onVisibilityChange }) => {
  const participantsMap = useMediaStore((s) => s.participants);
  const activeVoiceChannel = useMediaStore((s) => s.activeVoiceChannel);
  const voiceChannelMembers = useMediaStore((s) => s.voiceChannelMembers);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const focusedParticipant = useMediaStore((s) => s.focusedParticipant);
  const participantTransitions = useMediaStore((s) => s.participantTransitions);
  const setFocusedParticipant = useMediaStore((s) => s.setFocusedParticipant);

  // Strictly filter participants to only active channel members + current user
  const participants = useMemo(() => {
    if (!activeVoiceChannel) return [];
    const channelMembers = voiceChannelMembers[activeVoiceChannel.id] || [];
    const validMemberIds = new Set(channelMembers.map((m) => m.user_id));
    if (currentUserId) validMemberIds.add(currentUserId);

    return Object.values(participantsMap).filter((p) => validMemberIds.has(p.identity));
  }, [participantsMap, activeVoiceChannel?.id, voiceChannelMembers, currentUserId]);

  // Compute all active video streams (Screenshare and/or Camera)
  const streamTiles = useMemo(() => {
    const list: StreamTileItem[] = [];

    participants.forEach((p) => {
      // 1. Screen sharing stream
      if (p.isScreenSharing) {
        list.push({
          id: `${p.identity}-screen`,
          participantId: p.identity,
          isScreenShare: true,
          isCamera: false,
        });
      }

      // 2. Camera stream
      if (p.isCameraOn) {
        list.push({
          id: `${p.identity}-camera`,
          participantId: p.identity,
          isScreenShare: false,
          isCamera: true,
        });
      }
    });

    // If a user is explicitly focused and not already in the list
    if (focusedParticipant && !list.some((item) => item.participantId === focusedParticipant)) {
      const focusedP = participants.find((p) => p.identity === focusedParticipant);
      if (focusedP) {
        list.push({
          id: `${focusedP.identity}-focused`,
          participantId: focusedP.identity,
          isScreenShare: false,
          isCamera: false,
        });
      }
    }

    return list;
  }, [participants, focusedParticipant]);

  if (participants.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-16 h-16 rounded-full bg-haven-surface flex items-center justify-center mb-3">
          <span className="text-2xl">🎙️</span>
        </div>
        <h3 className="text-base font-semibold text-slate-300">Sala de voz vazia</h3>
        <p className="text-xs text-slate-400 mt-1">Aguardando outros participantes se conectarem...</p>
      </div>
    );
  }

  // Active Streams Layout: Main Stage on Top + Bottom Filmstrip
  if (streamTiles.length > 0) {
    // Grid columns for top stage based on number of active streams
    const getStreamGridClass = (count: number) => {
      if (count === 1) return 'grid-cols-1 max-w-5xl';
      if (count === 2) return 'grid-cols-1 md:grid-cols-2 max-w-7xl';
      if (count <= 4) return 'grid-cols-1 sm:grid-cols-2 max-w-7xl';
      return 'grid-cols-2 md:grid-cols-3 max-w-7xl';
    };

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-haven-darkest/95">
        {/* TOP MAIN STAGE: Active Streams (Auto-split if multiple) */}
        <div className="flex-1 min-h-0 p-3 md:p-4 flex items-center justify-center overflow-hidden">
          <div
            className={`grid gap-3 w-full h-full max-h-full items-center justify-center ${getStreamGridClass(
              streamTiles.length
            )}`}
          >
            {streamTiles.map((stream) => {
              const participant = participantsMap[stream.participantId];
              if (!participant) return null;

              return (
                <div key={stream.id} className={`w-full h-full min-h-0 flex items-center justify-center transition-all duration-200 ${participantTransitions[participant.identity] === 'leaving' ? 'opacity-0 scale-95' : 'animate-scale-up'}`}>
                  <VideoTile
                    participant={participant}
                    isScreenShare={stream.isScreenShare}
                    isCamera={stream.isCamera}
                    isFocused={true}
                    onVisibilityChange={(src, visible) =>
                      onVisibilityChange?.(participant.identity, src, visible)
                    }
                    onClick={() => {
                      if (focusedParticipant === participant.identity) {
                        setFocusedParticipant(null);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM FILMSTRIP: All Voice Channel Participants */}
        <div className="h-32 md:h-36 flex-shrink-0 border-t border-haven-border/60 bg-haven-darker/80 px-3 py-2 flex items-center gap-2.5 overflow-x-auto scrollbar-thin">
          {participants.map((p) => {
            const isCurrentlyFocused = focusedParticipant === p.identity;
            return (
              <div
                key={p.identity}
                className={`h-full w-40 md:w-48 flex-shrink-0 cursor-pointer transition-all duration-200 ${participantTransitions[p.identity] === 'leaving' ? 'opacity-0 scale-95' : participantTransitions[p.identity] === 'entering' ? 'animate-scale-up' : ''}`}
                onClick={() => {
                  setFocusedParticipant(isCurrentlyFocused ? null : p.identity);
                }}
              >
                <VideoTile
                  participant={p}
                  isScreenShare={p.isScreenSharing}
                  isCamera={p.isCameraOn}
                  compact={true}
                  isFocused={isCurrentlyFocused}
                  onVisibilityChange={(src, visible) =>
                    onVisibilityChange?.(p.identity, src, visible)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Voice Only Layout: Balanced Center Grid
  const getVoiceGridCols = (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-sm';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-2xl';
    if (count <= 4) return 'grid-cols-2 max-w-3xl';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-5xl';
    return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-6xl';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-haven-darkest/95">
      <div
        className={`grid gap-4 w-full h-full max-h-full items-center justify-center ${getVoiceGridCols(
          participants.length
        )}`}
      >
        {participants.map((p) => (
          <div key={p.identity} className={`w-full h-full min-h-[160px] aspect-video transition-all duration-200 ${participantTransitions[p.identity] === 'leaving' ? 'opacity-0 scale-95' : participantTransitions[p.identity] === 'entering' ? 'animate-scale-up' : ''}`}>
            <VideoTile
              participant={p}
              isScreenShare={p.isScreenSharing}
              isCamera={p.isCameraOn}
              onVisibilityChange={(src, visible) => onVisibilityChange?.(p.identity, src, visible)}
              onClick={() => setFocusedParticipant(focusedParticipant === p.identity ? null : p.identity)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
