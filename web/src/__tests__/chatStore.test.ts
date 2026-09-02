import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../stores/chatStore';
import { Message } from '../types';

describe('ChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: {},
      typingUsers: {},
      presence: {},
      hasMore: {},
      isLoadingMessages: false,
    });
  });

  it('should add message to channel and deduplicate by ID', () => {
    const msg1: Message = {
      id: 'm1',
      channel_id: 'ch1',
      user_id: 'u1',
      username: 'alice',
      content: 'Hello Haven!',
      created_at: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(msg1);
    expect(useChatStore.getState().messages['ch1']).toHaveLength(1);

    // Duplicate message should not duplicate in array
    useChatStore.getState().addMessage(msg1);
    expect(useChatStore.getState().messages['ch1']).toHaveLength(1);
  });

  it('should handle typing status with debounce', () => {
    useChatStore.getState().setTyping('ch1', 'u1', 'alice', true);
    expect(useChatStore.getState().typingUsers['ch1']?.['u1']).toBe('alice');

    useChatStore.getState().setTyping('ch1', 'u1', 'alice', false);
    expect(useChatStore.getState().typingUsers['ch1']?.['u1']).toBeUndefined();
  });

  it('should track user presence with username', () => {
    useChatStore.getState().setPresence('u1', 'busy', 'Alice');
    expect(useChatStore.getState().presence['u1']).toEqual({
      user_id: 'u1',
      username: 'Alice',
      status: 'busy',
    });

    useChatStore.getState().setPresence('u1', 'offline');
    expect(useChatStore.getState().presence['u1']).toBeUndefined();
  });

  it('should clear stale presence before applying a reconnect snapshot', () => {
    useChatStore.getState().setPresence('u1', 'online', 'Alice');
    useChatStore.getState().setPresence('u2', 'idle', 'Bob');

    useChatStore.getState().clearPresence();

    expect(useChatStore.getState().presence).toEqual({});
  });

  it('should track and clear unread counts appropriately', () => {
    useChatStore.setState({ unreadCounts: {} });

    const msgOtherChannel: Message = {
      id: 'm10',
      channel_id: 'ch_inactive',
      user_id: 'other_user',
      username: 'bob',
      content: 'Hey in other channel',
      created_at: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(msgOtherChannel);
    expect(useChatStore.getState().unreadCounts['ch_inactive']).toBe(1);

    const msgOtherChannel2: Message = {
      id: 'm11',
      channel_id: 'ch_inactive',
      user_id: 'other_user',
      username: 'bob',
      content: 'Second message',
      created_at: new Date().toISOString(),
    };
    useChatStore.getState().addMessage(msgOtherChannel2);
    expect(useChatStore.getState().unreadCounts['ch_inactive']).toBe(2);

    // Marking as read clears the count
    useChatStore.getState().markChannelAsRead('ch_inactive');
    expect(useChatStore.getState().unreadCounts['ch_inactive']).toBeUndefined();
  });

  it('should map channel to community from message.community_id', () => {
    const msg: Message = {
      id: 'm20',
      channel_id: 'ch_other_comm',
      community_id: 'comm_xyz',
      user_id: 'other_user',
      username: 'charlie',
      content: 'Hello from another community',
      created_at: new Date().toISOString(),
    };

    useChatStore.getState().addMessage(msg);
    expect(useChatStore.getState().channelToCommunity['ch_other_comm']).toBe('comm_xyz');
    expect(useChatStore.getState().unreadCounts['ch_other_comm']).toBe(1);
  });
});
