import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToSModal } from '../components/modals/ToSModal';
import { useAuthStore } from '../stores/authStore';

describe('ToSModal Component', () => {
  beforeEach(() => {
    useAuthStore.setState({ requiresToS: true });
    vi.restoreAllMocks();
  });

  it('should render ToS gatekeeper when requiresToS is true', () => {
    render(<ToSModal />);

    expect(screen.getByText('Termos de Uso & Privacidade Haven')).toBeInTheDocument();
    expect(screen.getByText(/1\. Compromisso Zero-PII/i)).toBeInTheDocument();
    expect(screen.getByText('Aceitar Termos e Entrar')).toBeInTheDocument();
  });

  it('should call acceptToS when user clicks accept', async () => {
    const acceptMock = vi.fn().mockResolvedValue(true);
    useAuthStore.setState({ acceptToS: acceptMock });

    render(<ToSModal />);
    const btn = screen.getByText('Aceitar Termos e Entrar');
    fireEvent.click(btn);

    expect(acceptMock).toHaveBeenCalledWith('v1.0.0');
  });
});
