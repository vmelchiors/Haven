import { describe, it, expect } from 'vitest';
import {
  formatEMV,
  sanitizePixString,
  calculateCRC16,
  generatePixPayload,
} from '../lib/pix';

describe('PIX Client-Side EMV Generator', () => {
  it('should format EMV fields correctly with 2-digit length prefix', () => {
    expect(formatEMV('00', '01')).toBe('000201');
    expect(formatEMV('58', 'BR')).toBe('5802BR');
    expect(formatEMV('53', '986')).toBe('5303986');
  });

  it('should sanitize merchant and city strings properly', () => {
    expect(sanitizePixString('São Paulo')).toBe('SAO PAULO');
    expect(sanitizePixString('Haven Project @ 2026!')).toBe('HAVEN PROJECT  2026');
  });

  it('should calculate valid 4-character uppercase CRC16-CCITT', () => {
    const testPayload = '00020101021126580014br.gov.bcb.pix0114+5511999999995204000053039865802BR5913HAVEN PROJECT6006MANAUS62070503***6304';
    const crc = calculateCRC16(testPayload);
    expect(crc).toHaveLength(4);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
  });

  it('should generate complete PIX payload with fixed R$ 15,00 for community anti-spam', () => {
    const payload = generatePixPayload({
      key: 'haven@domain.org',
      merchantName: 'Haven Project',
      merchantCity: 'Manaus',
      amount: 15.0,
      txId: 'COMMUNITY_FEE',
      description: 'Anti-spam',
    });

    expect(payload).toContain('000201');
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('haven@domain.org');
    expect(payload).toContain('540515.00'); // 15.00 BRL
    expect(payload).toContain('5802BR');
    expect(payload).toContain('6304');
    expect(payload.length).toBeGreaterThan(80);
  });

  it('should generate complete PIX payload without amount for open donations', () => {
    const payload = generatePixPayload({
      key: 'haven@domain.org',
      merchantName: 'Haven Project',
      merchantCity: 'Manaus',
    });

    expect(payload).toContain('000201');
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).not.toContain('5405'); // No amount field
    expect(payload).toContain('6304');
  });
});
