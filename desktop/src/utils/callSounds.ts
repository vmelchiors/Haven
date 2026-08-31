export type CallSound =
  | 'call-join'
  | 'call-leave'
  | 'participant-join'
  | 'participant-leave'
  | 'share-start'
  | 'share-stop';

let audioContext: AudioContext | null = null;

const patterns: Record<CallSound, Array<[number, number]>> = {
  'call-join': [[392, 0.07], [523, 0.09], [659, 0.13]],
  'call-leave': [[523, 0.08], [392, 0.12]],
  'participant-join': [[494, 0.06], [622, 0.09]],
  'participant-leave': [[466, 0.06], [349, 0.09]],
  'share-start': [[440, 0.05], [554, 0.06], [740, 0.11]],
  'share-stop': [[659, 0.06], [494, 0.11]],
};

export function playCallSound(sound: CallSound, volume = 1) {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    audioContext ||= new AudioContextClass();
    if (audioContext.state === 'suspended') void audioContext.resume();

    const master = audioContext.createGain();
    const safeVolume = Math.max(0, Math.min(1, volume));
    master.gain.setValueAtTime(0.0001, audioContext.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, safeVolume * 0.15), audioContext.currentTime + 0.015);
    master.connect(audioContext.destination);

    let cursor = audioContext.currentTime;
    for (const [frequency, duration] of patterns[sound]) {
      const oscillator = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, cursor);
      noteGain.gain.setValueAtTime(0.0001, cursor);
      noteGain.gain.exponentialRampToValueAtTime(1, cursor + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
      oscillator.connect(noteGain);
      noteGain.connect(master);
      oscillator.start(cursor);
      oscillator.stop(cursor + duration + 0.015);
      cursor += duration;
    }

    master.gain.exponentialRampToValueAtTime(0.0001, cursor + 0.03);
    window.setTimeout(() => master.disconnect(), Math.ceil((cursor - audioContext!.currentTime + 0.1) * 1000));
  } catch {
    // Browsers may block audio until the first explicit user interaction.
  }
}
