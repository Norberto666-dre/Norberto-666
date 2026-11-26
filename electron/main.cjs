'use strict';

// Proceso principal de OVERCLOCK 9 para escritorio.
// Sirve el juego con un esquema propio `app://overclock9/` para que los módulos ES,
// localStorage e IndexedDB tengan un origen seguro y estable (file:// los rompe).

const {
  app, BrowserWindow, Menu, clipboard, dialog, ipcMain, protocol, screen, shell
} = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { readWindowState, writeWindowState } = require('./store.cjs');

const SCHEME = 'app';
const HOST = 'overclock9';
const ORIGIN = `${SCHEME}://${HOST}`;
const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, 'icons', 'icon.png');

const isSmoke = process.env.OVERCLOCK_SMOKE === '1';
const isDev = process.env.OVERCLOCK_DEV === '1' || !app.isPackaged;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function windowErrors(win, errors) {
  win.webContents.on('console-message', (event) => {
    const level = String(event?.level || 'info').toLowerCase();
    const message = String(event?.message || '');
    if (!message) return;
    if (level === 'error') {
      errors.push(message);
      console.log(`[renderer:error] ${message}`);
    } else if (isSmoke) {
      console.log(`[renderer:${level}] ${message}`);
    }
  });
  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    errors.push(`did-fail-load ${code} ${description} ${url}`);
    console.log(`[main] fallo de carga ${code} ${description} ${url}`);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    errors.push(`render-process-gone ${details?.reason || 'desconocido'}`);
    console.log(`[main] el renderer se cerró: ${details?.reason || 'desconocido'}`);
  });
}

async function serveAsset(request) {
  let url;
  try { url = new URL(request.url); } catch { return new Response('Petición inválida', { status: 400 }); }
  if (url.host !== HOST) return new Response('No encontrado', { status: 404 });

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Ruta inválida', { status: 400 }); }
  if (!pathname || pathname === '/') pathname = '/index.html';

  const filePath = path.join(ROOT, pathname.replace(/^[/\\]+/, ''));
  const relative = path.relative(ROOT, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return new Response('Prohibido', { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-cache'
      }
    });
  } catch {
    return new Response('No encontrado', { status: 404 });
  }
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeBounds(state) {
  const width = clamp(state.width, 960, 10000);
  const height = clamp(state.height, 640, 10000);
  const bounds = { width, height };
  const override = process.env.OVERCLOCK_SIZE;
  if (/^\d{3,4}x\d{3,4}$/.test(override || '')) {
    const [w, h] = override.split('x').map(Number);
    bounds.width = clamp(w, 960, 3840);
    bounds.height = clamp(h, 640, 2160);
    return bounds;
  }
  const displays = screen.getAllDisplays();
  const x = Number(state.x);
  const y = Number(state.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    const visible = displays.some((display) => {
      const area = display.workArea;
      return x >= area.x - 40 && x < area.x + area.width - 120 &&
        y >= area.y - 20 && y < area.y + area.height - 120;
    });
    if (visible) {
      bounds.x = Math.round(x);
      bounds.y = Math.round(y);
    }
  }
  return bounds;
}

