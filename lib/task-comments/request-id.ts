type FillRandom = (bytes: Uint8Array) => void;

type CryptoLike = { getRandomValues?: (bytes: Uint8Array) => Uint8Array };

/**
 * Случайные байты: криптографические, если платформа их даёт, иначе Math.random.
 * Ключу повтора нужна уникальность, а не секретность: сервер ищет его только среди запросов того же
 * автора в той же задаче.
 */
function fillRandom(bytes: Uint8Array): void {
  const platform = (globalThis as { crypto?: CryptoLike }).crypto;
  if (typeof platform?.getRandomValues === 'function') {
    platform.getRandomValues(bytes);
    return;
  }
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
}

/** UUID версии 4 для `client_request_id`. */
export function newRequestId(fill: FillRandom = fillRandom): string {
  const bytes = new Uint8Array(16);
  fill(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
