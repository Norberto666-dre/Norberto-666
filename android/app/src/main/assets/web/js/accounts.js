// Cuentas locales para un launcher tipo Netflix: un manifest con perfiles vinculados y
// un archivo JSON de partida por usuario dentro de la carpeta `datasave`.
// En navegadores sin File System Access API (Android/Firefox) se usa un "datasave"
// virtual en almacenamiento local, con el mismo formato de archivos.

const DB_NAME = 'overclock9-accounts';
const DB_STORE = 'handles';
const HANDLE_KEY = 'datasave';
const MANIFEST_FILE = 'accounts.json';
const VAULT_KEY = 'overclock9_datasave_vault';
const MANIFEST_CACHE_KEY = 'overclock9_manifest_cache';
const SAVE_CACHE_PREFIX = 'overclock9_save_cache_';
const LEGACY_KEY = 'overclock9_progress';
const PROGRESS_CACHE_KEY = 'overclock9_progress_cache';
const FORMAT_VERSION = 1;
const AVATAR_LIMIT_BYTES = 96 * 1024;
const AVATAR_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export const CREDENTIAL_RULES = Object.freeze({
  nicknameMin: 3,
  nicknameMax: 18,
  passwordMin: 6,
  iterations: 120000,
  avatarMaxBytes: AVATAR_LIMIT_BYTES
});

const PALETTE = ['#00f3ff', '#ff40d0', '#ffcc00', '#7b8cff', '#00ff9d', '#ff6a00'];

export function normalizeNickname(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, CREDENTIAL_RULES.nicknameMax);
}

function nicknameError() {
  return `El nombre debe tener ${CREDENTIAL_RULES.nicknameMin}-${CREDENTIAL_RULES.nicknameMax} letras, números, espacios, - o _.`;
}

export function validateNickname(nickname) {
  const nick = normalizeNickname(nickname);
  const ok = new RegExp(`^[\\p{L}\\p{N} _-]{${CREDENTIAL_RULES.nicknameMin},${CREDENTIAL_RULES.nicknameMax}}$`, 'u')
    .test(nick);
  return ok ? { ok: true, nickname: nick } : { ok: false, error: nicknameError() };
}

