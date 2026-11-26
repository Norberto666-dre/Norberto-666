// Tabla de la run diaria: mejor puntuación de cada usuario, con dos fuentes.
// - OFFLINE: se reconstruye desde los u_<id>.json del datasave (o su caché).
// - ONLINE: endpoint configurable en js/online-config.js; si falla, queda en caché.
import { isOnlineEnabled, onlineConfig } from './online-config.js';

const PENDING_KEY = 'overclock9_leaderboard_pending';
const CACHE_PREFIX = 'overclock9_leaderboard_cache_';

export function dailyKey(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function normalizeEntry(raw) {
  const nickname = String(raw?.nickname ?? raw?.user ?? '')
    .trim().replace(/\s+/g, ' ').slice(0, 18);
  const score = Math.max(0, Math.floor(Number(raw?.score) || 0));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.date || '')) ? String(raw.date) : dailyKey();
  if (!nickname || score <= 0) return null;
  return {
    nickname,
    score,
    date,
    code: String(raw?.code || '').slice(0, 32),
    seed: raw?.seed != null && Number.isFinite(Number(raw.seed)) ? Number(raw.seed) >>> 0 : null,
    ts: Number(raw?.ts) || Date.now()
  };
}

export function dedupeEntries(entries) {
  const map = new Map();
  entries.forEach(entry => {
    const key = `${entry.date}|${entry.nickname.toLowerCase()}|${entry.code || entry.seed || entry.ts}`;
    const prev = map.get(key);
    if (!prev || entry.score > prev.score) map.set(key, entry);
  });
  return Array.from(map.values());
}

export function sortEntries(entries) {
  return dedupeEntries(entries).sort((a, b) =>
    b.score - a.score ||
    a.ts - b.ts ||
    a.nickname.localeCompare(b.nickname, 'es')
  );
}

export function bestEntry(entries) {
  return sortEntries(entries)[0] || null;
}

/** Extrae las runs diarias guardadas en el archivo de un usuario. */
export function dailyEntriesFromSave(save, date = null, nickname = null) {
  const runs = save?.progress?.dailyRuns || {};
  return Object.entries(runs)
    .filter(([key]) => !date || key === date)
    .map(([key, run]) => normalizeEntry({
      ...run,
      date: key,
      nickname: nickname || save?.nickname || save?.progress?.nickname
    }))
    .filter(Boolean);
}

export class Leaderboard {
  constructor({ accounts = null, fetchImpl = null } = {}) {
    this.accounts = accounts;
    this.fetchImpl = fetchImpl || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : null);
    this.lastResult = null;
  }

  // ---------- almacenamiento auxiliar ----------

  read(key, fallback) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  write(key, value) {
    try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch (e) { /* cuota */ }
  }

  pending() {
    const rows = this.read(PENDING_KEY, []);
    return Array.isArray(rows) ? rows.map(normalizeEntry).filter(Boolean) : [];
  }

  queue(entry) {
    const rows = this.pending();
    const key = `${entry.date}|${entry.nickname}|${entry.code}`;
    if (!rows.some(row => `${row.date}|${row.nickname}|${row.code}` === key)) rows.push(entry);
    this.write(PENDING_KEY, rows);
  }

  unqueue(entry) {
    const rows = this.pending().filter(row => row.code !== entry.code || row.date !== entry.date);
    this.write(PENDING_KEY, rows);
  }

  cache(date, entries) {
    this.write(CACHE_PREFIX + date, sortEntries(entries).slice(0, 50));
  }

  cached(date) {
    const rows = this.read(CACHE_PREFIX + date, []);
    return Array.isArray(rows) ? sortEntries(rows.map(normalizeEntry).filter(Boolean)) : [];
  }

  // ---------- red ----------

  urlFor(date) {
    const url = onlineConfig().leaderboardUrl;
    try {
      const parsed = new URL(url, globalThis.location?.href || 'http://localhost');
      parsed.searchParams.set('date', date);
      return parsed.toString();
    } catch (e) { return url; }
  }

  async request(method, payload) {
    if (!this.fetchImpl) throw new Error('fetch no disponible');
    const cfg = onlineConfig();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    if (controller) {
      timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    }
    try {
      const response = await this.fetchImpl(method === 'GET' ? this.urlFor(payload.date) : cfg.leaderboardUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {})
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
        signal: controller?.signal
      });
      if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
      return response.json ? await response.json() : [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Envía la run diaria; sin endpoint o sin red queda encolada para reintentar. */
  async submit(raw) {
    const entry = normalizeEntry(raw);
    if (!entry) return { ok: false, reason: 'invalid' };
    if (!isOnlineEnabled()) {
      this.queue(entry);
      return { ok: false, reason: 'not-configured', entry };
    }
    try {
      await this.request('POST', entry);
      this.unqueue(entry);
      return { ok: true, entry };
    } catch (e) {
      this.queue(entry);
      return { ok: false, reason: 'offline', error: e.message, entry };
    }
  }

  async syncPending() {
    const results = [];
    for (const entry of this.pending()) results.push(await this.submit(entry));
    return results;
  }

  // ---------- lectura ----------

  async offline(date = dailyKey()) {
    const accounts = this.accounts?.manifest?.accounts || [];
    const entries = [];
    for (const account of accounts) {
      const save = this.accounts.readSave
        ? await this.accounts.readSave(account).catch(() => null)
        : account.save || null;
      dailyEntriesFromSave(save, date, account.nickname)
        .forEach(entry => entries.push(entry));
    }
    return sortEntries(entries);
  }

  async load(date = dailyKey()) {
    const offline = await this.offline(date);
    if (!isOnlineEnabled()) {
      const cached = this.cached(date);
      this.lastResult = {
        date, offline, online: cached,
        onlineState: cached.length ? 'CACHÉ · ONLINE SIN CONFIGURAR' : 'ONLINE SIN CONFIGURAR',
        ok: false
      };
      return this.lastResult;
    }
    try {
      const data = await this.request('GET', { date });
      const raw = Array.isArray(data) ? data : (data?.entries || []);
      const online = sortEntries(raw.map(normalizeEntry).filter(Boolean));
      this.cache(date, online);
      this.lastResult = { date, offline, online, onlineState: 'CONECTADO', ok: true };
    } catch (e) {
      const online = this.cached(date);
      this.lastResult = {
        date, offline, online, onlineState: online.length ? 'CACHÉ · SIN CONEXIÓN' : 'SIN CONEXIÓN',
        ok: false, error: e.message
      };
    }
    return this.lastResult;
  }
}
