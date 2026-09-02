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
  const watchedScreenShares = useMediaStore((s) => s.watchedScreenShares);
  const setFocusedParticipant = useMediaStore((s) => s.setFocusedParticipant);
  const setScreenShareWatching = useMediaStore((s) => s.setScreenShareWatching);

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
      if (p.isScreenSharing && (p.identity === currentUserId || watchedScreenShares[p.identity])) {
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
  }, [participants, focusedParticipant, currentUserId, watchedScreenShares]);

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

  // Active media uses a focused stage with a compact participant rail.
  if (streamTiles.length > 0) {
    const primaryStream =
      streamTiles.find((stream) => stream.participantId === focusedParticipant && stream.isScreenShare) ||
      streamTiles.find((stream) => stream.participantId === focusedParticipant) ||
      streamTiles.find((stream) => stream.isScreenShare) ||
      streamTiles[0];
    const primaryParticipant = participantsMap[primaryStream.participantId]!;

    return (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 p-3 md:p-4 pb-24 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.08),_transparent_42%)]">
        <div className="flex-1 min-w-0 min-h-[220px] flex items-center justify-center overflow-hidden">
          <div className="w-full h-full max-w-7xl haven-stage-enter">
            <VideoTile
              participant={primaryParticipant}
              isScreenShare={primaryStream.isScreenShare}
              isCamera={primaryStream.isCamera}
              isFocused
              onVisibilityChange={(src, visible) => onVisibilityChange?.(primaryParticipant.identity, src, visible)}
              onStopWatching={primaryStream.isScreenShare && primaryParticipant.identity !== currentUserId
                ? () => setScreenShareWatching(primaryParticipant.identity, false)
                : undefined}
              onClick={() => setFocusedParticipant(null)}
            />
          </div>
        </div>

        <aside className="h-28 md:h-auto md:w-52 lg:w-56 flex-shrink-0 flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden scrollbar-thin" aria-label="Participantes na chamada">
          {participants.map((p) => {
            const isCurrentlyFocused = focusedParticipant === p.identity;
            const isRemoteBroadcastAvailable = p.identity !== currentUserId && p.isScreenSharing && !watchedScreenShares[p.identity];
            const isWatchingScreen = p.isScreenSharing && (p.identity === currentUserId || Boolean(watchedScreenShares[p.identity]));
            return (
              <div
                key={p.identity}
                className={`h-full md:h-28 w-40 md:w-full flex-shrink-0 cursor-pointer transition-all duration-200 ${participantTransitions[p.identity] === 'leaving' ? 'haven-participant-leave' : participantTransitions[p.identity] === 'entering' ? 'haven-participant-enter' : ''}`}
                onClick={() => {
                  setFocusedParticipant(isCurrentlyFocused ? null : p.identity);
                }}
              >
                <VideoTile
                  participant={p}
                  isScreenShare={isWatchingScreen}
                  isCamera={!isWatchingScreen && p.isCameraOn}
                  compact={true}
                  isFocused={isCurrentlyFocused}
                  showWatchPrompt={isRemoteBroadcastAvailable}
                  onWatchScreenShare={() => setScreenShareWatching(p.identity, true)}
                  onVisibilityChange={(src, visible) =>
                    onVisibilityChange?.(p.identity, src, visible)
                  }
                />
              </div>
            );
          })}
        </aside>
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
    <div className="flex-1 flex items-center justify-center p-4 md:p-8 pb-28 overflow-auto bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.06),_transparent_46%)]">
      <div
        className={`grid gap-4 w-full max-h-full items-center justify-center ${getVoiceGridCols(
          participants.length
        )}`}
      >
        {participants.map((p) => (
          <div key={p.identity} className={`w-full min-h-[150px] h-[clamp(160px,24vh,240px)] transition-all duration-200 ${participantTransitions[p.identity] === 'leaving' ? 'haven-participant-leave' : participantTransitions[p.identity] === 'entering' ? 'haven-participant-enter' : ''}`}>
            <VideoTile
              participant={p}
              isScreenShare={p.isScreenSharing && (p.identity === currentUserId || Boolean(watchedScreenShares[p.identity]))}
              isCamera={p.isCameraOn}
              showWatchPrompt={p.identity !== currentUserId && p.isScreenSharing && !watchedScreenShares[p.identity]}
              onWatchScreenShare={() => setScreenShareWatching(p.identity, true)}
              onVisibilityChange={(src, visible) => onVisibilityChange?.(p.identity, src, visible)}
              onClick={() => setFocusedParticipant(focusedParticipant === p.identity ? null : p.identity)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
