import { describe, expect, it } from 'vitest';
import { isRemoteScreenSharePublished } from '../hooks/useLiveKit';

describe('LiveKit screen-share discovery', () => {
  it('announces a published screen share before its media track is subscribed', () => {
    expect(isRemoteScreenSharePublished({ isMuted: false })).toBe(true);
    expect(isRemoteScreenSharePublished({ isMuted: true })).toBe(false);
    expect(isRemoteScreenSharePublished(undefined)).toBe(false);
  });
});
