import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ParticipantAudioControls } from '../components/media/ParticipantAudioControls';
import { useMediaStore } from '../stores/mediaStore';

describe('ParticipantAudioControls', () => {
  beforeEach(() => {
    useMediaStore.setState({ remoteAudioPreferences: {} });
  });

  it('controls voice and screen-share audio independently', () => {
    render(<ParticipantAudioControls identity="remote-user" hasScreenAudio />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles locais de áudio' }));

    fireEvent.change(screen.getByRole('slider', { name: 'Volume de voz da pessoa' }), {
      target: { value: '32' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Volume de áudio da transmissão' }), {
      target: { value: '68' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar voz da pessoa' }));

    expect(useMediaStore.getState().remoteAudioPreferences['remote-user']).toEqual({
      voiceVolume: 32,
      voiceMuted: true,
      screenVolume: 68,
      screenMuted: false,
    });
  });
});
