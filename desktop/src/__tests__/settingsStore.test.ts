import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../stores/settingsStore';

describe('SettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeModal: null,
      selectedInputDeviceId: 'default',
      selectedOutputDeviceId: 'default',
      inputDevices: [],
      outputDevices: [],
      isPttEnabled: false,
      pttKey: 'Space',
      isPushToTalkActive: false,
      vadThreshold: 0.05,
    });
  });

  it('should open and close modals', () => {
    useSettingsStore.getState().openModal('create_community');
    expect(useSettingsStore.getState().activeModal).toBe('create_community');

    useSettingsStore.getState().closeModal();
    expect(useSettingsStore.getState().activeModal).toBeNull();
  });

  it('should update audio settings and VAD threshold', () => {
    useSettingsStore.getState().setVadThreshold(0.15);
    expect(useSettingsStore.getState().vadThreshold).toBe(0.15);

    useSettingsStore.getState().setPttEnabled(true);
    expect(useSettingsStore.getState().isPttEnabled).toBe(true);

    useSettingsStore.getState().setPttKey('KeyV');
    expect(useSettingsStore.getState().pttKey).toBe('KeyV');
  });

  it('requests microphone permission before listing real peripheral names', async () => {
    const stop = vi.fn();
    const enumerateDevices = vi.mocked(navigator.mediaDevices.enumerateDevices);
    const getUserMedia = vi.mocked(navigator.mediaDevices.getUserMedia);
    enumerateDevices
      .mockResolvedValueOnce([
        { deviceId: 'mic-real', kind: 'audioinput', label: '' } as MediaDeviceInfo,
        { deviceId: 'speaker-real', kind: 'audiooutput', label: '' } as MediaDeviceInfo,
      ])
      .mockResolvedValueOnce([
        { deviceId: 'mic-real', kind: 'audioinput', label: 'Microfone USB' } as MediaDeviceInfo,
        { deviceId: 'speaker-real', kind: 'audiooutput', label: 'Headset USB' } as MediaDeviceInfo,
      ]);
    getUserMedia.mockResolvedValueOnce({ getTracks: () => [{ stop }] } as unknown as MediaStream);

    await useSettingsStore.getState().loadAudioDevices();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(stop).toHaveBeenCalledOnce();
    expect(useSettingsStore.getState().inputDevices.map((device) => device.label))
      .toContain('Microfone USB');
    expect(useSettingsStore.getState().outputDevices.map((device) => device.label))
      .toContain('Headset USB');
  });
});
