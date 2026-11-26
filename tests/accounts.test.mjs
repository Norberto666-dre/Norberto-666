import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AccountManager,
  blankManifest,
  hashPassword,
  normalizeAvatar,
  normalizeNickname,
  parseAvatar,
  sanitizeManifest,
  validateCredentials,
  validateNickname,
  verifyPassword
} from '../js/accounts.js';

function installStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    clear: () => map.clear()
  };
  return map;
}

test('Nombre: se normaliza y valida con reglas mínimas', () => {
  assert.equal(normalizeNickname('  Nora  666  '), 'Nora 666');
  assert.equal(validateCredentials('Nora 666', 'clave123').ok, true);
  assert.equal(validateCredentials('No', 'clave123').ok, false);
  assert.equal(validateCredentials('Nora', 'corta').ok, false);
  assert.equal(validateCredentials('Nora<script>', 'clave123').ok, false);
});

test('Contraseña: PBKDF2 con salt distinto y verificación constante', async () => {
  const first = await hashPassword('clave123');
  const second = await hashPassword('clave123');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.digest, second.digest);
  assert.equal(await verifyPassword('clave123', first), true);
  assert.equal(await verifyPassword('clave456', first), false);
  assert.equal(await verifyPassword('clave123', {}), false);
});

test('Manifest: se sanea y conserva solo cuentas válidas', () => {
  const raw = {
    activeId: 'u2',
    accounts: [
      { id: 'u1', nickname: 'Nora', hash: { salt: 'AAA', digest: 'BBB' } },
      { id: 'bad', nickname: 'x' },
      { id: 'u2', nickname: 'Hex', hash: { salt: 'CCC', digest: 'DDD' } }
    ]
  };
  const clean = sanitizeManifest(raw);
  assert.equal(clean.accounts.length, 2);
  assert.equal(clean.activeId, 'u2');
  assert.deepEqual(blankManifest(), { version: 1, accounts: [], activeId: null });
});

const TEST_PNG = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')}`;

test('Foto de perfil: solo data URLs de imagen pequeñas y con firma válida', () => {
  assert.equal(normalizeAvatar(TEST_PNG), TEST_PNG);
  assert.equal(normalizeAvatar('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(normalizeAvatar('data:image/png;base64,YWJj'), null);
  assert.equal(normalizeAvatar('javascript:alert(1)'), null);
  assert.equal(normalizeAvatar(null), null);
  assert.equal(parseAvatar(TEST_PNG), TEST_PNG);
  assert.throws(() => parseAvatar('data:image/png;base64,YWJj'), /foto debe ser/);
});

test('Nombre: se valida también al editar una cuenta', () => {
  assert.deepEqual(validateNickname('  Nora 2 '), { ok: true, nickname: 'Nora 2' });
  assert.equal(validateNickname('x').ok, false);
});

test('Cuentas: registro, inicio de sesión y nombres duplicados', async () => {
  installStorage();
  const manager = new AccountManager();
  await manager.init();

  const { account } = await manager.register('Nora 666', 'clave123');
  assert.equal(account.nickname, 'Nora 666');
  assert.equal(manager.manifest.accounts.length, 1);
  assert.equal(manager.manifest.activeId, account.id);
  assert.ok(account.file.endsWith('.json'));

  await assert.rejects(() => manager.register('nora 666', 'otra123'), /ya está vinculado/);
  await assert.rejects(() => manager.login('Nora 666', 'incorrecta'), /Contraseña incorrecta/);
  await assert.rejects(() => manager.login('Fantasma', 'clave123'), /No hay ninguna cuenta/);

  const { account: relogin } = await manager.login('  NORA 666 ', 'clave123');
  assert.equal(relogin.id, account.id);
});

test('CRUD: editar nombre, color, foto y contraseña con la clave actual', async () => {
  installStorage();
  const manager = new AccountManager();
  await manager.init();
  const { account } = await manager.register('Nora', 'clave123', { photo: TEST_PNG, color: '#ff0000' });
  assert.equal(account.photo, TEST_PNG);
  assert.equal(manager.getAccount(account.id).nickname, 'Nora');
  assert.equal(manager.listAccounts().length, 1);

  await assert.rejects(() => manager.updateAccount(account.id, { nickname: 'Hex' }, 'mala'), /Contraseña incorrecta/);

  const { account: updated, save } = await manager.updateAccount(account.id, {
    nickname: 'Nora 2', color: '#ABCDEF', photo: null, password: 'nueva123'
  }, 'clave123');
  assert.equal(updated.nickname, 'Nora 2');
  assert.equal(updated.color, '#abcdef');
  assert.equal(updated.photo, null);
  assert.equal(save.nickname, 'Nora 2');
  assert.ok(updated.updatedAt);

  await assert.rejects(() => manager.login('Nora 2', 'clave123'), /Contraseña incorrecta/);
  await manager.login('Nora 2', 'nueva123');

  const { account: other } = await manager.register('Hex', 'clave123');
  await assert.rejects(
    () => manager.updateAccount(other.id, { nickname: 'nora 2' }, 'clave123'),
    /ya está vinculado/
  );
});

test('CRUD: eliminar cuenta borra su partida, caché y sesión activa', async () => {
  const map = installStorage();
  const manager = new AccountManager();
  await manager.init();
  await manager.register('Nora', 'clave123');
  const { account } = await manager.register('Hex', 'clave123');
  await manager.saveCurrent({ progress: { credits: 42 } });

  await assert.rejects(() => manager.deleteAccount(account.id, 'mala'), /Contraseña incorrecta/);
  const removed = await manager.deleteAccount(account.id, 'clave123');
  assert.equal(removed.nickname, 'Hex');
  assert.equal(manager.getAccount(account.id), null);
  assert.equal(manager.listAccounts().length, 1);
  assert.equal(manager.manifest.activeId, null);
  assert.equal(manager.canPlay(), false);
  assert.equal(map.has(`overclock9_save_cache_${account.id}`), false);
  assert.equal(map.get('overclock9_datasave_vault').includes(account.id), false);
});

test('Partida: progreso y run se guardan por usuario y sobreviven al reinicio', async () => {
  const map = installStorage({
    overclock9_progress: JSON.stringify({ credits: 77, bestScore: 1234 })
  });
  let manager = new AccountManager();
  await manager.init();
  const { account, save } = await manager.register('Hex', 'clave123');
  assert.equal(save.progress.credits, 77, 'la primera cuenta hereda el progreso legacy');

  const progress = { credits: 250, bestScore: 9000, sector: 3 };
  const runState = { cyclesDone: 4, voltageTier: 2 };
  await manager.saveCurrent({ progress, runState, lastOptions: { board: '4x3' }, sectorCleared: 1 });

  manager = new AccountManager();
  await manager.init();
  assert.equal(manager.canPlay(), true);
  assert.equal(manager.current.id, account.id);
  assert.equal(manager.currentSave.progress.credits, 250);
  assert.equal(manager.currentSave.runState.cyclesDone, 4);
  assert.equal(manager.currentSave.lastOptions.board, '4x3');

  await manager.logout();
  assert.equal(manager.canPlay(), false);
  assert.equal(manager.manifest.activeId, null);
  assert.equal(manager.manifest.accounts.length, 1, 'la cuenta sigue vinculada para el launcher');

  manager = new AccountManager();
  await manager.init();
  assert.equal(manager.canPlay(), false);
  assert.equal(manager.manifest.accounts[0].nickname, 'Hex');
  assert.ok(map.has('overclock9_datasave_vault'));
});
