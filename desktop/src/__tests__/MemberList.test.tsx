import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberList } from '../components/layout/MemberList';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useCommunityStore } from '../stores/communityStore';

describe('MemberList', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'Alice', is_admin: false, created_at: new Date().toISOString() },
    });
    useChatStore.setState({
      presence: { u1: { user_id: 'u1', username: 'Alice', status: 'online' } },
    });
    useCommunityStore.setState({
      selectedCommunity: {
        id: 'c1',
        name: 'Haven',
        owner_id: 'u1',
        status: 'APPROVED',
        donation_amount: 1500,
        created_at: new Date().toISOString(),
      },
      members: [
        { id: 'u1', username: 'Alice', is_admin: false, created_at: new Date().toISOString() },
        { id: 'u2', username: 'Bob', is_admin: false, created_at: new Date().toISOString() },
      ],
      fetchMembers: vi.fn(),
    });
  });

  it('shows registered users without presence in the offline section', () => {
    render(<MemberList />);

    expect(screen.getByText('Online — 1')).toBeInTheDocument();
    expect(screen.getByText('Offline — 1')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(useCommunityStore.getState().fetchMembers).not.toHaveBeenCalled();
  });
});
