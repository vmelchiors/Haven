import { create } from 'zustand';
import { Feedback, FeedbackType, FeedbackStatus } from '../types';
import { useAuthStore } from './authStore';

interface FeedbackState {
  feedbacks: Feedback[];
  isLoading: boolean;
  error: string | null;

  createFeedback: (type: FeedbackType, title: string, description: string) => Promise<Feedback | null>;
  fetchFeedbacks: (statusFilter?: string, typeFilter?: string) => Promise<void>;
  updateFeedbackStatus: (id: string, status: FeedbackStatus, adminNotes?: string) => Promise<boolean>;
  deleteFeedback: (id: string) => Promise<boolean>;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  feedbacks: [],
  isLoading: false,
  error: null,

  createFeedback: async (type, title, description) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return null;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ type, title, description }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao enviar relato/sugestão');
      }

      const fb: Feedback = await res.json();
      set({ isLoading: false });
      return fb;
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      return null;
    }
  },

  fetchFeedbacks: async (statusFilter = '', typeFilter = '') => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter && typeFilter !== 'ALL') params.append('type', typeFilter);

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/feedback${query}`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Erro ao listar feedbacks');

      const list: Feedback[] = await res.json();
      set({ feedbacks: list, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  updateFeedbackStatus: async (id, status, adminNotes = '') => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({ status, admin_notes: adminNotes }),
      });

      if (res.ok) {
        const updated: Feedback = await res.json();
        set((state) => ({
          feedbacks: state.feedbacks.map((f) => (f.id === id ? { ...f, ...updated } : f)),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  deleteFeedback: async (id) => {
    const tokens = useAuthStore.getState().tokens;
    if (!tokens) return false;

    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (res.ok) {
        set((state) => ({
          feedbacks: state.feedbacks.filter((f) => f.id !== id),
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
