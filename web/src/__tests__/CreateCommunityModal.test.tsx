import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreateCommunityModal } from '../components/modals/CreateCommunityModal';
import { useSettingsStore } from '../stores/settingsStore';

describe('CreateCommunityModal Component', () => {
  beforeEach(() => {
    useSettingsStore.setState({ activeModal: 'create_community' });
  });

  it('should render clean community creation modal', () => {
    render(<CreateCommunityModal />);

    expect(screen.getAllByText('Criar Comunidade').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Taxa Anti-Spam/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Comprovante PIX \(Obrigatório\)/i)).toBeInTheDocument();
  });
});