function registerIpc() {
  ipcMain.handle('clipboard:write', (_event, text) => {
    clipboard.writeText(String(text ?? ''));
    return true;
  });

  ipcMain.handle('datasave:export', async (_event, json) => {
    const win = BrowserWindow.getFocusedWindow();
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar datasave de OVERCLOCK 9',
      defaultPath: path.join(app.getPath('documents'), `overclock9-datasave-${stamp}.json`),
      filters: [{ name: 'Datasave OVERCLOCK 9', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      await fs.writeFile(result.filePath, String(json ?? ''), 'utf8');
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('datasave:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Importar datasave de OVERCLOCK 9',
      properties: ['openFile'],
      filters: [{ name: 'Datasave OVERCLOCK 9', extensions: ['json'] }]
    });
    if (result.canceled || !result.filePaths?.length) return { ok: false, canceled: true };
    try {
      const file = result.filePaths[0];
      const stats = await fs.stat(file);
      if (stats.size > 8 * 1024 * 1024) return { ok: false, error: 'El archivo supera 8 MB.' };
      return { ok: true, data: await fs.readFile(file, 'utf8') };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('datasave:reveal', async () => {
    await shell.openPath(app.getPath('userData'));
    return true;
  });

  ipcMain.handle('window:fullscreen', (event, value) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const next = typeof value === 'boolean' ? value : !win.isFullScreen();
    win.setFullScreen(next);
    return next;
  });
}

function buildMenu(win) {
  const template = [
    {
      label: 'Juego',
      submenu: [
        {
          label: 'Pantalla completa',
          accelerator: 'F11',
          click: () => win.setFullScreen(!win.isFullScreen())
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }] : [])
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Abrir carpeta de datos',
          click: () => { shell.openPath(app.getPath('userData')); }
        },
        { type: 'separator' },
        {
          label: 'Acerca de OVERCLOCK 9',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'OVERCLOCK 9',
              message: `OVERCLOCK 9 ${app.getVersion()}`,
              detail: 'Arcade de reflejos. Versión de escritorio.',
              buttons: ['Cerrar']
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function watchGameFiles(win) {
  let timer = null;
  const reload = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.reloadIgnoringCache();
    }, 250);
  };
  for (const target of [join(ROOT, 'js'), join(ROOT, 'css'), join(ROOT, 'index.html')]) {
    try {
      fsSync.watch(target, { recursive: true }, reload);
    } catch (error) {
      console.log(`[watch] no se pudo vigilar ${path.basename(target)}: ${error.message}`);
    }
  }
  console.log('[watch] cambios en index.html, css/ y js/ recargan la ventana');
}

function createWindow() {
  const state = readWindowState();
  const bounds = sanitizeBounds(state);
  const errors = [];

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#05050a',
    title: 'OVERCLOCK 9',
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      devTools: isDev
    }
  });

  windowErrors(win, errors);

  win.once('ready-to-show', () => {
    if (state.maximized) win.maximize();
    win.show();
  });

  let saveTimer = null;
  const persist = () => {
    if (win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    const area = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    writeWindowState({ ...area, maximized: win.isMaximized() });
  };
  const schedulePersist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  };
  win.on('resize', schedulePersist);
  win.on('move', schedulePersist);
  win.on('maximize', schedulePersist);
  win.on('unmaximize', schedulePersist);
  win.on('close', () => { clearTimeout(saveTimer); persist(); });

  // El juego no navega fuera de su propio origen; los enlaces externos abren el navegador.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

  win.loadURL(`${ORIGIN}/`);
  buildMenu(win);

  if (process.env.OVERCLOCK_WATCH === '1') watchGameFiles(win);

  const shot = process.env.OVERCLOCK_SHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          const file = path.resolve(shot);
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file, image.toPNG());
          console.log(`[smoke] captura guardada en ${file}`);
        } catch (error) {
          console.error('[smoke] no se pudo capturar la pantalla:', error);
        }
      }, 2000);
    });
  }

  // Guion de QA opcional: se ejecuta dentro de la página para probar flujos reales.
  const qaScript = process.env.OVERCLOCK_QA_SCRIPT;
  if (qaScript) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const code = await fs.readFile(path.resolve(qaScript), 'utf8');
          const result = await win.webContents.executeJavaScript(code, true);
          console.log('[qa] guion completado:', JSON.stringify(result));
          if (shot) {
            const image = await win.webContents.capturePage();
            const file = path.resolve(shot);
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, image.toPNG());
            console.log(`[qa] captura guardada en ${file}`);
          }
        } catch (error) {
          console.error('[qa] error en el guion:', error);
        }
      }, 1600);
    });
  }

  if (isSmoke) {
    const started = Date.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (errors.length) {
        console.error(`[smoke] FALLÓ con ${errors.length} error(es) de consola`);
        app.exit(1);
        return;
      }
      console.log('[smoke] OK: sin errores de consola');
      app.exit(0);
    };
    win.webContents.once('did-finish-load', () => {
      console.log(`[smoke] juego cargado en ${Date.now() - started} ms`);
      // El portable puede tardar en extraerse: la vigilancia empieza tras la carga.
      setTimeout(finish, 7000);
    });
    setTimeout(() => {
      errors.push('timeout de carga en la prueba de humo');
      finish();
    }, 45000);
  }

  return win;
}

function bootstrap() {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, serveAsset);
    registerIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    console.error('[main] no se pudo iniciar:', error);
    app.exit(1);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  process.on('uncaughtException', (error) => {
    console.error('[main] excepción no controlada:', error);
    if (isSmoke) app.exit(1);
  });
  process.on('unhandledRejection', (error) => {
    console.error('[main] promesa rechazada:', error);
    if (isSmoke) app.exit(1);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  bootstrap();
}
