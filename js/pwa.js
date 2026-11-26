// PWA de OVERCLOCK 9: registro del service worker y botón de instalación.
// En la app de escritorio (Electron) no se registra nada: no hace falta y no aplica.

const state = {
  installable: false,
  installed: false,
  updateReady: false,
  registration: false,
  error: null
};

let deferredPrompt = null;
let updateRegistration = null;
let reloading = false;

const isDesktop = () => !!globalThis.overclock?.isDesktop;

function isStandalone() {
  return globalThis.matchMedia?.('(display-mode: standalone)').matches === true ||
    globalThis.navigator?.standalone === true;
}

function isSecure() {
  return globalThis.isSecureContext === true ||
    location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);
}

function announce(message) {
  const live = document.getElementById('pwa-status');
  if (live) live.textContent = message;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function needsManualGuide() {
  return isIosSafari();
}

function refreshInstallButtons() {
  const visible = !isStandalone() && !state.installed && (!!deferredPrompt || needsManualGuide());
  state.installable = visible;
  document.querySelectorAll('.install-btn').forEach((button) => {
    button.classList.toggle('hidden', !visible);
    button.dataset.mode = deferredPrompt ? 'prompt' : 'guide';
    const label = button.querySelector('.install-label');
    if (label) label.textContent = deferredPrompt ? 'INSTALAR APP' : 'CÓMO INSTALAR';
  });
}

function guideSteps() {
  if (isIosSafari()) {
    return [
      'Toca el botón <strong>Compartir</strong> de Safari.',
      'Elige <strong>Añadir a pantalla de inicio</strong>.',
      'Confirma con <strong>Añadir</strong>. El juego abrirá sin barra del navegador.'
    ];
  }
  const android = /Android/i.test(navigator.userAgent);
  if (android) {
    return [
      'Abre el menú <strong>⋮</strong> de Chrome.',
      'Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.',
      'Confirma la instalación.'
    ];
  }
  return [
    'Busca el icono de <strong>instalación</strong> en la barra de direcciones de Chrome o Edge.',
    'O abre el menú del navegador y elige <strong>Instalar OVERCLOCK 9</strong>.',
    'Si no aparece, el navegador aún no considera la app instalable: recarga y espera unos segundos.'
  ];
}

function openGuide() {
  let overlay = document.getElementById('pwa-guide');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pwa-guide';
    overlay.className = 'overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'pwa-guide-title');
    overlay.innerHTML = `
      <div class="pause-box guide-box">
        <div class="pause-title" id="pwa-guide-title">INSTALAR EN EL DISPOSITIVO</div>
        <ol class="guide-steps"></ol>
        <div class="pause-actions">
          <button type="button" class="btn btn-primary" id="pwa-guide-close">ENTENDIDO</button>
        </div>
      </div>`;
    document.getElementById('app').appendChild(overlay);
    const close = () => {
      overlay.classList.add('hidden');
      if (opener && typeof opener.focus === 'function') opener.focus();
      opener = null;
    };
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('#pwa-guide-close').addEventListener('click', close);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = [...overlay.querySelectorAll('button')].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  const list = overlay.querySelector('.guide-steps');
  list.innerHTML = guideSteps().map((step) => `<li>${step}</li>`).join('');
  opener = document.activeElement;
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.querySelector('#pwa-guide-close')?.focus());
}

let opener = null;

async function requestInstall() {
  if (deferredPrompt) {
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      prompt.prompt();
      const choice = await prompt.userChoice;
      announce(choice?.outcome === 'accepted' ? 'Instalando OVERCLOCK 9.' : 'Instalación cancelada.');
    } catch {
      announce('El navegador no permitió abrir la instalación.');
    }
    refreshInstallButtons();
    return;
  }
  openGuide();
}

function showUpdateBanner(registration) {
  updateRegistration = registration;
  state.updateReady = true;
  let banner = document.getElementById('pwa-update');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'pwa-update';
    banner.className = 'pwa-update hidden';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <span>NUEVA VERSIÓN DISPONIBLE</span>
      <button type="button" class="btn btn-primary" id="pwa-update-reload">RECARGAR</button>
      <button type="button" class="pwa-update-later" id="pwa-update-later" aria-label="Recordar más tarde">×</button>`;
    document.getElementById('app').appendChild(banner);
    banner.querySelector('#pwa-update-reload').addEventListener('click', () => {
      const worker = updateRegistration?.waiting;
      announce('Actualizando OVERCLOCK 9.');
      if (worker) worker.postMessage('skip-waiting');
      else location.reload();
    });
    banner.querySelector('#pwa-update-later').addEventListener('click', () => {
      banner.classList.add('hidden');
    });
  }
  banner.classList.remove('hidden');
  announce('Nueva versión disponible. Pulsa recargar cuando termines la partida.');
}

async function unregister() {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const keys = await caches?.keys?.() || [];
    await Promise.all(keys.map((key) => caches.delete(key)));
    state.registration = false;
  } catch { /* limpieza best-effort */ }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then((registration) => {
      state.registration = true;
      if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(registration);
        });
      });
      const check = () => registration.update().catch(() => {});
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    })
    .catch((error) => { state.error = String(error); });
}

export function initPWA() {
  globalThis.__OVERCLOCK_PWA = state;
  if (isDesktop()) return;

  if (!document.getElementById('pwa-status')) {
    const live = document.createElement('div');
    live.id = 'pwa-status';
    live.className = 'sr-only';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
  }

  document.querySelectorAll('.install-btn').forEach((button) => {
    button.addEventListener('click', requestInstall);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    state.installable = true;
    refreshInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    state.installed = true;
    refreshInstallButtons();
    announce('OVERCLOCK 9 instalado. Ya puedes abrirlo desde tu dispositivo.');
  });
  globalThis.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', refreshInstallButtons);
  refreshInstallButtons();

  if (new URLSearchParams(location.search).has('nosw')) {
    unregister();
    return;
  }
  if (!isSecure()) return;

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }
  registerServiceWorker();
}
