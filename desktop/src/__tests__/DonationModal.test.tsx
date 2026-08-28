import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DonationModal } from '../components/modals/DonationModal';
import { useSettingsStore } from '../stores/settingsStore';

describe('DonationModal Component', () => {
  beforeEach(() => {
    useSettingsStore.setState({ activeModal: 'donate' });
  });

  it('should render minimalist PIX info and comment field', () => {
    render(<DonationModal />);

    expect(screen.getByText('Apoie o Projeto')).toBeInTheDocument();
    expect(screen.getByText(/Código PIX/i)).toBeInTheDocument();
    expect(screen.getByText('Copiar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Escreva sua mensagem de apoio/i)).toBeInTheDocument();
  });
});
