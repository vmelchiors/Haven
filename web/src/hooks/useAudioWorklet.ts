import { useEffect } from 'react';
import { useMediaStore } from '../stores/mediaStore';

export function useAudioWorklet() {
  const activeVoiceChannel = useMediaStore((s) => s.activeChannel);
  const setVadLevel = useMediaStore((s) => s.setVadLevel);

  useEffect(() => {
    if (!activeVoiceChannel) {
      setVadLevel(0, false);
    }
  }, [activeVoiceChannel?.id, setVadLevel]);
}
