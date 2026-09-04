import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { VideoTile } from '../components/media/VideoTile';
import { useAuthStore } from '../stores/authStore';
import type { VoiceParticipant } from '../types';

describe('VideoTile participant state', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'me', username: 'Meu Perfil', avatar_url: '', is_admin: false, created_at: '' },
      isAuthenticated: true,
    });
  });

  it('shows mute and deafen independently and keeps the avatar circular', () => {
    const participant: VoiceParticipant = {
      identity: 'me',
      name: 'Meu Perfil',
      isSpeaking: false,
      isMuted: true,
      isDeafened: true,
      isCameraOn: false,
      isScreenSharing: false,
      audioLevel: 0,
    };

    const { container } = render(<VideoTile participant={participant} />);

    expect(screen.getByTitle('Microfone desativado')).toBeDefined();
    expect(screen.getByTitle('Ensurdecido')).toBeDefined();
    expect(container.querySelector('.w-20.h-20')?.classList.contains('rounded-full')).toBe(true);
  });
});
