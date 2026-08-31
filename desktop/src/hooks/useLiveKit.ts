import { useCallback, useEffect, useRef } from 'react';
import { ConnectionState, LocalParticipant, Participant, RemoteParticipant, RemoteTrack, RemoteTrackPublication, Room, RoomEvent, Track, TrackPublication, VideoPresets } from 'livekit-client';
import { useAuthStore } from '../stores/authStore';
import { useMediaStore } from '../stores/mediaStore';
import { useSettingsStore } from '../stores/settingsStore';

const clampVolume = (volume: number) => Math.min(Math.max(volume / 100, 0), 1);
const isScreenShareSource = (source?: Track.Source) =>
  source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;

export function useLiveKit(_channelId?: string) {
  const roomRef = useRef<Room | null>(null);
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeVoiceChannel = useMediaStore((s) => s.activeVoiceChannel);
  const rtcToken = useMediaStore((s) => s.rtcToken);
  const rtcUrl = useMediaStore((s) => s.rtcUrl);
  const isMuted = useMediaStore((s) => s.isMuted);
  const isDeafened = useMediaStore((s) => s.isDeafened);
  const isCameraOn = useMediaStore((s) => s.isCameraOn);
  const isScreenSharing = useMediaStore((s) => s.isScreenSharing);
  const watchedScreenShares = useMediaStore((s) => s.watchedScreenShares);
  const isPushToTalkActive = useMediaStore((s) => s.isPushToTalkActive);
  const voiceChannelMembers = useMediaStore((s) => s.voiceChannelMembers);
  const selectedInputDeviceId = useSettingsStore((s) => s.selectedInputDeviceId);
  const selectedOutputDeviceId = useSettingsStore((s) => s.selectedOutputDeviceId);
  const outputVolume = useSettingsStore((s) => s.outputVolume);
  const isPttEnabled = useSettingsStore((s) => s.isPttEnabled);
  const currentUser = useAuthStore((s) => s.user);
  const upsertParticipant = useMediaStore((s) => s.upsertParticipant);
  const isEffectivelyMuted = isMuted || isDeafened || (isPttEnabled && !isPushToTalkActive);

  // Presence must not depend on microphone/camera publication. A user belongs in the room UI
  // as soon as the voice-presence service reports that they joined.
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) return;
    const members = voiceChannelMembers[activeVoiceChannel.id] || [];
    upsertParticipant({
      identity: currentUser.id,
      name: currentUser.username,
      isMuted: isEffectivelyMuted,
      isDeafened,
      isCameraOn,
      isScreenSharing,
      audioLevel: 0,
    });
    members.forEach((member) => upsertParticipant({
      identity: member.user_id,
      name: member.username,
      isSpeaking: Boolean(member.is_speaking),
      isMuted: Boolean(member.is_muted),
      isDeafened: Boolean(member.is_deafened),
      isCameraOn: Boolean(member.is_camera_on),
      isScreenSharing: Boolean(member.is_screen_sharing),
      audioLevel: 0,
    }));
  }, [activeVoiceChannel?.id, currentUser?.id, voiceChannelMembers, isEffectivelyMuted, isDeafened, isCameraOn, isScreenSharing, upsertParticipant]);

  const removeRemoteAudio = useCallback((identity: string, trackSid?: string) => {
    const prefix = `${identity}:`;
    remoteAudiosRef.current.forEach((audio, key) => {
      if (trackSid ? key !== `${prefix}${trackSid}` : !key.startsWith(prefix)) return;
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      remoteAudiosRef.current.delete(key);
    });
  }, []);

  const syncLocalParticipant = useCallback((participant: LocalParticipant) => {
    if (!currentUser) return;
    const camera = participant.getTrackPublication(Track.Source.Camera);
    const screen = participant.getTrackPublication(Track.Source.ScreenShare);
    upsertParticipant({
      identity: currentUser.id, name: currentUser.username,
      isSpeaking: participant.isSpeaking, isMuted: isEffectivelyMuted, isDeafened,
      isCameraOn: Boolean(camera && !camera.isMuted),
      isScreenSharing: Boolean(screen && !screen.isMuted),
      audioLevel: participant.audioLevel,
      cameraTrack: camera?.track?.mediaStreamTrack,
      screenTrack: screen?.track?.mediaStreamTrack,
    });
  }, [currentUser, isDeafened, isEffectivelyMuted, upsertParticipant]);

  const syncRemoteParticipant = useCallback((participant: RemoteParticipant) => {
    const camera = participant.getTrackPublication(Track.Source.Camera);
    const screen = participant.getTrackPublication(Track.Source.ScreenShare);
    upsertParticipant({
      identity: participant.identity, name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking, isMuted: !participant.isMicrophoneEnabled, isDeafened: false,
      isCameraOn: Boolean(camera?.track && !camera.isMuted),
      isScreenSharing: Boolean(screen?.track && !screen.isMuted),
      audioLevel: participant.audioLevel,
      cameraTrack: camera?.track?.mediaStreamTrack,
      screenTrack: screen?.track?.mediaStreamTrack,
    });
  }, [upsertParticipant]);

  const attachRemoteAudio = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
    const key = `${participant.identity}:${track.sid}`;
    removeRemoteAudio(participant.identity, track.sid);
    const element = track.attach() as HTMLAudioElement;
    element.autoplay = true;
    element.setAttribute('playsinline', 'true');
    element.style.display = 'none';
    element.muted = useMediaStore.getState().isDeafened;
    element.volume = element.muted ? 0 : clampVolume(useSettingsStore.getState().outputVolume);
    const outputId = useSettingsStore.getState().selectedOutputDeviceId;
    if (outputId && outputId !== 'default' && 'setSinkId' in element) {
      (element as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(outputId).catch(() => {});
    }
    document.body.appendChild(element);
    remoteAudiosRef.current.set(key, element);
    element.play().catch(() => {});
  }, [removeRemoteAudio]);

  // LiveKit is the single media transport; WebSocket only mirrors presence and control state.
  useEffect(() => {
    if (!activeVoiceChannel || !rtcToken || !rtcUrl) {
      useMediaStore.setState({ isVoiceConnected: false, voiceConnectionState: 'disconnected' });
      return;
    }
    const room = new Room({
      adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true,
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
      publishDefaults: {
        simulcast: true,
        videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 30 },
        screenShareEncoding: { maxBitrate: 3_000_000, maxFramerate: 30 },
      },
    });
    roomRef.current = room;
    let disposed = false;
    useMediaStore.setState({ isVoiceConnected: false, voiceConnectionState: 'connecting' });
    const markDisconnected = () => { if (!disposed) useMediaStore.setState({ isVoiceConnected: false, voiceConnectionState: 'disconnected' }); };
    const markReconnecting = () => { if (!disposed) useMediaStore.setState({ isVoiceConnected: false, voiceConnectionState: 'reconnecting' }); };
    const markConnected = () => { if (!disposed) useMediaStore.setState({ isVoiceConnected: true, voiceConnectionState: 'connected' }); };
    const configureRemotePublication = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      const shouldSubscribe = !isScreenShareSource(publication.source) ||
        Boolean(useMediaStore.getState().watchedScreenShares[participant.identity]);
      publication.setSubscribed(shouldSubscribe);
    };
    const participantConnected = (p: RemoteParticipant) => {
      p.trackPublications.forEach((publication) => configureRemotePublication(publication, p));
      syncRemoteParticipant(p);
    };
    const participantDisconnected = (p: RemoteParticipant) => {
      removeRemoteAudio(p.identity);
      // Voice presence owns membership/removal so brief RTC reconnects do not make users flicker.
      upsertParticipant({ identity: p.identity, isSpeaking: false, audioLevel: 0, cameraTrack: undefined, screenTrack: undefined });
    };
    const trackSubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) attachRemoteAudio(track, p);
      syncRemoteParticipant(p);
    };
    const trackUnsubscribed = (track: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) removeRemoteAudio(p.identity, track.sid);
      syncRemoteParticipant(p);
    };
    const trackChanged = (_pub: TrackPublication, participant: Participant) => {
      const remote = room.remoteParticipants.get(participant.identity);
      if (remote) syncRemoteParticipant(remote);
      else syncLocalParticipant(room.localParticipant);
    };
    const trackPublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      configureRemotePublication(publication, participant);
      syncRemoteParticipant(participant);
    };
    const trackUnpublished = (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (publication.source === Track.Source.ScreenShare) {
        useMediaStore.getState().setScreenShareWatching(participant.identity, false);
      }
      syncRemoteParticipant(participant);
    };
    const speakersChanged = (speakers: Participant[]) => {
      const active = new Map(speakers.map((speaker) => [speaker.identity, speaker.audioLevel]));
      room.remoteParticipants.forEach((p) => upsertParticipant({
        identity: p.identity, isSpeaking: active.has(p.identity), audioLevel: active.get(p.identity) || 0,
      }));
      const localLevel = active.get(room.localParticipant.identity) || 0;
      useMediaStore.getState().setVadLevel(localLevel, active.has(room.localParticipant.identity));
      syncLocalParticipant(room.localParticipant);
    };

    room.on(RoomEvent.Connected, markConnected);
    room.on(RoomEvent.Reconnected, markConnected);
    room.on(RoomEvent.Reconnecting, markReconnecting);
    room.on(RoomEvent.Disconnected, markDisconnected);
    room.on(RoomEvent.ParticipantConnected, participantConnected);
    room.on(RoomEvent.ParticipantDisconnected, participantDisconnected);
    room.on(RoomEvent.TrackSubscribed, trackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, trackUnsubscribed);
    room.on(RoomEvent.TrackPublished, trackPublished);
    room.on(RoomEvent.TrackUnpublished, trackUnpublished);
    room.on(RoomEvent.TrackMuted, trackChanged);
    room.on(RoomEvent.TrackUnmuted, trackChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, speakersChanged);

    let connectUrl = rtcUrl;
    if (connectUrl.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      connectUrl = `${protocol}//${window.location.host}${connectUrl}`;
    }
    room.connect(connectUrl, rtcToken, { autoSubscribe: false }).then(async () => {
      if (disposed) return;
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((publication) => configureRemotePublication(publication, participant));
        syncRemoteParticipant(participant);
      });
      syncLocalParticipant(room.localParticipant);
      if (selectedInputDeviceId && selectedInputDeviceId !== 'default') {
        await room.switchActiveDevice('audioinput', selectedInputDeviceId).catch(() => false);
      }
      const state = useMediaStore.getState();
      const settings = useSettingsStore.getState();
      const shouldMute = state.isMuted || state.isDeafened || (settings.isPttEnabled && !state.isPushToTalkActive);
      await room.localParticipant.setMicrophoneEnabled(!shouldMute, {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        deviceId: selectedInputDeviceId !== 'default' ? selectedInputDeviceId : undefined,
      });
      if (state.isCameraOn) {
        await room.localParticipant.setCameraEnabled(true, { resolution: VideoPresets.h720.resolution, frameRate: 30 });
      }
      if (state.isScreenSharing) {
        await room.localParticipant.setScreenShareEnabled(true, {
          audio: true, selfBrowserSurface: 'include', resolution: VideoPresets.h1080.resolution,
        });
      }
      syncLocalParticipant(room.localParticipant);
    }).catch((error) => {
      console.error('[LiveKit] Não foi possível conectar à sala:', error); markDisconnected();
      useMediaStore.setState({ voiceConnectionState: 'error' });
    });

    return () => {
      disposed = true;
      room.removeAllListeners(); room.disconnect();
      remoteAudiosRef.current.forEach((_, key) => removeRemoteAudio(key.split(':')[0]));
      if (roomRef.current === room) roomRef.current = null;
      useMediaStore.setState({ isVoiceConnected: false, voiceConnectionState: 'disconnected', vadLevel: 0, isSpeaking: false });
    };
  }, [activeVoiceChannel?.id, rtcToken, rtcUrl]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    if (selectedInputDeviceId && selectedInputDeviceId !== 'default') {
      room.switchActiveDevice('audioinput', selectedInputDeviceId).catch(() => false);
    }
  }, [selectedInputDeviceId]);

  useEffect(() => {
    remoteAudiosRef.current.forEach((audio) => {
      audio.muted = isDeafened;
      audio.volume = isDeafened ? 0 : clampVolume(outputVolume);
      if (selectedOutputDeviceId && selectedOutputDeviceId !== 'default' && 'setSinkId' in audio) {
        (audio as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(selectedOutputDeviceId).catch(() => {});
      }
    });
  }, [isDeafened, outputVolume, selectedOutputDeviceId]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(!isEffectivelyMuted, {
      echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      deviceId: selectedInputDeviceId !== 'default' ? selectedInputDeviceId : undefined,
    }).then(() => syncLocalParticipant(room.localParticipant)).catch((error) => {
      console.error('[Microfone] Não foi possível alterar o microfone:', error);
      useMediaStore.setState({ isMuted: true });
    });
  }, [isEffectivelyMuted, selectedInputDeviceId, syncLocalParticipant]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setCameraEnabled(isCameraOn, {
      resolution: VideoPresets.h720.resolution, frameRate: 30,
    }).then(() => syncLocalParticipant(room.localParticipant)).catch((error) => {
      console.error('[Câmera] Não foi possível alterar a câmera:', error);
      useMediaStore.setState({ isCameraOn: false });
    });
  }, [isCameraOn, syncLocalParticipant]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.localParticipant.setScreenShareEnabled(isScreenSharing, {
      audio: true, selfBrowserSurface: 'include', resolution: VideoPresets.h1080.resolution,
    }).then(() => {
      const mediaTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track?.mediaStreamTrack;
      if (mediaTrack) mediaTrack.onended = () => useMediaStore.setState({ isScreenSharing: false });
      syncLocalParticipant(room.localParticipant);
    }).catch((error) => {
      console.error('[Transmissão] Não foi possível compartilhar a tela:', error);
      useMediaStore.setState({ isScreenSharing: false });
    });
  }, [isScreenSharing, syncLocalParticipant]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (isScreenShareSource(publication.source)) {
          publication.setSubscribed(Boolean(watchedScreenShares[participant.identity]));
        }
      });
      syncRemoteParticipant(participant);
    });
  }, [watchedScreenShares, syncRemoteParticipant]);

  const setTrackVisible = useCallback((identity: string, source: Track.Source, visible: boolean) => {
    const publication = roomRef.current?.remoteParticipants.get(identity)?.getTrackPublication(source);
    if (publication instanceof RemoteTrackPublication) {
      const shouldSubscribe = source === Track.Source.ScreenShare
        ? visible && Boolean(useMediaStore.getState().watchedScreenShares[identity])
        : visible;
      publication.setSubscribed(shouldSubscribe);
    }
  }, []);
  return { room: roomRef.current, setTrackVisible };
}

