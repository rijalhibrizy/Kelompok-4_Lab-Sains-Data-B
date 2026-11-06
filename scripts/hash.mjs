// Pakai: npm run hash -- "kataSandiBaru"  -> hasil dipakai pada kolom password_hash tabel users
import { hashPassword } from '../src/crypto.js';
console.log(await hashPassword(process.argv[2] || 'Rameza123'));
