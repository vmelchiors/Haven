import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore, STORAGE_KEY_TOKENS } from '../stores/authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      requiresToS: false,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it('should initialize unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
  });

  it('should login successfully and save tokens', async () => {
    const mockUser = {
      id: 'u1',
      username: 'havenuser',
      is_admin: false,
      accepted_tos_version: 'v1.0.0',
      created_at: new Date().toISOString(),
    };
    const mockTokens = {
      access_token: 'jwt_mock_access',
      refresh_token: 'mock_refresh',
      expires_in: 900,
      token_type: 'Bearer',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser, tokens: mockTokens }),
    } as Response);

    const success = await useAuthStore.getState().login('havenuser', 'secret123');
    expect(success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('havenuser');
    expect(state.tokens?.access_token).toBe('jwt_mock_access');
    const stored = localStorage.getItem(STORAGE_KEY_TOKENS);
    expect(stored).not.toBeNull();
    expect(stored).toContain('jwt_mock_access');
  });

  it('should trigger requiresToS when backend returns 403 with requires_tos', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'ToS not accepted', requires_tos: true }),
    } as Response);

    const success = await useAuthStore.getState().login('outdated_user', 'secret');
    expect(success).toBe(false);

    const state = useAuthStore.getState();
    expect(state.requiresToS).toBe(true);
  });

  it('should register with security question and answer', async () => {
    const mockUser = {
      id: 'u2',
      username: 'reguser',
      is_admin: false,
      accepted_tos_version: 'v1.0.0',
      security_question: 'Qual seu pet?',
      created_at: new Date().toISOString(),
    };
    const mockTokens = {
      access_token: 'jwt_reg_access',
      refresh_token: 'reg_refresh',
      expires_in: 900,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: mockUser, tokens: mockTokens }),
    } as Response);

    const success = await useAuthStore.getState().register('reguser', 'secret123', undefined, 'Qual seu pet?', 'Rex');
    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"security_question":"Qual seu pet?"'),
      })
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should fetch recovery question and reset password', async () => {
    // 1. Fetch question
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ security_question: 'Qual o nome da sua primeira escola?' }),
    } as Response);

    const qRes = await useAuthStore.getState().getRecoveryQuestion('someuser');
    expect(qRes.question).toBe('Qual o nome da sua primeira escola?');

    // 2. Reset password
    const mockUser = {
      id: 'u3',
      username: 'someuser',
      is_admin: false,
      created_at: new Date().toISOString(),
    };
    const mockTokens = {
      access_token: 'jwt_reset_access',
      refresh_token: 'reset_refresh',
      expires_in: 900,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, tokens: mockTokens }),
    } as Response);

    const resetRes = await useAuthStore.getState().resetPasswordWithSecurityAnswer('someuser', 'Colegio Modelo', 'newsecret123');
    expect(resetRes.success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('someuser');
  });

  it('should logout cleanly', () => {
    useAuthStore.setState({
      user: { id: 'u1', username: 'test', is_admin: false, accepted_tos_version: 'v1.0.0', created_at: '' },
      tokens: { access_token: 'tok', refresh_token: 'ref', expires_in: 900, token_type: 'Bearer' },
      isAuthenticated: true,
    });
    localStorage.setItem(STORAGE_KEY_TOKENS, 'tok');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_TOKENS)).toBeNull();
  });
});
