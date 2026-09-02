import React, { useEffect, useState } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  Keyboard,
  LogOut,
  Radio,
  User,
  Camera,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  MessageSquarePlus,
  Download,
  BellRing,
  Laptop2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AudioMeter } from '../ui/AudioMeter';
import { Avatar } from '../ui/Avatar';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMediaStore } from '../../stores/mediaStore';
import { useAuthStore } from '../../stores/authStore';

type SettingsTab = 'PROFILE' | 'VOICE' | 'FEEDBACK';

export const SettingsModal: React.FC = () => {
  const isOpen = useSettingsStore((s) => s.activeModal === 'settings');
  const closeModal = useSettingsStore((s) => s.closeModal);
  const openModal = useSettingsStore((s) => s.openModal);

  const inputDevices = useSettingsStore((s) => s.inputDevices);
  const outputDevices = useSettingsStore((s) => s.outputDevices);
  const selectedInputDeviceId = useSettingsStore((s) => s.selectedInputDeviceId);
  const selectedOutputDeviceId = useSettingsStore((s) => s.selectedOutputDeviceId);
  const isPttEnabled = useSettingsStore((s) => s.isPttEnabled);
  const pttKey = useSettingsStore((s) => s.pttKey);
  const vadThreshold = useSettingsStore((s) => s.vadThreshold);
  const callSoundsEnabled = useSettingsStore((s) => s.callSoundsEnabled);

  const setInputDevice = useSettingsStore((s) => s.setInputDevice);
  const setOutputDevice = useSettingsStore((s) => s.setOutputDevice);
  const setPttEnabled = useSettingsStore((s) => s.setPttEnabled);
  const setPttKey = useSettingsStore((s) => s.setPttKey);
  const setVadThreshold = useSettingsStore((s) => s.setVadThreshold);
  const setCallSoundsEnabled = useSettingsStore((s) => s.setCallSoundsEnabled);
  const loadAudioDevices = useSettingsStore((s) => s.loadAudioDevices);

  const isNoiseSuppressionEnabled = useMediaStore((s) => s.isNoiseSuppressionEnabled);
  const noiseSuppressionStatus = useMediaStore((s) => s.noiseSuppressionStatus);
  const toggleNoiseSuppression = useMediaStore((s) => s.toggleNoiseSuppression);
  const vadLevel = useMediaStore((s) => s.vadLevel);
  const isCompanionModeEnabled = useMediaStore((s) => s.isCompanionModeEnabled);
  const toggleCompanionMode = useMediaStore((s) => s.toggleCompanionMode);
  const effectiveNoiseSuppressionStatus = noiseSuppressionStatus
    ?? (isNoiseSuppressionEnabled ? 'idle' : 'disabled');

  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);

  const [activeTab, setActiveTab] = useState<SettingsTab>('PROFILE');
  const [isRecordingKey, setIsRecordingKey] = useState(false);

  // Profile Edit State
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAudioDevices();
      if (currentUser) {
        setNewUsername(currentUser.username);
      }
      setProfileSuccess(null);
      setProfileError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    }
  }, [isOpen, currentUser, loadAudioDevices]);

  // Key recording listener for PTT
  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      setPttKey(e.code);
      setIsRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingKey, setPttKey]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setProfileError(null);
    const url = await uploadAvatar(file);
    setAvatarUploading(false);

    if (url) {
      setProfileSuccess('Foto de perfil atualizada com sucesso!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } else {
      setProfileError('Erro ao atualizar foto de perfil');
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || newUsername === currentUser?.username) return;

    setProfileLoading(true);
    setProfileError(null);
    const res = await updateProfile(newUsername.trim());
    setProfileLoading(false);

    if (res.success) {
      setProfileSuccess('Nome de usuário atualizado com sucesso!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } else {
      setProfileError(res.error || 'Erro ao alterar nome de usuário');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setProfileError('Informe a senha atual');
      return;
    }
    if (newPassword.length < 6) {
      setProfileError('A nova senha deve ter no mínimo 6 dígitos');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setProfileError('As novas senhas não coincidem');
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    const res = await updateProfile(undefined, currentPassword, newPassword);
    setProfileLoading(false);

    if (res.success) {
      setProfileSuccess('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setProfileSuccess(null), 3000);
    } else {
      setProfileError(res.error || 'Erro ao alterar senha');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Configurações"
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 py-0.5">
        {/* Top Tab Bar */}
        <div className="flex items-center gap-1 bg-haven-darker p-1 rounded-lg border border-haven-border">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'PROFILE'
                ? 'bg-haven-surface text-white shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil</span>
          </button>

          <button
            onClick={() => setActiveTab('VOICE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'VOICE'
                ? 'bg-haven-surface text-white shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voz & Áudio</span>
          </button>

          <button
            onClick={() => setActiveTab('FEEDBACK')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'FEEDBACK'
                ? 'bg-haven-surface text-white shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => openModal('download')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-white bg-haven-card hover:bg-haven-surface border border-haven-border transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>App Desktop</span>
          </button>
        </div>

        {/* TAB 1: PERFIL & CONTA */}
        {activeTab === 'PROFILE' && (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {profileSuccess && (
              <div className="flex items-center gap-2 text-xs text-haven-emerald bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-800/40">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Avatar & Basic Info */}
            <div className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex items-center gap-3.5">
              <div className="relative group">
                <Avatar
                  src={currentUser?.avatar_url}
                  name={currentUser?.username || 'User'}
                  size="lg"
                  status="online"
                />
                <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-zinc-100">{currentUser?.username}</h4>
                <span className="text-[11px] text-zinc-400">
                  {currentUser?.is_admin ? 'Administrador da Plataforma' : 'Membro Haven'}
                </span>
                <div className="text-[10px] text-zinc-500 mt-0.5">Clique no avatar para atualizar foto</div>
              </div>
            </div>

            {/* Edit Username */}
            <form onSubmit={handleUpdateUsername} className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-zinc-200">Alterar Nome de Usuário</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Novo pseudônimo"
                  className="flex-1 bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                  maxLength={32}
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  isLoading={profileLoading}
                  disabled={!newUsername.trim() || newUsername === currentUser?.username}
                >
                  Salvar
                </Button>
              </div>
            </form>

            {/* Change Password */}
            <form onSubmit={handleChangePassword} className="bg-haven-card border border-haven-border rounded-xl p-3.5 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-haven-accent" />
                Alterar Senha
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Senha atual"
                  className="bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirmar nova senha"
                  className="bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  isLoading={profileLoading}
                  disabled={!currentPassword || !newPassword}
                >
                  Atualizar Senha
                </Button>
              </div>
            </form>

            {/* Logout */}
            <div className="pt-2 flex items-center justify-between border-t border-haven-border">
              <span className="text-xs text-zinc-500">Encerrar sessão neste dispositivo</span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  closeModal();
                  logout();
                }}
                className="gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair da Conta
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: VOZ & ÁUDIO */}
        {activeTab === 'VOICE' && (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Audio Devices in 2-cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-haven-accent" />
                  Microfone
                </label>
                <select
                  value={selectedInputDeviceId}
                  onChange={(e) => setInputDevice(e.target.value)}
                  className="w-full bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                >
                  {inputDevices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-haven-accent" />
                  Saída de Áudio
                </label>
                <select
                  value={selectedOutputDeviceId}
                  onChange={(e) => setOutputDevice(e.target.value)}
                  className="w-full bg-haven-darker border border-haven-border rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-haven-accent"
                >
                  {outputDevices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Input Mode: VAD vs PTT */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">Modo de Entrada</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPttEnabled(false)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                    !isPttEnabled
                      ? 'bg-haven-card border-haven-accent text-white'
                      : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Radio className="w-4 h-4 text-haven-cyan" />
                  <span className="text-xs font-semibold">Detecção de Voz (VAD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPttEnabled(true)}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
                    isPttEnabled
                      ? 'bg-haven-card border-haven-accent text-white'
                      : 'bg-haven-darker border-haven-border text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Keyboard className="w-4 h-4 text-haven-accent" />
                  <span className="text-xs font-semibold">Push-to-Talk (PTT)</span>
                </button>
              </div>

              {/* PTT Key shortcut recorder */}
              {isPttEnabled && (
                <div className="flex items-center justify-between bg-haven-card p-3 rounded-xl border border-haven-border mt-0.5">
                  <span className="text-xs text-zinc-300">Tecla de Ativação</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsRecordingKey(true)}
                    className="font-mono text-xs"
                  >
                    {isRecordingKey ? 'Pressione uma tecla...' : pttKey || 'Gravar Tecla'}
                  </Button>
                </div>
              )}
            </div>

            {/* VAD Sensitivity Slider & Live Level */}
            {!isPttEnabled && (
              <div className="bg-haven-card border border-haven-border rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Sensibilidade do Microfone</span>
                  <span className="text-haven-emerald">{Math.round(vadThreshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={vadThreshold}
                  onChange={(e) => setVadThreshold(parseFloat(e.target.value))}
                  className="w-full accent-haven-accent cursor-pointer"
                />
                <AudioMeter level={vadLevel} threshold={vadThreshold} />
              </div>
            )}

            {/* Noise Suppression Switch */}
            <div className="bg-haven-card border border-haven-border rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-haven-emerald" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-200">Foco de Voz por IA (DTLN)</span>
                  <span className="text-[10px] text-zinc-500">
                    {effectiveNoiseSuppressionStatus === 'active'
                      ? 'Modelo neural ativo no microfone'
                      : effectiveNoiseSuppressionStatus === 'loading'
                      ? 'Carregando modelo neural...'
                      : effectiveNoiseSuppressionStatus === 'fallback'
                      ? 'Fallback nativo do navegador'
                      : isNoiseSuppressionEnabled
                      ? 'Será ativado ao entrar na chamada'
                      : 'Desativado'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleNoiseSuppression}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  isNoiseSuppressionEnabled ? 'bg-haven-emerald' : 'bg-haven-border'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${
                    isNoiseSuppressionEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="bg-haven-card border border-haven-border rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-haven-cyan" />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Sons da chamada</div>
                  <div className="text-[10px] text-zinc-500">Entrada, saída e transmissão</div>
                </div>
              </div>
              <button
                type="button"
                aria-label={callSoundsEnabled ? 'Desativar sons da chamada' : 'Ativar sons da chamada'}
                aria-pressed={callSoundsEnabled}
                onClick={() => setCallSoundsEnabled(!callSoundsEnabled)}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  callSoundsEnabled ? 'bg-haven-cyan' : 'bg-haven-border'
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${
                  callSoundsEnabled ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Nearby companion device: prevents feedback when another laptop handles room audio. */}
            <div className="bg-haven-card border border-haven-border rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Laptop2 className="w-4 h-4 text-haven-cyan" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-200">Dispositivo próximo (sem retorno)</span>
                  <span className="text-[10px] text-zinc-500">
                    {isCompanionModeEnabled
                      ? 'Microfone e alto-falantes desativados neste aparelho'
                      : 'Use nos notebooks secundários que estão na mesma sala'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleCompanionMode}
                className={`w-9 h-5 flex flex-shrink-0 items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  isCompanionModeEnabled ? 'bg-haven-cyan' : 'bg-haven-border'
                }`}
                aria-label="Alternar modo de dispositivo próximo"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow transition-transform ${
                    isCompanionModeEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: FEEDBACK & SUPORTE */}
        {activeTab === 'FEEDBACK' && (
          <div className="bg-haven-card border border-haven-border rounded-xl p-5 flex flex-col items-center text-center gap-3">
            <MessageSquarePlus className="w-8 h-8 text-zinc-400" />
            <div>
              <h4 className="text-xs font-semibold text-zinc-100">Relatar Problema ou Sugestão</h4>
              <p className="text-xs text-zinc-400 mt-0.5">Ajude nossa equipe a aprimorar o Haven</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                closeModal();
                openModal('feedback');
              }}
              className="gap-1.5 text-xs font-semibold mt-1"
            >
              Abrir Formulário de Feedback
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
