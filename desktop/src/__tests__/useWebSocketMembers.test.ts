import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshMembersForEvent } from '../hooks/useWebSocket';
import { useCommunityStore } from '../stores/communityStore';

describe('WebSocket member synchronization', () => {
  const fetchMembers = vi.fn();

  beforeEach(() => {
    fetchMembers.mockReset();
    useCommunityStore.setState({
      selectedCommunity: {
        id: 'c1',
        name: 'Haven',
        owner_id: 'u1',
        status: 'APPROVED',
        donation_amount: 1500,
        created_at: new Date().toISOString(),
      },
      fetchMembers,
    });
  });

  it('does not fetch members for presence updates', () => {
    for (let index = 0; index < 20; index += 1) {
      refreshMembersForEvent({
        type: 'presence_update',
        payload: { user_id: `u${index}`, status: 'online' },
      });
    }

    expect(fetchMembers).not.toHaveBeenCalled();
  });

  it('fetches members only for a membership event from the selected community', () => {
    refreshMembersForEvent({ type: 'community_members_updated', payload: { community_id: 'c2' } });
    expect(fetchMembers).not.toHaveBeenCalled();

    refreshMembersForEvent({ type: 'community_members_updated', payload: { community_id: 'c1' } });
    expect(fetchMembers).toHaveBeenCalledTimes(1);
    expect(fetchMembers).toHaveBeenCalledWith('c1');
  });
});
