import { create } from 'zustand';
import { User, TokenPair, AuthResponse } from '../types';

interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  requiresToS: boolean;
  currentToSVersion: string;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, avatarFile?: File, securityQuestion?: string, securityAnswer?: string) => Promise<boolean>;
  getRecoveryQuestion: (username: string) => Promise<{ question?: string; error?: string }>;
  resetPasswordWithSecurityAnswer: (username: string, answer: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  acceptToS: (version?: string) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
  updateProfile: (newUsername?: string, currentPassword?: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  refreshToken: () => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const STORAGE_KEY_TOKENS = 'haven_auth_tokens';
export const STORAGE_KEY_USER = 'haven_auth_user';

const getStoredJSON = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const initialTokens = getStoredJSON<TokenPair>(STORAGE_KEY_TOKENS);
const initialUser = getStoredJSON<User>(STORAGE_KEY_USER);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  tokens: initialTokens,
  isAuthenticated: Boolean(initialTokens?.access_token),
  requiresToS: false,
  currentToSVersion: 'v1.0.0',
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data.requires_tos) {
          set({ requiresToS: true, isLoading: false });
          return false;
        }
        throw new Error(data.error || 'Credenciais inválidas');
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return false;
    }
  },

  register: async (username, password, avatarFile, securityQuestion, securityAnswer) => {
    set({ isLoading: true, error: null });
    try {
      let avatarUrl = '';

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          avatar_url: avatarUrl,
          accepted_tos_version: get().currentToSVersion,
          security_question: securityQuestion || '',
          security_answer: securityAnswer || '',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao registrar usuário');
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        isAuthenticated: true,
        isLoading: false,
      });

      // Upload avatar now that we have the access token
      if (avatarFile && data.tokens?.access_token) {
        await get().uploadAvatar(avatarFile);
      }

      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return false;
    }
  },

  getRecoveryQuestion: async (username: string) => {
    try {
      const res = await fetch('/api/auth/recovery/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data.error || 'Usuário não encontrado ou sem pergunta configurada' };
      }
      return { question: data.security_question };
    } catch (err: any) {
      return { error: err.message || 'Erro ao conectar com o servidor' };
    }
  },

  resetPasswordWithSecurityAnswer: async (username: string, answer: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/recovery/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          security_answer: answer,
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Resposta incorreta ou erro na redefinição');
      }

      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  acceptToS: async (version) => {
    const { tokens, currentToSVersion } = get();
    if (!tokens) return false;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/tos/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ version: version || currentToSVersion }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao aceitar Termos de Serviço');
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        requiresToS: false,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return false;
    }
  },

  uploadAvatar: async (file: File) => {
    const { tokens } = get();
    if (!tokens) return null;

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao fazer upload do avatar');
      }

      const data = await res.json();
      if (data.avatar_url && get().user) {
        const updatedUser = { ...get().user!, avatar_url: data.avatar_url };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
        set({ user: updatedUser });
      }
      return data.avatar_url as string;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateProfile: async (newUsername, currentPassword, newPassword) => {
    const { tokens } = get();
    if (!tokens) return { success: false, error: 'Não autenticado' };

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao atualizar perfil');
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        isLoading: false,
      });
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  refreshToken: async () => {
    const { tokens } = get();
    if (!tokens?.refresh_token) {
      get().logout();
      return false;
    }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });

      if (!res.ok) {
        get().logout();
        return false;
      }

      const data: AuthResponse = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(data.tokens));
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));

      set({
        user: data.user,
        tokens: data.tokens,
        isAuthenticated: true,
      });
      return true;
    } catch (err) {
      get().logout();
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_TOKENS);
    localStorage.removeItem(STORAGE_KEY_USER);
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      requiresToS: false,
      error: null,
    });
  },

  checkAuth: async () => {
    const { tokens } = get();
    if (!tokens?.access_token) {
      get().logout();
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (res.ok) {
        const user: User = await res.json();
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        set({ user, isAuthenticated: true });
      } else if (res.status === 401) {
        // Try refresh
        await get().refreshToken();
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.requires_tos) {
          set({ requiresToS: true });
        }
      }
    } catch (err) {
      // Ignored in offline mode
    }
  },
}));