export function validateCredentials(nickname, password) {
  const valid = validateNickname(nickname);
  if (!valid.ok) return valid;
  if (typeof password !== 'string' || password.length < CREDENTIAL_RULES.passwordMin) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${CREDENTIAL_RULES.passwordMin} caracteres.`
    };
  }
  return { ok: true, nickname: valid.nickname, password };
}

function decodeBase64(text) {
  try {
    if (typeof atob === 'function') {
      const binary = atob(text);
      return Uint8Array.from(binary, ch => ch.charCodeAt(0));
    }
    return new Uint8Array(Buffer.from(text, 'base64'));
  } catch { return null; }
}

function hasImageSignature(bytes, mime) {
  if (mime === 'png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b);
  }
  if (mime === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

/** Acepta solo data URLs de imagen pequeñas generadas por la UI; devuelve null si no es válida. */
export function normalizeAvatar(value) {
  if (value == null || value === '') return null;
  const match = AVATAR_RE.exec(String(value).replace(/\s+/g, ''));
  if (!match) return null;
  const bytes = decodeBase64(match[2]);
  if (!bytes || !bytes.length || bytes.length > AVATAR_LIMIT_BYTES) return null;
  if (!hasImageSignature(bytes, match[1])) return null;
  return `data:image/${match[1]};base64,${match[2]}`;
}

export function parseAvatar(value) {
  const clean = normalizeAvatar(value);
  if (!clean) {
    throw new Error(`La foto debe ser PNG/JPEG/WebP de menos de ${Math.round(AVATAR_LIMIT_BYTES / 1024)} KB.`);
  }
  return clean;
}

function sanitizeColor(value, fallback) {
  return HEX_COLOR_RE.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  if (typeof btoa === 'function') return btoa(binary);
  return Buffer.from(arr).toString('base64');
}

function base64ToBytes(value) {
  const text = String(value || '');
  if (typeof atob === 'function') {
    const binary = atob(text);
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(text, 'base64'));
}

function randomSalt() {
  const salt = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(salt);
  else for (let i = 0; i < salt.length; i++) salt[i] = Math.floor(Math.random() * 256);
  return salt;
}

/** PBKDF2-SHA256. La contraseña nunca se guarda en texto plano. */
export async function hashPassword(password, salt = randomSalt(), iterations = CREDENTIAL_RULES.iterations) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Se necesita HTTPS o localhost para crear cuentas seguras.');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
  );
  return {
    algo: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToBase64(salt),
    digest: bytesToBase64(new Uint8Array(bits))
  };
}

function constantTimeEqual(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, record) {
  if (!record || !record.salt || !record.digest) return false;
  const iterations = Number(record.iterations) || CREDENTIAL_RULES.iterations;
  const candidate = await hashPassword(password, base64ToBytes(record.salt), iterations);
  return constantTimeEqual(candidate.digest, record.digest);
}

export function blankManifest() {
  return { version: FORMAT_VERSION, accounts: [], activeId: null };
}

export function sanitizeManifest(data) {
  const rawAccounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const accounts = rawAccounts
    .filter(a => a && typeof a.id === 'string' && typeof a.nickname === 'string' && a.hash)
    .map((a, index) => ({
      id: a.id,
      nickname: normalizeNickname(a.nickname),
      hash: {
        algo: a.hash.algo || 'PBKDF2-SHA256',
        iterations: Number(a.hash.iterations) || CREDENTIAL_RULES.iterations,
        salt: String(a.hash.salt || ''),
        digest: String(a.hash.digest || '')
      },
      color: sanitizeColor(a.color, PALETTE[index % PALETTE.length]),
      photo: normalizeAvatar(a.photo),
      file: `u_${String(a.id).replace(/[^a-zA-Z0-9_-]/g, '')}.json`,
      createdAt: a.createdAt || null,
      lastPlayed: a.lastPlayed || null,
      updatedAt: a.updatedAt || null
    }))
    .filter(a => a.nickname && a.hash.salt && a.hash.digest);
  const activeId = accounts.some(a => a.id === data?.activeId) ? data.activeId : null;
  return { version: FORMAT_VERSION, accounts, activeId };
}

export function blankSave(account, progress = null) {
  return {
    version: FORMAT_VERSION,
    id: account?.id || null,
    nickname: account?.nickname || null,
    savedAt: null,
    progress,
    runState: null,
    lastOptions: null,
    sectorCleared: 0
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB no disponible.'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB.'));
  });
}

async function idbGet(key) {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch { return null; }
}

async function idbSet(key, value) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* El handle se pierde, pero el vault local sigue funcionando. */ }
}

export class AccountManager {
  constructor() {
    this.supportsFs = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
    this.directory = null;
    this.mode = 'fallback';
    this.needsPermission = false;
    this.manifest = blankManifest();
    this.current = null;
    this.currentSave = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    const handle = await idbGet(HANDLE_KEY);
    if (handle) {
      this.directory = handle;
      this.mode = 'fs';
      let permission = 'prompt';
      try { permission = await handle.queryPermission?.({ mode: 'readwrite' }) || 'prompt'; } catch { /* noop */ }
      this.needsPermission = permission !== 'granted';
    }
    await this.reload();
    return this;
  }

  canPlay() {
    return !!this.current && !(this.mode === 'fs' && this.needsPermission);
  }

  storageLabel() {
    if (this.mode === 'fs') {
      return `DATASAVE · ${this.directory?.name || 'CARPETA'}${this.needsPermission ? ' · CONECTAR' : ''}`;
    }
    return 'DATASAVE · NAVEGADOR';
  }

  enqueue(task) {
    const run = this.writeQueue.then(task, task);
    this.writeQueue = run.catch(() => {});
    return run;
  }

  // ---------- Almacenamiento ----------

  readLocal(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }

  writeLocal(key, value) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* cuota o modo privado */ }
  }

  removeLocal(key) {
    try { globalThis.localStorage?.removeItem(key); } catch { /* modo privado */ }
  }

  readVault() {
    let vault = {};
    try { vault = JSON.parse(this.readLocal(VAULT_KEY) || '{}') || {}; } catch { /* vault vacío */ }
    return {
      manifest: sanitizeManifest(vault.manifest || blankManifest()),
      saves: vault.saves && typeof vault.saves === 'object' ? vault.saves : {}
    };
  }

  writeVault(vault) {
    this.writeLocal(VAULT_KEY, JSON.stringify(vault));
    this.writeLocal(MANIFEST_CACHE_KEY, JSON.stringify(vault.manifest));
    Object.entries(vault.saves || {}).forEach(([id, save]) => {
      this.writeLocal(SAVE_CACHE_PREFIX + id, JSON.stringify(save));
    });
  }

  readCachedManifest() {
    try { return sanitizeManifest(JSON.parse(this.readLocal(MANIFEST_CACHE_KEY) || '{}')); } catch { return blankManifest(); }
  }

  readCacheSave(id) {
    try { return JSON.parse(this.readLocal(SAVE_CACHE_PREFIX + id) || 'null'); } catch { return null; }
  }

  readLegacyProgress() {
    try { return JSON.parse(this.readLocal(LEGACY_KEY) || 'null'); } catch { return null; }
  }

  ensureWritable() {
    if (this.mode === 'fs' && this.needsPermission) {
      throw new Error('Conecta la carpeta datasave para poder guardar.');
    }
  }

  async readManifest() {
    if (this.mode === 'fs' && !this.needsPermission) {
      const handle = await this.directory.getFileHandle(MANIFEST_FILE, { create: true });
      const text = await (await handle.getFile()).text();
      if (!text.trim()) return blankManifest();
      return sanitizeManifest(JSON.parse(text));
    }
    if (this.mode === 'fs') return this.readCachedManifest();
    return this.readVault().manifest;
  }

  async writeManifest(manifest) {
    const clean = sanitizeManifest(manifest);
    if (this.mode === 'fs') {
      await this.writeTextFile(MANIFEST_FILE, JSON.stringify(clean, null, 2));
    }
    const vault = this.readVault();
    vault.manifest = clean;
    this.writeVault(vault);
    this.manifest = clean;
  }

  async writeTextFile(name, text) {
    const handle = await this.directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  async readSave(account) {
    if (!account) return null;
    if (this.mode === 'fs' && !this.needsPermission) {
      try {
        const handle = await this.directory.getFileHandle(account.file, { create: true });
        const text = await (await handle.getFile()).text();
        if (text.trim()) return JSON.parse(text);
      } catch { /* se cae al caché local */ }
    }
    if (this.mode === 'fallback') {
      const stored = this.readVault().saves[account.id];
      if (stored) return stored;
    }
    return this.readCacheSave(account.id);
  }

  async writeSave(account, save) {
    const payload = { ...blankSave(account), ...save, version: FORMAT_VERSION, id: account.id, nickname: account.nickname };
    if (this.mode === 'fs') await this.writeTextFile(account.file, JSON.stringify(payload, null, 2));
    const vault = this.readVault();
    vault.saves[account.id] = payload;
    this.writeVault(vault);
    this.writeLocal(SAVE_CACHE_PREFIX + account.id, JSON.stringify(payload));
    return payload;
  }

  async reload() {
    this.manifest = await this.readManifest().catch(() => this.readCachedManifest());
    const active = this.manifest.accounts.find(a => a.id === this.manifest.activeId) || null;
    const writable = !(this.mode === 'fs' && this.needsPermission);
    if (active && writable) {
      this.current = active;
      this.currentSave = await this.readSave(active);
    } else {
      this.current = null;
      this.currentSave = null;
    }
    return this.manifest;
  }

  // ---------- Conexión de carpeta ----------

  async connectFolder() {
    if (!this.supportsFs) return { ok: false, error: 'Este navegador no permite elegir carpetas. Se usa el datasave del navegador.' };
    try {
      const handle = await window.showDirectoryPicker({ id: 'overclock9-datasave', mode: 'readwrite', startIn: 'documents' });
      this.directory = handle;
      this.mode = 'fs';
      this.needsPermission = false;
      await idbSet(HANDLE_KEY, handle);
      await this.reload();
      return { ok: true, name: handle.name };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, error: 'Selección de carpeta cancelada.' };
      return { ok: false, error: err?.message || 'No se pudo abrir la carpeta datasave.' };
    }
  }

  async grantFolder() {
    if (!this.directory) return this.connectFolder();
    try {
      const permission = await this.directory.requestPermission?.({ mode: 'readwrite' }) || 'denied';
      if (permission !== 'granted') throw new Error('Permiso de carpeta denegado.');
      this.needsPermission = false;
      await this.reload();
      return { ok: true, name: this.directory.name };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, error: 'Permiso cancelado.' };
      return { ok: false, error: err?.message || 'No se pudo conectar la carpeta datasave.' };
    }
  }

  // ---------- Cuentas ----------

  findByNickname(nickname) {
    const key = normalizeNickname(nickname).toLocaleLowerCase('es');
    return this.manifest.accounts.find(a => a.nickname.toLocaleLowerCase('es') === key) || null;
  }

  listAccounts() {
    return (this.manifest?.accounts || []).map(a => ({ ...a }));
  }

  getAccount(id) {
    const account = (this.manifest?.accounts || []).find(a => a.id === id);
    return account ? { ...account } : null;
  }

  async register(nickname, password, options = {}) {
    const valid = validateCredentials(nickname, password);
    if (!valid.ok) throw new Error(valid.error);
    return this.enqueue(async () => {
      this.ensureWritable();
      const manifest = await this.readManifest();
      if (manifest.accounts.some(a => a.nickname.toLocaleLowerCase('es') === valid.nickname.toLocaleLowerCase('es'))) {
        throw new Error('Ese nombre ya está vinculado. Entra con tu contraseña.');
      }
      const id = globalThis.crypto?.randomUUID?.() || `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const account = {
        id,
        nickname: valid.nickname,
        hash: await hashPassword(valid.password),
        color: sanitizeColor(options.color, PALETTE[manifest.accounts.length % PALETTE.length]),
        photo: options.photo == null ? null : parseAvatar(options.photo),
        file: `u_${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.json`,
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString()
      };
      manifest.accounts.push(account);
      manifest.activeId = id;
      await this.writeManifest(manifest);
      const legacy = manifest.accounts.length === 1 ? this.readLegacyProgress() : null;
      const save = await this.writeSave(account, blankSave(account, legacy));
      this.current = account;
      this.currentSave = save;
      return { account, save };
    });
  }

  async login(nickname, password) {
    const valid = validateCredentials(nickname, password);
    if (!valid.ok) throw new Error(valid.error);
    return this.enqueue(async () => {
      this.ensureWritable();
      const manifest = await this.readManifest();
      const account = manifest.accounts.find(
        a => a.nickname.toLocaleLowerCase('es') === valid.nickname.toLocaleLowerCase('es')
      );
      if (!account) throw new Error('No hay ninguna cuenta con ese nombre.');
      if (!await verifyPassword(valid.password, account.hash)) throw new Error('Contraseña incorrecta.');
      manifest.activeId = account.id;
      account.lastPlayed = new Date().toISOString();
      await this.writeManifest(manifest);
      let save = await this.readSave(account);
      if (!save) save = await this.writeSave(account, blankSave(account, this.readLegacyProgress()));
      this.current = account;
      this.currentSave = save;
      return { account, save };
    });
  }

  /**
   * Actualiza nombre, color, foto y/o contraseña de una cuenta.
   * La contraseña actual se exige para cualquier cambio (CRUD local protegido).
   * `photo: null` quita la foto; `undefined` conserva la existente.
   */
  async updateAccount(id, changes = {}, password) {
    return this.enqueue(async () => {
      this.ensureWritable();
      const manifest = await this.readManifest();
      const account = manifest.accounts.find(a => a.id === id);
      if (!account) throw new Error('No existe esa cuenta.');
      if (!await verifyPassword(password, account.hash)) throw new Error('Contraseña incorrecta.');

      const patch = {};
      if (changes.nickname !== undefined) {
        const valid = validateNickname(changes.nickname);
        if (!valid.ok) throw new Error(valid.error);
        const taken = manifest.accounts.some(
          a => a.id !== id && a.nickname.toLocaleLowerCase('es') === valid.nickname.toLocaleLowerCase('es')
        );
        if (taken) throw new Error('Ese nombre ya está vinculado a otra cuenta.');
        patch.nickname = valid.nickname;
      }
      if (changes.color !== undefined) patch.color = sanitizeColor(changes.color, account.color);
      if (changes.photo !== undefined) {
        patch.photo = changes.photo == null || changes.photo === '' ? null : parseAvatar(changes.photo);
      }
      if (changes.password !== undefined && changes.password !== '') {
        if (typeof changes.password !== 'string' || changes.password.length < CREDENTIAL_RULES.passwordMin) {
          throw new Error(`La contraseña debe tener al menos ${CREDENTIAL_RULES.passwordMin} caracteres.`);
        }
        patch.hash = await hashPassword(changes.password);
      }

      Object.assign(account, patch, { updatedAt: new Date().toISOString() });
      await this.writeManifest(manifest);
      const saved = await this.writeSave(account, {
        ...(await this.readSave(account) || blankSave(account)),
        nickname: account.nickname
      });

      const clean = this.manifest.accounts.find(a => a.id === id) || account;
      if (this.current?.id === id) {
        this.current = clean;
        this.currentSave = saved;
      }
      return { account: clean, save: saved };
    });
  }

  /** Elimina la cuenta, su archivo de partida y sus cachés. Requiere contraseña. */
  async deleteAccount(id, password) {
    return this.enqueue(async () => {
      this.ensureWritable();
      const manifest = await this.readManifest();
      const account = manifest.accounts.find(a => a.id === id);
      if (!account) throw new Error('No existe esa cuenta.');
      if (!await verifyPassword(password, account.hash)) throw new Error('Contraseña incorrecta.');

      manifest.accounts = manifest.accounts.filter(a => a.id !== id);
      if (manifest.activeId === id) manifest.activeId = null;
      await this.writeManifest(manifest);

      if (this.mode === 'fs' && this.directory) {
        try { await this.directory.removeEntry(account.file); } catch { /* el archivo ya no existe */ }
      }
      const vault = this.readVault();
      delete vault.saves[id];
      this.writeVault(vault);
      this.removeLocal(SAVE_CACHE_PREFIX + id);

      if (this.current?.id === id) {
        this.current = null;
        this.currentSave = null;
      }
      return { id, nickname: account.nickname };
    });
  }

  async saveCurrent(data = {}) {
    if (!this.current) return false;
    return this.enqueue(async () => {
      const manifest = await this.readManifest();
      const account = manifest.accounts.find(a => a.id === this.current.id);
      if (!account) return false;
      manifest.activeId = account.id;
      account.nickname = this.current.nickname;
      account.lastPlayed = new Date().toISOString();
      await this.writeManifest(manifest);
      const previous = this.currentSave || await this.readSave(account) || blankSave(account);
      const save = await this.writeSave(account, {
        ...previous,
        ...data,
        savedAt: new Date().toISOString()
      });
      this.manifest = manifest;
      this.current = account;
      this.currentSave = save;
      return true;
    });
  }

  async logout() {
    return this.enqueue(async () => {
      if (this.manifest.activeId) {
        const manifest = await this.readManifest();
        manifest.activeId = null;
        await this.writeManifest(manifest);
      }
      this.current = null;
      this.currentSave = null;
    });
  }
}
