// Integración específica de la app de escritorio (Electron).
// Todo lo de aquí se activa solo cuando existe `window.overclock`.

function allLocalStorage() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key != null) data[key] = localStorage.getItem(key);
    }
  } catch { /* almacenamiento bloqueado */ }
  return data;
}

function setStatus(message) {
  const live = document.getElementById('pwa-status') || document.getElementById('a11y-live');
  if (live) live.textContent = message;
}

export function initDesktop({ game, ui, audio }) {
  const bridge = globalThis.overclock;
  if (!bridge?.isDesktop) return;

  document.documentElement.classList.add('desktop-app');

  // --- Pausa automática al perder el foco: nunca se pierde una partida por Alt+Tab.
  let blurTimer = 0;
  window.addEventListener('blur', () => {
    clearTimeout(blurTimer);
    if (game.screen !== 'playing') return;
    blurTimer = setTimeout(() => {
      if (!document.hasFocus() && game.screen === 'playing') ui.pauseAndSave();
    }, 350);
  });
  window.addEventListener('focus', () => clearTimeout(blurTimer));

  // --- Atajos de teclado propios del escritorio.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'm') {
      const box = document.getElementById('setting-audio');
      if (!box) return;
      event.preventDefault();
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      setStatus(box.checked ? 'Audio activado.' : 'Audio silenciado.');
    } else if (key === 'f') {
      event.preventDefault();
      bridge.setFullscreen();
    }
  });

  // --- Exportar / importar datasave con diálogos nativos.
  const panel = document.getElementById('desktop-datasave');
  if (panel) panel.classList.remove('hidden');

  const exportBtn = document.getElementById('btn-datasave-export');
  const importBtn = document.getElementById('btn-datasave-import');
  const revealBtn = document.getElementById('btn-datasave-reveal');

  exportBtn?.addEventListener('click', async () => {
    const payload = {
      app: 'overclock9',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: allLocalStorage()
    };
    exportBtn.disabled = true;
    try {
      const result = await bridge.exportDatasave(JSON.stringify(payload, null, 2));
      if (result?.ok) setStatus('Datasave exportado correctamente.');
      else if (!result?.canceled) setStatus('No se pudo exportar el datasave.');
    } finally {
      exportBtn.disabled = false;
    }
  });

  importBtn?.addEventListener('click', async () => {
    if (!confirm('Esto reemplaza las cuentas y partidas de este equipo. ¿Continuar?')) return;
    importBtn.disabled = true;
    try {
      const result = await bridge.importDatasave();
      if (!result?.ok) {
        if (!result?.canceled) setStatus('No se pudo leer el archivo.');
        return;
      }
      let parsed;
      try { parsed = JSON.parse(result.data); } catch { parsed = null; }
      if (!parsed || parsed.app !== 'overclock9' || typeof parsed.data !== 'object' || !parsed.data) {
        setStatus('El archivo no es un datasave válido de OVERCLOCK 9.');
        return;
      }
      const keys = Object.keys(parsed.data);
      if (keys.length > 5000) {
        setStatus('El datasave contiene demasiadas entradas.');
        return;
      }
      localStorage.clear();
      for (const key of keys) {
        const value = parsed.data[key];
        if (typeof value === 'string') localStorage.setItem(key, value);
      }
      location.reload();
    } finally {
      importBtn.disabled = false;
    }
  });

  revealBtn?.addEventListener('click', () => { bridge.revealDatasave(); });

  // Si el usuario silencia con M, el ajuste visual debe reflejarlo aunque ya estuviera abierto.
  window.addEventListener('storage', () => {
    const box = document.getElementById('setting-audio');
    if (box && audio) box.checked = audio.enabled !== false;
  });
}
