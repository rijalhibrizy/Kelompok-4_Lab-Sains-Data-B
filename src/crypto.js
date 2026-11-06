// Hash kata sandi dengan PBKDF2-SHA256 (Web Crypto, tersedia di Workers dan Node)
const enc = new TextEncoder();
const toHex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const ITER = 100000; // batas maksimum iterasi PBKDF2 di Cloudflare Workers

async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toHex(salt)}:${await derive(password, salt)}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return (await derive(password, fromHex(salt))) === hash;
}
export const randomToken = () => toHex(crypto.getRandomValues(new Uint8Array(32)));
