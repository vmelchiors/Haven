import { describe, expect, it } from 'vitest';
import { isRemoteScreenSharePublished, requestScreenShare } from '../hooks/useLiveKit';
import { mediaServerUrl } from '../lib/runtimeConfig';

describe('LiveKit screen-share discovery', () => {
  it('announces a published screen share before its media track is subscribed', () => {
    expect(isRemoteScreenSharePublished({ isMuted: false })).toBe(true);
    expect(isRemoteScreenSharePublished({ isMuted: true })).toBe(false);
    expect(isRemoteScreenSharePublished(undefined)).toBe(false);
  });
});

describe('LiveKit server URL', () => {
  it('resolves the production reverse-proxy path against the public API domain', () => {
    expect(mediaServerUrl('/', 'https://haven.vmelchior.tech'))
      .toBe('wss://haven.vmelchior.tech/');
  });

  it('keeps an absolute secure websocket URL unchanged', () => {
    expect(mediaServerUrl('wss://media.example.test/livekit', 'https://haven.vmelchior.tech'))
      .toBe('wss://media.example.test/livekit');
  });
});

describe('screen-share request gesture', () => {
  it('dispatches the request synchronously from the control click', () => {
    let requested: boolean | undefined;
    const listener = (event: Event) => {
      requested = (event as CustomEvent<boolean>).detail;
    };
    window.addEventListener('haven:screen-share-request', listener);
    requestScreenShare(true);
    window.removeEventListener('haven:screen-share-request', listener);
    expect(requested).toBe(true);
  });
});
