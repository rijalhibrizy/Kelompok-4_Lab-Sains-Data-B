// Tiruan minimal D1 di atas node:sqlite, hanya untuk pengujian otomatis tanpa wrangler.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function createD1(files) {
  const sqlite = new DatabaseSync(':memory:');
  for (const f of files) sqlite.exec(readFileSync(new URL(f, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => { const r = sqlite.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { sqlite.exec('BEGIN'); try { const out = []; for (const s of list) out.push(await s.run()); sqlite.exec('COMMIT'); return out; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
}
