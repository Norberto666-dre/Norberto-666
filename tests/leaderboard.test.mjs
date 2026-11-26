import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Leaderboard, dailyKey, normalizeEntry, dedupeEntries,
  sortEntries, bestEntry, dailyEntriesFromSave
} from '../js/leaderboard.js';
import { isOnlineEnabled, onlineConfig } from '../js/online-config.js';

// localStorage mínimo para el entorno Node (idéntico a la clave usada en el juego).
const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};

const DATE = '2026-11-25';
const reset = () => { store.clear(); };

test('dailyKey usa la fecha local en formato YYYY-MM-DD', () => {
  assert.match(dailyKey(new Date(2026, 10, 25)), /^2026-11-25$/);
});

test('normalizeEntry descarta nicknames vacíos y puntuaciones no positivas', () => {
  assert.equal(normalizeEntry({ nickname: '', score: 10 }), null);
  assert.equal(normalizeEntry({ nickname: 'Nova', score: 0 }), null);
  const entry = normalizeEntry({ nickname: '  Nova  ', score: '123.9', date: DATE, code: 'O9-X' });
  assert.equal(entry.nickname, 'Nova');
  assert.equal(entry.score, 123);
  assert.equal(entry.date, DATE);
});

test('dedupe y orden respetan la mejor puntuación por usuario/código', () => {
  const rows = [
    { nickname: 'A', score: 100, date: DATE, code: 'X' },
    { nickname: 'A', score: 180, date: DATE, code: 'X' },
    { nickname: 'B', score: 220, date: DATE, code: 'Y' }
  ];
  const sorted = sortEntries(rows);
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].nickname, 'B');
  assert.equal(bestEntry(rows).score, 220);
  assert.equal(dedupeEntries(rows).find(e => e.nickname === 'A').score, 180);
});

test('dailyEntriesFromSave extrae solo la fecha pedida', () => {
  const save = {
    nickname: 'Kira',
    progress: {
      dailyRuns: {
        '2026-11-24': { score: 50, code: 'OLD' },
        [DATE]: { score: 300, code: 'TODAY' }
      }
    }
  };
  const entries = dailyEntriesFromSave(save, DATE, 'Kira');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].score, 300);
  assert.equal(entries[0].code, 'TODAY');
});

test('La tabla offline se reconstruye desde todos los perfiles del datasave', async () => {
  reset();
  const accounts = {
    manifest: { accounts: [{ id: 'a', nickname: 'Kira' }, { id: 'b', nickname: 'Nova' }] },
    readSave: async account => ({
      progress: {
        dailyRuns: {
          [DATE]: { score: account.id === 'a' ? 120 : 400, code: `C-${account.id}` }
        }
      }
    })
  };
  const board = new Leaderboard({ accounts });
  const rows = await board.offline(DATE);
  assert.deepEqual(rows.map(e => e.nickname), ['Nova', 'Kira']);
});

test('Sin endpoint la run queda encolada y online usa la caché', async () => {
  reset();
  const board = new Leaderboard({ fetchImpl: async () => ({ ok: true, json: async () => [] }) });
  const queued = await board.submit({ nickname: 'Solo', score: 90, date: DATE });
  assert.equal(queued.reason, 'not-configured');
  assert.equal(board.pending().length, 1);

  board.cache(DATE, [{ nickname: 'World', score: 500, date: DATE }]);
  const data = await board.load(DATE);
  assert.equal(data.ok, false);
  assert.match(data.onlineState, /CACHÉ/);
  assert.equal(data.online[0].nickname, 'World');
});

test('Con endpoint configurable se publica, se consulta por fecha y se limpia la cola', async () => {
  reset();
  store.set('overclock9_online_config', JSON.stringify({
    leaderboardUrl: 'https://example.test/daily', token: 'abc', timeoutMs: 500
  }));
  assert.equal(isOnlineEnabled(), true);
  assert.equal(onlineConfig().token, 'abc');

  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return { ok: true, json: async () => ({ ok: true }) };
    return { ok: true, json: async () => [
      { nickname: 'World', score: 900, date: DATE, code: 'O9-W' }
    ] };
  };
  const board = new Leaderboard({ fetchImpl });
  const sent = await board.submit({ nickname: 'Kira', score: 300, date: DATE, code: 'O9-K' });
  assert.equal(sent.ok, true);
  assert.equal(board.pending().length, 0);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer abc');

  const data = await board.load(DATE);
  assert.equal(data.ok, true);
  assert.match(calls[1].url, /date=2026-11-25/);
  assert.equal(data.online[0].score, 900);
  assert.equal(board.cached(DATE)[0].nickname, 'World');
});
