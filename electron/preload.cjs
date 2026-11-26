'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// API mínima y explícita. El renderer no tiene acceso a Node ni al sistema de archivos:
// todo pasa por el proceso principal con diálogos nativos y validación.
contextBridge.exposeInMainWorld('overclock', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },
  copyMetrics: (text) => ipcRenderer.invoke('clipboard:write', text),
  exportDatasave: (json) => ipcRenderer.invoke('datasave:export', json),
  importDatasave: () => ipcRenderer.invoke('datasave:import'),
  revealDatasave: () => ipcRenderer.invoke('datasave:reveal'),
  setFullscreen: (value) => ipcRenderer.invoke('window:fullscreen', value)
});
