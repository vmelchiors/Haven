import { describe, it, expect, beforeEach } from 'vitest';
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
});
