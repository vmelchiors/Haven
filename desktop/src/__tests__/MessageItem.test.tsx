import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MessageItem } from '../components/chat/MessageItem';
import { useAuthStore } from '../stores/authStore';
import { Message } from '../types';

describe('MessageItem Component', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'my_user_id', username: 'flame', avatar_url: '', is_admin: false, created_at: '' },
      tokens: { access_token: 'jwt_token', refresh_token: 'ref', expires_in: 900 },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('renders messages from current user on the right side', () => {
    const ownMessage: Message = {
      id: 'm1',
      channel_id: 'ch1',
      user_id: 'my_user_id',
      username: 'flame',
      content: 'Minha mensagem enviada',
      created_at: new Date().toISOString(),
    };

    const { container } = render(<MessageItem message={ownMessage} />);

    expect(screen.getByText('Minha mensagem enviada')).toBeDefined();
    // Container should have justify-end for right-alignment
    expect(container.querySelector('.justify-end')).not.toBeNull();
  });

  it('renders messages from other users on the left side', () => {
    const otherMessage: Message = {
      id: 'm2',
      channel_id: 'ch1',
      user_id: 'other_user_id',
      username: 'test',
      content: 'Mensagem de outro usuario',
      created_at: new Date().toISOString(),
    };

    const { container } = render(<MessageItem message={otherMessage} />);

    expect(screen.getByText('Mensagem de outro usuario')).toBeDefined();
    // Container should not have justify-end
    expect(container.querySelector('.justify-end')).toBeNull();
  });
});
