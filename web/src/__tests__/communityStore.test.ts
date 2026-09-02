import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommunityStore } from '../stores/communityStore';
import { useAuthStore } from '../stores/authStore';

describe('CommunityStore', () => {
  beforeEach(() => {
    useCommunityStore.setState({
      communities: [],
      pendingCommunities: [],
      selectedCommunity: null,
      selectedChannel: null,
      members: [],
      isLoading: false,
      error: null,
    });
    useAuthStore.setState({
      tokens: { access_token: 'valid_token', refresh_token: 'ref', expires_in: 900, token_type: 'Bearer' },
      isAuthenticated: true,
    });
    vi.restoreAllMocks();
  });

  it('should fetch and set approved communities', async () => {
    const mockList = [
      {
        id: 'c1',
        name: 'Golang Brasil',
        description: 'Comunidade Go',
        owner_id: 'u1',
        status: 'APPROVED' as const,
        donation_amount: 1500,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockList,
    } as Response);

    await useCommunityStore.getState().fetchCommunities();

    const state = useCommunityStore.getState();
    expect(state.communities).toHaveLength(1);
    expect(state.communities[0].name).toBe('Golang Brasil');
  });

  it('should create a community with multipart/form-data containing receipt', async () => {
    const mockReceipt = new File(['mock content'], 'comprovante.png', { type: 'image/png' });
    const mockCreated = {
      id: 'c_new',
      name: 'TypeScript Masters',
      description: 'Devs TS',
      receipt_file_path: '/data/receipts/receipt_mock.png',
      donation_amount: 1500,
      owner_id: 'u1',
      status: 'PENDING' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    global.fetch = vi.fn().mockImplementation((_url, options) => {
      expect(options.method).toBe('POST');
      expect(options.body).toBeInstanceOf(FormData);
      return Promise.resolve({
        ok: true,
        json: async () => mockCreated,
      } as Response);
    });

    const result = await useCommunityStore.getState().createCommunity(
      'TypeScript Masters',
      'Devs TS',
      mockReceipt
    );

    expect(result).not.toBeNull();
    expect(result?.status).toBe('PENDING');
    expect(result?.donation_amount).toBe(1500);
  });

  it('should approve pending community', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'APPROVED' }),
    } as Response);

    const success = await useCommunityStore.getState().approveCommunity('c_new');
    expect(success).toBe(true);
  });

  it('should reject pending community with reason', async () => {
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      const parsed = JSON.parse(options.body);
      expect(parsed.rejection_reason).toBe('Comprovante ilegivel');
      return Promise.resolve({
        ok: true,
        json: async () => ({ status: 'REJECTED' }),
      } as Response);
    });

    const success = await useCommunityStore.getState().rejectCommunity('c_new', 'Comprovante ilegivel');
    expect(success).toBe(true);
  });

  it('should refresh members only for the community still being viewed', async () => {
    const viewedCommunity = {
      id: 'c1',
      name: 'Haven',
      owner_id: 'u1',
      status: 'APPROVED' as const,
      donation_amount: 1500,
      created_at: new Date().toISOString(),
    };
    useCommunityStore.setState({ selectedCommunity: viewedCommunity });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'u2', username: 'Bob', is_admin: false, created_at: new Date().toISOString() }],
    } as Response);

    await useCommunityStore.getState().fetchMembers('c1');
    expect(useCommunityStore.getState().members.map((member) => member.id)).toEqual(['u2']);

    useCommunityStore.setState({ selectedCommunity: { ...viewedCommunity, id: 'c2' } });
    await useCommunityStore.getState().fetchMembers('c1');
    expect(useCommunityStore.getState().members.map((member) => member.id)).toEqual(['u2']);
  });
});
