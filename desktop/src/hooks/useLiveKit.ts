import { useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  VideoPresets,
} from 'livekit-client';
import { useMediaStore, type RemoteAudioSource } from '../stores/mediaStore';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWebSocket, subscribeToWebSocketEvents } from './useWebSocket';
import { WSMessage } from '../types';
import {
  startNoiseSuppressionTransition,
  type AINoiseSuppressionPipeline,
} from '../lib/aiNoiseSuppression';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

interface PeerState {
  pc: RTCPeerConnection;
  isMakingOffer: boolean;
  isIgnoringOffer: boolean;
  iceCandidatesQueue: RTCIceCandidateInit[];
  audioTransceiver: RTCRtpTransceiver;
  cameraTransceiver: RTCRtpTransceiver;
  screenTransceiver: RTCRtpTransceiver;
  screenAudioTransceiver: RTCRtpTransceiver;
}

interface RemoteAudioOutput {
  element: HTMLAudioElement;
  identity: string;
  source: RemoteAudioSource;
}

const remoteAudioKey = (identity: string, source: RemoteAudioSource) => `${source}:${identity}`;

export function useLiveKit(_channelId?: string) {
  const roomRef = useRef<Room | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const remoteAudiosRef = useRef<Map<string, RemoteAudioOutput>>(new Map());
  const localStreamsRef = useRef<{
    mic: MediaStream | null;
    camera: MediaStream | null;
    screen: MediaStream | null;
  }>({
    mic: null,
    camera: null,
    screen: null,
  });

  const activeVoiceChannel = useMediaStore((s) => s.activeVoiceChannel);
  const rtcToken = useMediaStore((s) => s.rtcToken);
  const rtcUrl = useMediaStore((s) => s.rtcUrl);
  const isMuted = useMediaStore((s) => s.isMuted);
  const isDeafened = useMediaStore((s) => s.isDeafened);
  const isCameraOn = useMediaStore((s) => s.isCameraOn);
  const isScreenSharing = useMediaStore((s) => s.isScreenSharing);
  const isNoiseSuppressionEnabled = useMediaStore((s) => s.isNoiseSuppressionEnabled);
  const isPushToTalkActive = useMediaStore((s) => s.isPushToTalkActive);
  const voiceChannelMembers = useMediaStore((s) => s.voiceChannelMembers);
  const remoteAudioPreferences = useMediaStore((s) => s.remoteAudioPreferences);
  const isCompanionModeEnabled = useMediaStore((s) => s.isCompanionModeEnabled);

  const selectedInputDeviceId = useSettingsStore((s) => s.selectedInputDeviceId);
  const selectedOutputDeviceId = useSettingsStore((s) => s.selectedOutputDeviceId);
  const outputVolume = useSettingsStore((s) => s.outputVolume);
  const isPttEnabled = useSettingsStore((s) => s.isPttEnabled);
  const vadThreshold = useSettingsStore((s) => s.vadThreshold);

  const upsertParticipant = useMediaStore((s) => s.upsertParticipant);
  const removeParticipant = useMediaStore((s) => s.removeParticipant);
  const setNoiseSuppressionStatus = useMediaStore((s) => s.setNoiseSuppressionStatus);
  const currentUser = useAuthStore((s) => s.user);

  const { sendVoiceJoin, sendVoiceLeave, sendVoiceState, sendWebRTCSignal } = useWebSocket();

  // Compute effective mute state (Muted, Deafened, or PTT enabled and not held)
  const isEffectivelyMuted = isMuted || isDeafened || isCompanionModeEnabled
    || (isPttEnabled && !isPushToTalkActive);
  const isEffectivelyMutedRef = useRef(isEffectivelyMuted);
  // Keep async media callbacks aligned with the latest render immediately.
  isEffectivelyMutedRef.current = isEffectivelyMuted;

  const configureRemoteAudioOutput = useCallback((output: RemoteAudioOutput) => {
    const mediaState = useMediaStore.getState();
    const settingsState = useSettingsStore.getState();
    const preference = mediaState.remoteAudioPreferences[output.identity];
    const individualVolume = output.source === 'voice'
      ? preference?.voiceVolume ?? 100
      : preference?.screenVolume ?? 100;
    const locallyMuted = output.source === 'voice'
      ? preference?.voiceMuted ?? false
      : preference?.screenMuted ?? false;

    output.element.volume = Math.min(
      Math.max((settingsState.outputVolume / 100) * (individualVolume / 100), 0),
      1,
    );
    output.element.muted = mediaState.isDeafened
      || mediaState.isCompanionModeEnabled
      || locallyMuted
      || individualVolume === 0;
  }, []);

  const attachRemoteAudio = useCallback((
    identity: string,
    source: RemoteAudioSource,
    stream: MediaStream,
  ) => {
    const key = remoteAudioKey(identity, source);
    let output = remoteAudiosRef.current.get(key);
    if (!output) {
      const element = document.createElement('audio');
      element.autoplay = true;
      element.setAttribute('playsinline', 'true');
      element.setAttribute('autoplay', 'true');
      element.style.display = 'none';
      document.body.appendChild(element);
      output = { element, identity, source };
      remoteAudiosRef.current.set(key, output);
    }

    output.element.srcObject = stream;
    configureRemoteAudioOutput(output);
    const selectedOutput = useSettingsStore.getState().selectedOutputDeviceId;
    if (selectedOutput && selectedOutput !== 'default' && (output.element as any).setSinkId) {
      (output.element as any).setSinkId(selectedOutput).catch(() => undefined);
    }
    output.element.play().catch((error) => {
      console.warn('[Remote Audio] Play error:', error);
    });
    return output.element;
  }, [configureRemoteAudioOutput]);

  const removeRemoteAudioOutputs = useCallback((identity: string, source?: RemoteAudioSource) => {
    remoteAudiosRef.current.forEach((output, key) => {
      if (output.identity !== identity || (source && output.source !== source)) return;
      output.element.pause();
      output.element.srcObject = null;
      output.element.remove();
      remoteAudiosRef.current.delete(key);
    });
  }, []);

  // 1. Broadcast presence in voice channel to everyone
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) return;

    sendVoiceJoin(activeVoiceChannel.id, {
      user_id: currentUser.id,
      username: currentUser.username,
      channel_id: activeVoiceChannel.id,
      is_muted: isEffectivelyMuted,
      is_deafened: isDeafened,
      is_camera_on: isCameraOn,
      is_screen_sharing: isScreenSharing,
    });

    return () => {
      sendVoiceLeave(activeVoiceChannel.id);
    };
  }, [activeVoiceChannel?.id, currentUser?.id]);

  // Broadcast state changes
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) return;

    sendVoiceState(activeVoiceChannel.id, {
      user_id: currentUser.id,
      username: currentUser.username,
      channel_id: activeVoiceChannel.id,
      is_muted: isEffectivelyMuted,
      is_deafened: isDeafened,
      is_camera_on: isCameraOn,
      is_screen_sharing: isScreenSharing,
    });
  }, [activeVoiceChannel?.id, isEffectivelyMuted, isDeafened, isCameraOn, isScreenSharing]);

  // 2. Always ensure local participant exists in voice room
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) return;

    upsertParticipant({
      identity: currentUser.id,
      name: currentUser.username,
      isMuted: isEffectivelyMuted,
      isDeafened,
      isCameraOn,
      isScreenSharing,
      audioLevel: 0,
      screenTrack: localStreamsRef.current.screen?.getVideoTracks()[0],
      cameraTrack: localStreamsRef.current.camera?.getVideoTracks()[0],
      mediaStream: localStreamsRef.current.screen || localStreamsRef.current.camera || undefined,
    });
  }, [
    activeVoiceChannel?.id,
    currentUser?.id,
    currentUser?.username,
    isEffectivelyMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
  ]);

  // 3. Mirror all other members of this voice channel into participants
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) return;

    const channelMembers = voiceChannelMembers[activeVoiceChannel.id] || [];
    const currentMemberIds = new Set(channelMembers.map((m) => m.user_id));
    currentMemberIds.add(currentUser.id);

    // Immediately clean up any participants that have left the channel
    const allParticipants = useMediaStore.getState().participants;
    Object.keys(allParticipants).forEach((id) => {
      if (!currentMemberIds.has(id)) {
        removeParticipant(id);
        const peer = peersRef.current.get(id);
        if (peer) {
          peer.pc.close();
          peersRef.current.delete(id);
        }
        removeRemoteAudioOutputs(id);
      }
    });

    channelMembers.forEach((m) => {
      if (m.user_id !== currentUser.id) {
        upsertParticipant({
          identity: m.user_id,
          name: m.username && m.username !== 'Anonymous' ? m.username : `User ${m.user_id.slice(0, 4)}`,
          isSpeaking: Boolean(m.is_speaking),
          isMuted: Boolean(m.is_muted),
          isDeafened: Boolean(m.is_deafened),
          isCameraOn: Boolean(m.is_camera_on),
          isScreenSharing: Boolean(m.is_screen_sharing),
          audioLevel: 0,
        });
      }
    });
  }, [activeVoiceChannel?.id, voiceChannelMembers, currentUser?.id]);

  // Sync mute state on local microphone track & all peer audio transceivers
  useEffect(() => {
    if (localStreamsRef.current.mic) {
      localStreamsRef.current.mic.getAudioTracks().forEach((track) => {
        track.enabled = !isEffectivelyMuted;
      });
    }

    // Replace audio track across all active peers with null when muted so no audio packets leak
    for (const peer of peersRef.current.values()) {
      if (peer && peer.pc.signalingState !== 'closed') {
        const track = !isEffectivelyMuted ? (localStreamsRef.current.mic?.getAudioTracks()[0] || null) : null;
        peer.audioTransceiver.sender.replaceTrack(track).catch(() => {});
      }
    }

    if (currentUser) {
      upsertParticipant({
        identity: currentUser.id,
        isMuted: isEffectivelyMuted,
        isDeafened,
        isSpeaking: isEffectivelyMuted ? false : undefined,
      });
    }
  }, [isEffectivelyMuted, isDeafened, currentUser?.id]);

  // Sync global and per-participant preferences on all remote audio outputs.
  useEffect(() => {
    remoteAudiosRef.current.forEach(configureRemoteAudioOutput);
  }, [isDeafened, isCompanionModeEnabled, outputVolume, remoteAudioPreferences, configureRemoteAudioOutput]);

  // Global user interaction unblocker for browser autoplay policies
  useEffect(() => {
    const unlockAudio = () => {
      remoteAudiosRef.current.forEach(({ element }) => {
        if (element.paused && element.srcObject) {
          element.play().catch(() => {});
        }
      });
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Helper to sync all active tracks to a specific peer transceiver
  const syncTracksToPeer = useCallback(async (targetUserId: string) => {
    const peer = peersRef.current.get(targetUserId);
    if (!peer || peer.pc.signalingState === 'closed') return;

    const isMutedNow = isEffectivelyMutedRef.current;
    const isCameraActive = useMediaStore.getState().isCameraOn;
    const isScreenActive = useMediaStore.getState().isScreenSharing;

    // 1. Audio Track (Microphone) - null if muted
    const micTrack = !isMutedNow ? (localStreamsRef.current.mic?.getAudioTracks()[0] || null) : null;
    if (peer.audioTransceiver.sender.track !== micTrack) {
      try {
        await peer.audioTransceiver.sender.replaceTrack(micTrack);
      } catch {}
    }

    // 2. Camera Video Track
    const cameraTrack = isCameraActive ? (localStreamsRef.current.camera?.getVideoTracks()[0] || null) : null;
    if (peer.cameraTransceiver.sender.track !== cameraTrack) {
      try {
        await peer.cameraTransceiver.sender.replaceTrack(cameraTrack);
      } catch {}
    }

    // 3. Screen Share Video Track
    const screenTrack = isScreenActive ? (localStreamsRef.current.screen?.getVideoTracks()[0] || null) : null;
    if (peer.screenTransceiver.sender.track !== screenTrack) {
      try {
        await peer.screenTransceiver.sender.replaceTrack(screenTrack);
      } catch {}
    }

    // 4. Screen Share Audio Track
    const screenAudioTrack = isScreenActive
      ? (localStreamsRef.current.screen?.getAudioTracks()[0] || null)
      : null;
    if (peer.screenAudioTransceiver.sender.track !== screenAudioTrack) {
      try {
        await peer.screenAudioTransceiver.sender.replaceTrack(screenAudioTrack);
      } catch {}
    }
  }, []);

  // Sync tracks to all active peers
  const syncTracksToAllPeers = useCallback(async () => {
    for (const targetUserId of peersRef.current.keys()) {
      await syncTracksToPeer(targetUserId);
    }
  }, [syncTracksToPeer]);

  // Publish the exact microphone track used by the P2P mesh to LiveKit as well.
  // This prevents the SFU SDK from capturing a second, unprocessed microphone.
  const publishMicrophoneToLiveKit = useCallback(async (track: MediaStreamTrack) => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;

    const existing = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (existing?.track?.mediaStreamTrack === track) {
      if (isEffectivelyMutedRef.current) {
        await existing.mute();
      } else {
        await existing.unmute();
      }
      return;
    }

    if (existing?.track) {
      await room.localParticipant.unpublishTrack(existing.track, false);
    }

    const publication = await room.localParticipant.publishTrack(track, {
      source: Track.Source.Microphone,
      name: 'microphone-speech-enhanced',
    });
    if (isEffectivelyMutedRef.current) {
      await publication.mute();
    }
  }, []);

  // 4. WebRTC P2P Signaling & Perfect Negotiation Mesh Engine
  useEffect(() => {
    if (!activeVoiceChannel || !currentUser) {
      setNoiseSuppressionStatus(isNoiseSuppressionEnabled ? 'idle' : 'disabled');
      return;
    }

    const channelId = activeVoiceChannel.id;
    const myId = currentUser.id;

    // Capture Local Microphone Audio Stream
    let isCancelled = false;
    const suppressionAbortController = new AbortController();
    let vadAudioContext: AudioContext | null = null;
    let rawMicrophoneStream: MediaStream | null = null;
    let noiseSuppressionPipeline: AINoiseSuppressionPipeline | null = null;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      // Avoid stacking the browser denoiser with DTLN. The native algorithm is
      // retained as the fallback when AI suppression is disabled.
      noiseSuppression: !isNoiseSuppressionEnabled,
      autoGainControl: true,
      channelCount: 1,
    };

    if (selectedInputDeviceId && selectedInputDeviceId !== 'default') {
      audioConstraints.deviceId = { exact: selectedInputDeviceId };
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: audioConstraints,
        video: false,
      })
      .then(async (stream) => {
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        rawMicrophoneStream = stream;

        const activateMicrophoneStream = async (nextStream: MediaStream) => {
          const track = nextStream.getAudioTracks()[0];
          if (!track || isCancelled || suppressionAbortController.signal.aborted) return;
          track.enabled = !isEffectivelyMutedRef.current;
          localStreamsRef.current.mic = nextStream;
          await syncTracksToAllPeers();
          await publishMicrophoneToLiveKit(track).catch((error) => {
            console.warn('[LiveKit] Failed to replace microphone track:', error);
          });
        };

        const transition = await startNoiseSuppressionTransition({
          inputStream: stream,
          enabled: isNoiseSuppressionEnabled,
          signal: suppressionAbortController.signal,
          activateStream: activateMicrophoneStream,
          setStatus: setNoiseSuppressionStatus,
          onError: (error) => {
            console.warn('[DTLN] AI noise suppression failed, using browser fallback:', error);
          },
        });
        if (!transition || isCancelled) return;

        noiseSuppressionPipeline = transition.pipeline;
        const analysisStream = transition.analysisStream;

        // Setup local audio analyzer for speaking detection (VAD)
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            vadAudioContext = new AudioCtx();
            if (vadAudioContext.state === 'suspended') {
              vadAudioContext.resume().catch(() => {});
            }
            const analyser = vadAudioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = vadAudioContext.createMediaStreamSource(analysisStream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let lastSpeaking = false;

            const checkAudioLevel = () => {
              if (isCancelled) return;
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length / 255;
              const threshold = vadThreshold || 0.015;
              const isSpeakingNow = avg > threshold && !isEffectivelyMutedRef.current;

              if (isSpeakingNow !== lastSpeaking) {
                lastSpeaking = isSpeakingNow;
                useMediaStore.getState().setVadLevel(isEffectivelyMutedRef.current ? 0 : avg, isSpeakingNow);
                if (currentUser) {
                  useMediaStore.getState().upsertParticipant({
                    identity: currentUser.id,
                    isSpeaking: isSpeakingNow,
                  });
                }
              }

              requestAnimationFrame(checkAudioLevel);
            };

            requestAnimationFrame(checkAudioLevel);
          }
        } catch (e) {
          console.warn('[WebRTC] Local AudioContext VAD error:', e);
        }
      })
      .catch((err) => {
        console.warn('[WebRTC] Microphone access notice:', err);
      });

    function getOrCreatePeer(targetUserId: string, targetUsername?: string): PeerState {
      let peer = peersRef.current.get(targetUserId);
      if (peer && peer.pc.signalingState !== 'closed') {
        return peer;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Deterministic transceivers upfront:
      // index 0: audio (mic)
      // index 1: video (camera)
      // index 2: video (screen)
      // index 3: audio (screen)
      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const cameraTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      const screenTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      const screenAudioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

      const peerState: PeerState = {
        pc,
        isMakingOffer: false,
        isIgnoringOffer: false,
        iceCandidatesQueue: [],
        audioTransceiver,
        cameraTransceiver,
        screenTransceiver,
        screenAudioTransceiver,
      };
      peersRef.current.set(targetUserId, peerState);

      // Deterministic politeness based on lexical ID comparison
      const isPolite = myId.localeCompare(targetUserId) < 0;

      // Assign initial local tracks if already captured
      const micTrack = !isEffectivelyMutedRef.current ? (localStreamsRef.current.mic?.getAudioTracks()[0] || null) : null;
      if (micTrack) {
        audioTransceiver.sender.replaceTrack(micTrack).catch(() => {});
      }
      const cameraTrack = localStreamsRef.current.camera?.getVideoTracks()[0] || null;
      if (cameraTrack) {
        cameraTransceiver.sender.replaceTrack(cameraTrack).catch(() => {});
      }
      const screenTrack = localStreamsRef.current.screen?.getVideoTracks()[0] || null;
      if (screenTrack) {
        screenTransceiver.sender.replaceTrack(screenTrack).catch(() => {});
      }
      const screenAudioTrack = localStreamsRef.current.screen?.getAudioTracks()[0] || null;
      if (screenAudioTrack) {
        screenAudioTransceiver.sender.replaceTrack(screenAudioTrack).catch(() => {});
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebRTCSignal(channelId, targetUserId, {
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Perfect Negotiation: onnegotiationneeded
      pc.onnegotiationneeded = async () => {
        try {
          peerState.isMakingOffer = true;
          await pc.setLocalDescription();
          if (pc.localDescription) {
            sendWebRTCSignal(channelId, targetUserId, {
              type: 'offer',
              sdp: pc.localDescription,
            });
          }
        } catch (err) {
          console.warn('[WebRTC] Negotiation error:', err);
        } finally {
          peerState.isMakingOffer = false;
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        track.enabled = true;
        const stream = event.streams[0] || new MediaStream([track]);

        if (track.kind === 'audio') {
          const audioSource: RemoteAudioSource = event.transceiver === screenAudioTransceiver
            ? 'screen'
            : 'voice';
          const audio = attachRemoteAudio(targetUserId, audioSource, stream);
          track.onunmute = () => {
            audio.play().catch(() => undefined);
          };

          // Remote VAD speaking detection for real-time visual feedback
          if (audioSource === 'voice') try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const remoteCtx = new AudioCtx();
              if (remoteCtx.state === 'suspended') {
                remoteCtx.resume().catch(() => {});
              }
              const remoteAnalyser = remoteCtx.createAnalyser();
              remoteAnalyser.fftSize = 256;
              const source = remoteCtx.createMediaStreamSource(stream);
              source.connect(remoteAnalyser);
              const dataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
              let lastSpeaking = false;

              const checkRemoteSpeaking = () => {
                if (peerState.pc.signalingState === 'closed') {
                  remoteCtx.close().catch(() => {});
                  return;
                }
                const activeVoice = useMediaStore.getState().activeVoiceChannel;
                if (!activeVoice) {
                  remoteCtx.close().catch(() => {});
                  return;
                }
                const members = useMediaStore.getState().voiceChannelMembers[activeVoice.id] || [];
                if (!members.some((m) => m.user_id === targetUserId)) {
                  remoteCtx.close().catch(() => {});
                  return;
                }
                remoteAnalyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length / 255;
                const isSpeaking = avg > 0.03;
                if (isSpeaking !== lastSpeaking) {
                  lastSpeaking = isSpeaking;
                  useMediaStore.getState().upsertParticipant({
                    identity: targetUserId,
                    isSpeaking,
                    audioLevel: avg,
                  });
                }
                requestAnimationFrame(checkRemoteSpeaking);
              };
              requestAnimationFrame(checkRemoteSpeaking);
            }
          } catch (e) {
            console.warn('[WebRTC] Remote VAD error:', e);
          }

          return;
        }

        // Determine if this is camera or screen transceiver
        const allTransceivers = pc.getTransceivers();
        const currentParticipant = useMediaStore.getState().participants[targetUserId];
        const channelMembers = voiceChannelMembers[channelId] || [];
        const memberInfo = channelMembers.find((m) => m.user_id === targetUserId);

        const isExplicitScreenTransceiver =
          event.transceiver === peerState.screenTransceiver ||
          allTransceivers.indexOf(event.transceiver) === 2;

        const isScreen =
          isExplicitScreenTransceiver ||
          Boolean(memberInfo?.is_screen_sharing && !memberInfo?.is_camera_on) ||
          Boolean(currentParticipant?.isScreenSharing && !currentParticipant?.isCameraOn);

        const effectiveName =
          targetUsername && targetUsername !== 'Anonymous'
            ? targetUsername
            : currentParticipant?.name && currentParticipant.name !== 'Anonymous'
            ? currentParticipant.name
            : memberInfo?.username ||
              `User ${targetUserId.slice(0, 4)}`;

        const effectiveIsScreenSharing = Boolean(memberInfo?.is_screen_sharing ?? currentParticipant?.isScreenSharing ?? false);
        const effectiveIsCameraOn = Boolean(memberInfo?.is_camera_on ?? currentParticipant?.isCameraOn ?? false);

        if (isScreen) {
          upsertParticipant({
            identity: targetUserId,
            name: effectiveName,
            isScreenSharing: effectiveIsScreenSharing,
            isCameraOn: effectiveIsCameraOn,
            screenTrack: track,
            mediaStream: stream,
          });

          track.onended = () => {
            upsertParticipant({
              identity: targetUserId,
              name: effectiveName,
              isScreenSharing: false,
              screenTrack: undefined,
            });
          };

          track.onunmute = () => {
            const latestMember = (voiceChannelMembers[channelId] || []).find((m) => m.user_id === targetUserId);
            upsertParticipant({
              identity: targetUserId,
              name: effectiveName,
              isScreenSharing: Boolean(latestMember?.is_screen_sharing),
              screenTrack: track,
            });
          };
        } else {
          // Camera track
          upsertParticipant({
            identity: targetUserId,
            name: effectiveName,
            isCameraOn: effectiveIsCameraOn,
            isScreenSharing: effectiveIsScreenSharing,
            cameraTrack: track,
            mediaStream: stream,
          });

          track.onended = () => {
            upsertParticipant({
              identity: targetUserId,
              name: effectiveName,
              isCameraOn: false,
              cameraTrack: undefined,
            });
          };

          track.onunmute = () => {
            const latestMember = (voiceChannelMembers[channelId] || []).find((m) => m.user_id === targetUserId);
            upsertParticipant({
              identity: targetUserId,
              name: effectiveName,
              isCameraOn: Boolean(latestMember?.is_camera_on),
              cameraTrack: track,
            });
          };
        }
      };

      return peerState;
    }

    // Subscribe to WebSocket WebRTC & Voice Events
    const unsubscribe = subscribeToWebSocketEvents(async (msg: WSMessage) => {
      if (msg.type === 'voice_snapshot') {
        const payload = msg.payload;
        if (Array.isArray(payload)) {
          payload.forEach((u: any) => {
            if (u.channel_id === channelId && u.user_id !== myId) {
              getOrCreatePeer(u.user_id, u.username);
            }
          });
        }
      } else if (msg.type === 'user_joined_voice') {
        const payload = msg.payload;
        if (payload && payload.channel_id === channelId && payload.user_id !== myId) {
          const existingPeer = peersRef.current.get(payload.user_id);
          if (existingPeer) {
            existingPeer.pc.close();
            peersRef.current.delete(payload.user_id);
          }
          removeRemoteAudioOutputs(payload.user_id);

          // Initialize fresh peer state
          getOrCreatePeer(payload.user_id, payload.username);
        }
      } else if (msg.type === 'user_left_voice') {
        const payload = msg.payload;
        if (payload && payload.user_id) {
          const peer = peersRef.current.get(payload.user_id);
          if (peer) {
            peer.pc.close();
            peersRef.current.delete(payload.user_id);
          }
          removeRemoteAudioOutputs(payload.user_id);
          removeParticipant(payload.user_id);
        }
      } else if (msg.type === 'webrtc_signal') {
        const payload = msg.payload;
        if (!payload || payload.channel_id !== channelId) return;

        const senderId = payload.sender_id;
        const senderUsername = payload.sender_username;
        const signal = payload.signal;

        if (!signal || !senderId || senderId === myId) return;

        const peer = getOrCreatePeer(senderId, senderUsername);
        const pc = peer.pc;
        const isPolite = myId.localeCompare(senderId) < 0;

        if (signal.type === 'offer') {
          try {
            const offerCollision = peer.isMakingOffer || pc.signalingState !== 'stable';
            peer.isIgnoringOffer = !isPolite && offerCollision;

            if (peer.isIgnoringOffer) {
              return;
            }

            if (offerCollision && isPolite) {
              await pc.setLocalDescription({ type: 'rollback' } as any);
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            // Flush queued ICE candidates
            while (peer.iceCandidatesQueue.length > 0) {
              const candidate = peer.iceCandidatesQueue.shift()!;
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch {}
            }

            await pc.setLocalDescription();
            if (pc.localDescription) {
              sendWebRTCSignal(channelId, senderId, {
                type: 'answer',
                sdp: pc.localDescription,
              });
            }
          } catch (err) {
            console.warn('[WebRTC] Error handling offer:', err);
          }
        } else if (signal.type === 'answer') {
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              peer.isIgnoringOffer = false; // Reset ignore state on answer so ICE candidates are never dropped!

              // Flush queued ICE candidates
              while (peer.iceCandidatesQueue.length > 0) {
                const candidate = peer.iceCandidatesQueue.shift()!;
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch {}
              }
            }
          } catch (err) {
            console.warn('[WebRTC] Error handling answer:', err);
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          try {
            if (pc.remoteDescription && pc.remoteDescription.type && pc.signalingState !== 'closed') {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              peer.iceCandidatesQueue.push(signal.candidate);
            }
          } catch (err) {
            if (!peer.isIgnoringOffer) {
              peer.iceCandidatesQueue.push(signal.candidate);
            }
          }
        }
      }
    });

    // Initialize peer states for all existing members
    const existingMembers = voiceChannelMembers[channelId] || [];
    existingMembers.forEach((m) => {
      if (m.user_id !== myId) {
        getOrCreatePeer(m.user_id, m.username);
      }
    });

    return () => {
      isCancelled = true;
      suppressionAbortController.abort();
      if (vadAudioContext) {
        vadAudioContext.close().catch(() => {});
      }
      unsubscribe();
      noiseSuppressionPipeline?.dispose().catch(() => undefined);
      rawMicrophoneStream?.getTracks().forEach((t) => t.stop());
      localStreamsRef.current.mic = null;
      peersRef.current.forEach((peer) => peer.pc.close());
      peersRef.current.clear();
      remoteAudiosRef.current.forEach(({ element }) => {
        element.pause();
        element.srcObject = null;
        element.remove();
      });
      remoteAudiosRef.current.clear();
    };
  }, [activeVoiceChannel?.id, currentUser?.id, selectedInputDeviceId, selectedOutputDeviceId, vadThreshold, outputVolume, isNoiseSuppressionEnabled, syncTracksToAllPeers, publishMicrophoneToLiveKit, setNoiseSuppressionStatus]);

  // 5. Connect to LiveKit Room if token and URL are available
  useEffect(() => {
    if (!activeVoiceChannel || !rtcToken || !rtcUrl) {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720 },
      },
      publishDefaults: {
        simulcast: true,
        videoEncoding: {
          maxBitrate: 1_200_000,
          maxFramerate: 30,
        },
        screenShareEncoding: {
          maxBitrate: 2_500_000,
          maxFramerate: 30,
        },
      },
    });

    roomRef.current = room;

    const syncParticipants = () => {
      room.remoteParticipants.forEach((p) => {
        const hasCamera = Array.from(p.trackPublications.values()).some(
          (t) => t.kind === Track.Kind.Video && t.source === Track.Source.Camera && !t.isMuted
        );
        const hasScreen = Array.from(p.trackPublications.values()).some(
          (t) => t.kind === Track.Kind.Video && t.source === Track.Source.ScreenShare && !t.isMuted
        );

        upsertParticipant({
          identity: p.identity,
          name: p.name || p.identity,
          isSpeaking: p.isSpeaking,
          isMuted: !p.isMicrophoneEnabled,
          isDeafened: false,
          isCameraOn: hasCamera,
          isScreenSharing: hasScreen,
          audioLevel: p.audioLevel,
        });
      });
    };

    room.on(RoomEvent.Connected, syncParticipants);

    room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
      upsertParticipant({
        identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: false,
        isMuted: !p.isMicrophoneEnabled,
        isDeafened: false,
        isCameraOn: false,
        isScreenSharing: false,
        audioLevel: 0,
      });
    });

    room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      removeRemoteAudioOutputs(p.identity);
      removeParticipant(p.identity);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const speakerIds = new Set(speakers.map((s) => s.identity));
      room.remoteParticipants.forEach((p) => {
        upsertParticipant({
          identity: p.identity,
          isSpeaking: speakerIds.has(p.identity),
          audioLevel: p.audioLevel,
        });
      });
    });

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const source: RemoteAudioSource = pub.source === Track.Source.ScreenShareAudio
            ? 'screen'
            : 'voice';
          attachRemoteAudio(p.identity, source, new MediaStream([track.mediaStreamTrack]));
        } else if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.Camera) {
            upsertParticipant({ identity: p.identity, isCameraOn: true, cameraTrack: track.mediaStreamTrack });
          } else if (pub.source === Track.Source.ScreenShare) {
            upsertParticipant({ identity: p.identity, isScreenSharing: true, screenTrack: track.mediaStreamTrack });
          }
        }
      }
    );

    room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const source: RemoteAudioSource = pub.source === Track.Source.ScreenShareAudio
            ? 'screen'
            : 'voice';
          removeRemoteAudioOutputs(p.identity, source);
        } else if (pub.source === Track.Source.Camera) {
          upsertParticipant({ identity: p.identity, isCameraOn: false, cameraTrack: undefined });
        } else if (pub.source === Track.Source.ScreenShare) {
          upsertParticipant({ identity: p.identity, isScreenSharing: false, screenTrack: undefined });
        }
      }
    );

    let connectUrl = rtcUrl;
    if (connectUrl.startsWith('/')) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      connectUrl = `${proto}//${window.location.host}${connectUrl}`;
    }

    room
      .connect(connectUrl, rtcToken)
      .then(() => {
        console.log('[LiveKit] Conectado ao SFU:', connectUrl);
      })
      .catch((err) => {
        console.warn('[LiveKit] SFU notice (running via local P2P mesh):', err);
      });

    return () => {
      room.disconnect();
      roomRef.current = null;
    };
  }, [activeVoiceChannel?.id, rtcToken, rtcUrl, publishMicrophoneToLiveKit, attachRemoteAudio, removeRemoteAudioOutputs]);

  // Sync the current microphone track and mute state without reconnecting the room.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;

    const syncMicrophone = () => {
      const microphoneTrack = localStreamsRef.current.mic?.getAudioTracks()[0];
      if (!microphoneTrack) return;
      publishMicrophoneToLiveKit(microphoneTrack).catch((error) => {
        console.warn('[LiveKit] Failed to sync enhanced microphone:', error);
      });
    };

    room.on(RoomEvent.Connected, syncMicrophone);
    if (room.state === 'connected') syncMicrophone();

    return () => {
      room.off(RoomEvent.Connected, syncMicrophone);
    };
  }, [activeVoiceChannel?.id, rtcToken, rtcUrl, isEffectivelyMuted, publishMicrophoneToLiveKit]);

  // 6. Sync Camera (SFU + P2P Mesh + Local Preview)
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function updateCamera() {
      const room = roomRef.current;

      if (isCameraOn) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, frameRate: 30 },
          });
          localStreamsRef.current.camera = stream;
          const videoTrack = stream.getVideoTracks()[0];
          videoTrack.enabled = true;

          if (currentUser) {
            upsertParticipant({
              identity: currentUser.id,
              isCameraOn: true,
              cameraTrack: videoTrack,
              mediaStream: stream,
            });
          }

          await syncTracksToAllPeers();

          if (room && room.state === 'connected') {
            await room.localParticipant.setCameraEnabled(true);
          }
        } catch (err) {
          console.error('[Camera] Error starting camera:', err);
          useMediaStore.setState({ isCameraOn: false });
        }
      } else {
        if (localStreamsRef.current.camera) {
          localStreamsRef.current.camera.getTracks().forEach((t) => t.stop());
          localStreamsRef.current.camera = null;
        }

        await syncTracksToAllPeers();

        if (room && room.state === 'connected') {
          room.localParticipant.setCameraEnabled(false).catch(() => {});
        }
        if (currentUser) {
          upsertParticipant({
            identity: currentUser.id,
            isCameraOn: false,
            cameraTrack: undefined,
            mediaStream: localStreamsRef.current.screen || undefined,
          });
        }
      }
    }

    updateCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCameraOn, currentUser?.id, syncTracksToAllPeers]);

  // 7. Sync Screen Share (1080p/720p @ 30 FPS + SFU + P2P Mesh + Local Preview)
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function updateScreen() {
      const room = roomRef.current;

      if (isScreenSharing) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1920, height: 1080, frameRate: 30 },
            audio: true,
          });
          localStreamsRef.current.screen = stream;
          const screenTrack = stream.getVideoTracks()[0];
          screenTrack.enabled = true;

          screenTrack.onended = () => {
            useMediaStore.setState({ isScreenSharing: false });
          };

          if (currentUser) {
            upsertParticipant({
              identity: currentUser.id,
              isScreenSharing: true,
              screenTrack: screenTrack,
              mediaStream: stream,
            });
          }

          await syncTracksToAllPeers();

          if (room && room.state === 'connected') {
            await room.localParticipant.setScreenShareEnabled(true, {
              audio: true,
              selfBrowserSurface: 'include',
              resolution: VideoPresets.h720.resolution,
            });
          }
        } catch (err) {
          console.error('[ScreenShare] Error starting screen share:', err);
          useMediaStore.setState({ isScreenSharing: false });
        }
      } else {
        if (localStreamsRef.current.screen) {
          localStreamsRef.current.screen.getTracks().forEach((t) => t.stop());
          localStreamsRef.current.screen = null;
        }

        await syncTracksToAllPeers();

        if (room && room.state === 'connected') {
          room.localParticipant.setScreenShareEnabled(false).catch(() => {});
        }
        if (currentUser) {
          upsertParticipant({
            identity: currentUser.id,
            isScreenSharing: false,
            screenTrack: undefined,
            mediaStream: localStreamsRef.current.camera || undefined,
          });
        }
      }
    }

    updateScreen();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isScreenSharing, currentUser?.id, syncTracksToAllPeers]);

  // Dynamic Video Subscription Control
  const setTrackVisible = useCallback((participantIdentity: string, trackSource: Track.Source, isVisible: boolean) => {
    const room = roomRef.current;
    if (!room) return;

    const participant = room.remoteParticipants.get(participantIdentity);
    if (!participant) return;

    const publication = Array.from(participant.trackPublications.values()).find((p) => p.source === trackSource);
    if (publication && publication instanceof RemoteTrackPublication) {
      publication.setSubscribed(isVisible);
    }
  }, []);

  return {
    room: roomRef.current,
    setTrackVisible,
  };
}
