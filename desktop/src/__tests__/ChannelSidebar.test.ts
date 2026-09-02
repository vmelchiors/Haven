import { describe, expect, it } from 'vitest';
import { resolveVoiceMemberAvatar } from '../components/layout/ChannelSidebar';
import { User } from '../types';

const users: User[] = [
  { id: 'u1', username: 'Alice', avatar_url: '/uploads/alice.png', is_admin: false, created_at: '' },
  { id: 'u2', username: 'Bob', avatar_url: '/uploads/bob.png', is_admin: false, created_at: '' },
];

describe('voice channel avatars', () => {
  it('resolves local and remote avatars from synchronized profile data', () => {
    expect(resolveVoiceMemberAvatar('u1', users[0], users)).toBe('/uploads/alice.png');
    expect(resolveVoiceMemberAvatar('u2', users[0], users)).toBe('/uploads/bob.png');
    expect(resolveVoiceMemberAvatar('missing', users[0], users)).toBeUndefined();
  });
});
