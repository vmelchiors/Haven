/**
 * Client-Side EMVCo BR Code (PIX) Generator
 * Conforms to Banco Central do Brasil PIX standard.
 * Zero-latency computation directly in TypeScript without intermediary fees.
 */

export interface PixOptions {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txId?: string;
  description?: string;
}

export function formatEMV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function sanitizePixString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
}

/**
 * Calculates standard CRC16-CCITT checksum (polynomial 0x1021, initial 0xFFFF)
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  const bytes = new TextEncoder().encode(payload);

  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates the full EMV BR Code string for static PIX payment
 */
export function generatePixPayload(options: PixOptions): string {
  const {
    key,
    merchantName = 'HAVEN PROJECT',
    merchantCity = 'MANAUS',
    amount,
    txId = '***',
    description,
  } = options;

  if (!key) throw new Error('Chave PIX obrigatória');

  const cleanName = sanitizePixString(merchantName).slice(0, 25) || 'HAVEN PROJECT';
  const cleanCity = sanitizePixString(merchantCity).slice(0, 15) || 'MANAUS';
  const cleanTxId = sanitizePixString(txId).slice(0, 25) || '***';

  // 00: Payload Format Indicator
  let payload = formatEMV('00', '01');

  // 26: Merchant Account Information
  const gui = formatEMV('00', 'br.gov.bcb.pix');
  const pixKey = formatEMV('01', key.trim());
  let desc = '';
  if (description) {
    const cleanDesc = sanitizePixString(description).slice(0, 40);
    desc = formatEMV('02', cleanDesc);
  }
  payload += formatEMV('26', gui + pixKey + desc);

  // 52: Merchant Category Code (0000 = General)
  payload += formatEMV('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += formatEMV('53', '986');

  // 54: Transaction Amount (optional)
  if (amount && amount > 0) {
    payload += formatEMV('54', amount.toFixed(2));
  }

  // 58: Country Code (BR)
  payload += formatEMV('58', 'BR');

  // 59: Merchant Name
  payload += formatEMV('59', cleanName);

  // 60: Merchant City
  payload += formatEMV('60', cleanCity);

  // 62: Additional Data Field (TxID)
  const additionalData = formatEMV('05', cleanTxId);
  payload += formatEMV('62', additionalData);

  // 63: CRC16 calculation placeholder
  const payloadWithCRCKey = payload + '6304';
  const crc = calculateCRC16(payloadWithCRCKey);

  return payloadWithCRCKey + crc;
}
