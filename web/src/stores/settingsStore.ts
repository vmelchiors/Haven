import { create } from 'zustand';
import { AudioDevice, ChannelType } from '../types';

export type ModalType = 'home' | 'donate' | 'tos' | 'create_community' | 'edit_community' | 'join_community' | 'create_channel' | 'admin_moderation' | 'feedback' | 'settings' | 'download' | null;

interface SettingsState {
  activeModal: ModalType;
  createChannelType: ChannelType;
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  selectedInputId: string;
  selectedInputDeviceId: string;
  selectedOutputId: string;
  selectedOutputDeviceId: string;
  inputVolume: number;
  outputVolume: number;
  vadThreshold: number;
  pttKey: string;
  isPttEnabled: boolean;
  isPushToTalkActive: boolean;

  openModal: (modal: ModalType, channelType?: ChannelType) => void;
  closeModal: () => void;
  setInputDevice: (id: string) => void;
  setOutputDevice: (id: string) => void;
  setInputVolume: (vol: number) => void;
  setOutputVolume: (vol: number) => void;
  setVadThreshold: (threshold: number) => void;
  setPttKey: (key: string) => void;
  setPttEnabled: (enabled: boolean) => void;
  setPushToTalkActive: (active: boolean) => void;
  loadAudioDevices: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeModal: null,
  createChannelType: 'TEXT',
  inputDevices: [],
  outputDevices: [],
  selectedInputId: 'default',
  selectedInputDeviceId: 'default',
  selectedOutputId: 'default',
  selectedOutputDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  vadThreshold: 0.015,
  pttKey: 'Control+Space',
  isPttEnabled: false,
  isPushToTalkActive: false,

  openModal: (modal, channelType = 'TEXT') => set({ activeModal: modal, createChannelType: channelType }),
  closeModal: () => set({ activeModal: null }),

  setInputDevice: (id) => set({ selectedInputId: id, selectedInputDeviceId: id }),
  setOutputDevice: (id) => set({ selectedOutputId: id, selectedOutputDeviceId: id }),
  setInputVolume: (vol) => set({ inputVolume: vol }),
  setOutputVolume: (vol) => set({ outputVolume: vol }),
  setVadThreshold: (threshold) => set({ vadThreshold: threshold }),
  setPttKey: (key) => set({ pttKey: key }),
  setPttEnabled: (enabled) => set({ isPttEnabled: enabled }),
  setPushToTalkActive: (active) => set({ isPushToTalkActive: active }),

  loadAudioDevices: async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs: AudioDevice[] = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({
            id: d.deviceId || `mic_${i}`,
            deviceId: d.deviceId || `mic_${i}`,
            name: d.label || `Microfone ${i + 1}`,
            label: d.label || `Microfone ${i + 1}`,
            is_default: i === 0,
          }));

        const outputs: AudioDevice[] = devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d, i) => ({
            id: d.deviceId || `speaker_${i}`,
            deviceId: d.deviceId || `speaker_${i}`,
            name: d.label || `Alto-falante ${i + 1}`,
            label: d.label || `Alto-falante ${i + 1}`,
            is_default: i === 0,
          }));

        set({ inputDevices: inputs, outputDevices: outputs });
      }
    } catch (err) {
      // Ignored if permissions not granted yet
    }
  },
}));
