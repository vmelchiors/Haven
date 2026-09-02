import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useMediaStore } from '../stores/mediaStore';
import { useSettingsStore } from '../stores/settingsStore';
import { CallSound, playCallSound } from '../utils/callSounds';

export function useCallFeedback() {
  const activeChannelId = useMediaStore((s) => s.activeVoiceChannel?.id || null);
  const isVoiceConnected = useMediaStore((s) => s.isVoiceConnected);
  const isScreenSharing = useMediaStore((s) => s.isScreenSharing);
  const participantTransitions = useMediaStore((s) => s.participantTransitions);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const soundsEnabled = useSettingsStore((s) => s.callSoundsEnabled);
  const outputVolume = useSettingsStore((s) => s.outputVolume);

  const previousChannel = useRef<string | null>(null);
  const previousScreenShare = useRef(false);
  const announcedTransitions = useRef(new Set<string>());

  const play = (sound: CallSound) => {
    if (soundsEnabled) playCallSound(sound, outputVolume / 100);
  };

  useEffect(() => {
    if (!previousChannel.current && activeChannelId) play('call-join');
    if (previousChannel.current && !activeChannelId) play('call-leave');
    previousChannel.current = activeChannelId;
  }, [activeChannelId, soundsEnabled, outputVolume]);

  useEffect(() => {
    if (!activeChannelId || !isVoiceConnected) {
      previousScreenShare.current = false;
      return;
    }
    if (!previousScreenShare.current && isScreenSharing) play('share-start');
    if (previousScreenShare.current && !isScreenSharing) play('share-stop');
    previousScreenShare.current = isScreenSharing;
  }, [activeChannelId, isVoiceConnected, isScreenSharing, soundsEnabled, outputVolume]);

  useEffect(() => {
    if (!activeChannelId || !isVoiceConnected) {
      announcedTransitions.current.clear();
      return;
    }

    const current = new Set<string>();
    for (const [userId, transition] of Object.entries(participantTransitions)) {
      const transitionKey = `${userId}:${transition}`;
      current.add(transitionKey);
      if (userId !== currentUserId && !announcedTransitions.current.has(transitionKey)) {
        play(transition === 'entering' ? 'participant-join' : 'participant-leave');
      }
    }
    announcedTransitions.current = current;
  }, [activeChannelId, isVoiceConnected, participantTransitions, currentUserId, soundsEnabled, outputVolume]);
}
