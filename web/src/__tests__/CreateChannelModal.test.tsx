import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CreateChannelModal } from '../components/modals/CreateChannelModal';
import { useSettingsStore } from '../stores/settingsStore';
import { useCommunityStore } from '../stores/communityStore';

describe('CreateChannelModal Component', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeModal: 'create_channel',
      createChannelType: 'TEXT',
    });
    useCommunityStore.setState({
      selectedCommunity: {
        id: 'comm_123',
        name: 'Dev Community',
        donation_amount: 1500,
        owner_id: 'user_owner',
        status: 'APPROVED',
        created_at: '2026-01-01T00:00:00Z',
      },
      createChannel: vi.fn().mockResolvedValue({ id: 'ch_1', name: 'geral', type: 'TEXT', position: 0 }),
    });
  });

  it('renders correctly and allows submitting a channel', async () => {
    render(<CreateChannelModal />);

    expect(screen.getAllByText('Criar Canal').length).toBeGreaterThanOrEqual(1);

    const nameInput = screen.getByPlaceholderText('ex: geral');
    fireEvent.change(nameInput, { target: { value: 'geral' } });

    const submitBtn = screen.getByRole('button', { name: /Criar Canal/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(useCommunityStore.getState().createChannel).toHaveBeenCalledWith(
      'comm_123',
      'geral',
      'TEXT'
    );
  });
});
