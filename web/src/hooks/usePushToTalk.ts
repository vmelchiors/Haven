import { useEffect } from 'react';
import { useMediaStore } from '../stores/mediaStore';
import { useSettingsStore } from '../stores/settingsStore';

export function usePushToTalk() {
  const isPttEnabled = useSettingsStore((s) => s.isPttEnabled);
  const pttKey = useSettingsStore((s) => s.pttKey);
  const setPushToTalkActive = useMediaStore((s) => s.setPushToTalkActive);

  useEffect(() => {
    if (!isPttEnabled) {
      setPushToTalkActive(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if key matches config
      if (matchesKey(e, pttKey)) {
        if (!e.repeat) {
          setPushToTalkActive(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (matchesKey(e, pttKey)) {
        setPushToTalkActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPttEnabled, pttKey, setPushToTalkActive]);
}

function matchesKey(e: KeyboardEvent, keyBinding: string): boolean {
  const parts = keyBinding.split('+').map((p) => p.trim().toLowerCase());
  const hasCtrl = parts.includes('control') || parts.includes('ctrl');
  const hasAlt = parts.includes('alt');
  const hasShift = parts.includes('shift');

  if (hasCtrl && !e.ctrlKey) return false;
  if (hasAlt && !e.altKey) return false;
  if (hasShift && !e.shiftKey) return false;

  const mainKey = parts[parts.length - 1];
  if (mainKey === 'space' && e.code === 'Space') return true;
  if (e.key.toLowerCase() === mainKey || e.code.toLowerCase() === mainKey) return true;

  return false;
}
