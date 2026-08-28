import React, { useState } from 'react';
import { Camera, UserPlus, LogIn, ShieldAlert, Download, KeyRound, ArrowLeft, CheckCircle2, HelpCircle } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';

const DEFAULT_SECURITY_QUESTIONS = [
  'Qual o nome do seu primeiro animal de estimação?',
  'Qual o nome da sua primeira escola?',
  'Em qual cidade seus pais se conheceram?',
  'Qual o nome do seu melhor amigo de infância?',
  'Qual seu filme ou livro favorito?',
  'Outra pergunta personalizada...',
];

export const AuthView: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // Common credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Register security question
  const [selectedQuestion, setSelectedQuestion] = useState(DEFAULT_SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Recovery state
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const getRecoveryQuestion = useAuthStore((s) => s.getRecoveryQuestion);
  const resetPasswordWithSecurityAnswer = useAuthStore((s) => s.resetPasswordWithSecurityAnswer);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);
  const openModal = useSettingsStore((s) => s.openModal);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) return;

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres');
        return;
      }

      const finalQuestion = selectedQuestion === 'Outra pergunta personalizada...' ? customQuestion.trim() : selectedQuestion;
      if (!finalQuestion) {
        setError('Por favor, informe uma pergunta de recuperação');
        return;
      }
      if (!securityAnswer.trim()) {
        setError('Por favor, informe a resposta da pergunta de recuperação');
        return;
      }

      await register(username.trim(), password, avatarFile || undefined, finalQuestion, securityAnswer.trim());
    } else {
      await login(username.trim(), password);
    }
  };

  const handleFetchRecoveryQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!recoveryUsername.trim()) return;

    const res = await getRecoveryQuestion(recoveryUsername.trim());
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.question) {
      setRecoveryQuestion(res.question);
      setRecoveryStep(2);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recoveryAnswer.trim()) {
      setError('Por favor, informe a resposta de segurança');
      return;
    }
    if (recoveryNewPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    const res = await resetPasswordWithSecurityAnswer(recoveryUsername.trim(), recoveryAnswer.trim(), recoveryNewPassword);
    if (res.success) {
      setRecoverySuccess(true);
    } else if (res.error) {
      setError(res.error);
    }
  };

  const resetRecoveryFlow = () => {
    setIsRecovery(false);
    setRecoveryStep(1);
    setRecoveryUsername('');
    setRecoveryQuestion('');
    setRecoveryAnswer('');
    setRecoveryNewPassword('');
    setRecoveryConfirmPassword('');
    setRecoverySuccess(false);
    setError(null);
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-haven-darkest p-4 relative select-none">
      {/* Refined Minimalist Container */}
      <div className="relative w-full max-w-sm bg-haven-dark border border-haven-border rounded-2xl shadow-modal p-6 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-haven-accent text-white flex items-center justify-center shadow-subtle mb-3">
            <span className="font-bold text-lg tracking-tight">H</span>
          </div>
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight">Haven</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isRecovery ? 'Recuperação de Acesso Zero-PII' : 'Comunicação Segura & Minimalista'}
          </p>
        </div>

        {/* Recovery Mode View */}
        {isRecovery ? (
          <div>
            {recoverySuccess ? (
              <div className="flex flex-col items-center text-center py-4 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-haven-emerald" />
                <h3 className="text-sm font-semibold text-zinc-100">Senha Redefinida!</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Você já foi autenticado com sucesso.</p>
              </div>
            ) : recoveryStep === 1 ? (
              <form onSubmit={handleFetchRecoveryQuestion} className="flex flex-col gap-3.5">
                <p className="text-xs text-zinc-400 text-center leading-relaxed">
                  Digite seu usuário para carregar sua pergunta secreta de recuperação.
                </p>

                <Input
                  label="Nome de Usuário"
                  placeholder="Seu usuário"
                  value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  required
                  autoFocus
                />

                {error && (
                  <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-1 py-2 text-xs font-semibold gap-1.5"
                  isLoading={isLoading}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Buscar Pergunta</span>
                </Button>

                <button
                  type="button"
                  onClick={resetRecoveryFlow}
                  className="flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 mt-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para login</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                <div className="bg-haven-card p-3 rounded-lg border border-haven-border">
                  <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-medium mb-1">
                    <HelpCircle className="w-3.5 h-3.5 text-haven-accent" />
                    <span>Pergunta de Segurança</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{recoveryQuestion}</p>
                </div>

                <Input
                  label="Resposta Secreta"
                  placeholder="Sua resposta exata"
                  value={recoveryAnswer}
                  onChange={(e) => setRecoveryAnswer(e.target.value)}
                  required
                  autoFocus
                />

                <Input
                  label="Nova Senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  required
                />

                <Input
                  label="Confirmar Nova Senha"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={recoveryConfirmPassword}
                  onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                  required
                />

                {error && (
                  <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-1 py-2 text-xs font-semibold gap-1.5"
                  isLoading={isLoading}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Redefinir e Entrar</span>
                </Button>

                <button
                  type="button"
                  onClick={() => setRecoveryStep(1)}
                  className="flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 mt-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          <div>
            {/* Minimalist Tab Switcher */}
            <div className="flex bg-haven-darkest p-1 rounded-lg mb-5 border border-haven-border">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  !isRegister ? 'bg-haven-surface text-white shadow-subtle' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  isRegister ? 'bg-haven-surface text-white shadow-subtle' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {/* Main Auth Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Avatar upload for register mode */}
              {isRegister && (
                <div className="flex flex-col items-center justify-center mb-1">
                  <label className="relative cursor-pointer group">
                    <div className="w-14 h-14 rounded-full bg-haven-card border border-dashed border-haven-border hover:border-haven-accent flex items-center justify-center overflow-hidden transition-colors">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-zinc-500 mt-1">Foto de Perfil (opcional)</span>
                </div>
              )}

              <Input
                label="Nome de Usuário"
                placeholder="Seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="Senha"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {isRegister && (
                <>
                  <Input
                    label="Confirmar Senha"
                    type="password"
                    placeholder="Repita sua senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />

                  {/* Security Question Section */}
                  <div className="flex flex-col gap-1.5 text-left pt-2 border-t border-haven-border">
                    <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-haven-accent" />
                      <span>Pergunta de Recuperação (Zero-PII)</span>
                    </label>
                    <select
                      value={selectedQuestion}
                      onChange={(e) => setSelectedQuestion(e.target.value)}
                      className="bg-haven-darker border border-haven-border rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-haven-accent transition-colors"
                    >
                      {DEFAULT_SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q} className="bg-haven-darker text-zinc-200">
                          {q}
                        </option>
                      ))}
                    </select>

                    {selectedQuestion === 'Outra pergunta personalizada...' && (
                      <Input
                        placeholder="Digite sua pergunta personalizada"
                        value={customQuestion}
                        onChange={(e) => setCustomQuestion(e.target.value)}
                        required
                      />
                    )}

                    <Input
                      label="Resposta Secreta"
                      placeholder="Sua resposta (guarde com segurança)"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      required
                    />
                    <span className="text-[10px] text-zinc-500">
                      Usada para recuperar sua conta caso você esqueça sua senha.
                    </span>
                  </div>
                </>
              )}

              {!isRegister && (
                <div className="flex justify-end -mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecovery(true);
                      setError(null);
                    }}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-xs text-haven-rose bg-rose-950/30 p-2.5 rounded-lg border border-rose-800/40">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-1.5 py-2 text-xs font-semibold gap-1.5"
                isLoading={isLoading}
              >
                {isRegister ? (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Criar Conta</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Entrar</span>
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Desktop Download Footer */}
        <div className="mt-5 pt-4 border-t border-haven-border flex items-center justify-between text-xs">
          <span className="text-zinc-500">Aplicativo Desktop?</span>
          <button
            type="button"
            onClick={() => openModal('download')}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white font-medium cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
