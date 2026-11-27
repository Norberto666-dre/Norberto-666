// Usuario de pruebas para QA local. Sus credenciales NO se versionan:
// se leen desde local/test-user.local.mjs (carpeta ignorada por .gitignore).
// Si no existe esa configuración, el juego arranca normalmente sin usuario de pruebas.

let configPromise;

async function loadTestUserConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      try {
        const module = await import('../local/test-user.local.mjs');
        const config = module.default || module.TEST_USER;
        if (!config || typeof config.nickname !== 'string' || typeof config.password !== 'string') return null;
        return {
          nickname: config.nickname,
          password: config.password,
          credits: Number(config.credits) || 0,
          color: typeof config.color === 'string' ? config.color : '#ffcc00'
        };
      } catch {
        return null;
      }
    })();
  }
  return configPromise;
}

export async function ensureTestUser(accounts, config = null) {
  const user = config || await loadTestUserConfig();
  if (!user || !Number.isFinite(user.credits) || user.credits <= 0) return null;
  try {
    const existing = accounts.listAccounts().find(a =>
      a.nickname.toLocaleLowerCase('es') === user.nickname.toLocaleLowerCase('es')
    );
    if (existing) {
      // Asegurar créditos de prueba sin sobrescribir otro progreso del usuario.
      const save = await accounts.readSave(existing) || {};
      const progress = save.progress || {};
      if (Number(progress.credits) !== user.credits) {
        progress.credits = user.credits;
        await accounts.writeSave(existing, { ...save, progress });
      }
      accounts.current = existing;
      accounts.currentSave = { ...save, progress };
      return { account: existing, created: false };
    }

    const { account, save } = await accounts.register(
      user.nickname,
      user.password,
      { color: user.color }
    );
    const progress = save.progress || {};
    progress.credits = user.credits;
    await accounts.writeSave(account, { ...save, progress });
    accounts.current = account;
    accounts.currentSave = { ...save, progress };
    return { account, created: true };
  } catch (err) {
    console.warn('[test-user] No se pudo crear el usuario de pruebas:', err.message);
    return null;
  }
}
