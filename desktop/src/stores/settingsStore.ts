import { create } from 'zustand';
import { AudioDevice, ChannelType } from '../types';

export type AudioDeviceStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';

const storedDeviceId = (key: string) => {
  if (typeof localStorage === 'undefined') return 'default';
  return localStorage.getItem(key) || 'default';
};

const mapAudioDevices = (
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  defaultLabel: string,
): AudioDevice[] => {
  const matching = devices.filter((device) => device.kind === kind);
  const browserDefault = matching.find((device) => device.deviceId === 'default');
  const namedDevices = matching.filter((device) => device.deviceId && device.deviceId !== 'default');

  return [
    {
      id: 'default',
      deviceId: 'default',
      name: browserDefault?.label || defaultLabel,
      label: browserDefault?.label || defaultLabel,
      is_default: true,
    },
    ...namedDevices.map((device, index) => ({
      id: device.deviceId,
      deviceId: device.deviceId,
      name: device.label || `${kind === 'audioinput' ? 'Microfone' : 'Saída de áudio'} ${index + 1}`,
      label: device.label || `${kind === 'audioinput' ? 'Microfone' : 'Saída de áudio'} ${index + 1}`,
      is_default: false,
    })),
  ];
};

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
  callSoundsEnabled: boolean;
  audioDeviceStatus: AudioDeviceStatus;
  audioDeviceError: string | null;

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
  setCallSoundsEnabled: (enabled: boolean) => void;
  loadAudioDevices: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeModal: null,
  createChannelType: 'TEXT',
  inputDevices: [],
  outputDevices: [],
  selectedInputId: storedDeviceId('haven_audio_input'),
  selectedInputDeviceId: storedDeviceId('haven_audio_input'),
  selectedOutputId: storedDeviceId('haven_audio_output'),
  selectedOutputDeviceId: storedDeviceId('haven_audio_output'),
  inputVolume: 100,
  outputVolume: 100,
  vadThreshold: 0.015,
  pttKey: 'Control+Space',
  isPttEnabled: false,
  isPushToTalkActive: false,
  callSoundsEnabled: typeof localStorage === 'undefined' ? true : localStorage.getItem('haven_call_sounds') !== 'false',
  audioDeviceStatus: 'idle',
  audioDeviceError: null,

  openModal: (modal, channelType = 'TEXT') => set({ activeModal: modal, createChannelType: channelType }),
  closeModal: () => set({ activeModal: null }),

  setInputDevice: (id) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('haven_audio_input', id);
    set({ selectedInputId: id, selectedInputDeviceId: id });
  },
  setOutputDevice: (id) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('haven_audio_output', id);
    set({ selectedOutputId: id, selectedOutputDeviceId: id });
  },
  setInputVolume: (vol) => set({ inputVolume: vol }),
  setOutputVolume: (vol) => set({ outputVolume: vol }),
  setVadThreshold: (threshold) => set({ vadThreshold: threshold }),
  setPttKey: (key) => set({ pttKey: key }),
  setPttEnabled: (enabled) => set({ isPttEnabled: enabled }),
  setPushToTalkActive: (active) => set({ isPushToTalkActive: active }),
  setCallSoundsEnabled: (enabled) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('haven_call_sounds', String(enabled));
    set({ callSoundsEnabled: enabled });
  },

  loadAudioDevices: async () => {
    set({ audioDeviceStatus: 'loading', audioDeviceError: null });
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        set({
          audioDeviceStatus: 'unavailable',
          audioDeviceError: 'Este ambiente não oferece acesso aos dispositivos de áudio.',
        });
        return;
      }

      let devices = await navigator.mediaDevices.enumerateDevices();
      const hasVisibleInputName = devices.some((device) => device.kind === 'audioinput' && Boolean(device.label));

      // Chromium/WebView2 intentionally hides peripheral names until the app has
      // obtained microphone permission at least once.
      if (!hasVisibleInputName && navigator.mediaDevices.getUserMedia) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        permissionStream.getTracks().forEach((track) => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      }

      const inputs = mapAudioDevices(devices, 'audioinput', 'Microfone padrão do Windows');
      const outputs = mapAudioDevices(devices, 'audiooutput', 'Saída padrão do Windows');
      const state = useSettingsStore.getState();
      const selectedInput = inputs.some((device) => device.deviceId === state.selectedInputDeviceId)
        ? state.selectedInputDeviceId
        : 'default';
      const selectedOutput = outputs.some((device) => device.deviceId === state.selectedOutputDeviceId)
        ? state.selectedOutputDeviceId
        : 'default';

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('haven_audio_input', selectedInput);
        localStorage.setItem('haven_audio_output', selectedOutput);
      }
      set({
        inputDevices: inputs,
        outputDevices: outputs,
        selectedInputId: selectedInput,
        selectedInputDeviceId: selectedInput,
        selectedOutputId: selectedOutput,
        selectedOutputDeviceId: selectedOutput,
        audioDeviceStatus: 'ready',
        audioDeviceError: null,
      });
    } catch (err) {
      const permissionDenied = err instanceof DOMException
        && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      set({
        inputDevices: mapAudioDevices([], 'audioinput', 'Microfone padrão do Windows'),
        outputDevices: mapAudioDevices([], 'audiooutput', 'Saída padrão do Windows'),
        selectedInputId: 'default',
        selectedInputDeviceId: 'default',
        selectedOutputId: 'default',
        selectedOutputDeviceId: 'default',
        audioDeviceStatus: permissionDenied ? 'denied' : 'unavailable',
        audioDeviceError: permissionDenied
          ? 'Acesso ao microfone negado. Permita o acesso ao Haven e tente novamente.'
          : 'Não foi possível consultar os dispositivos de áudio do Windows.',
      });
    }
  },
}));
