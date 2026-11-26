'use strict';

// Persistencia del tamaño y la posición de la ventana.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { width: 1280, height: 800, x: null, y: null, maximized: false };

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readWindowState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeWindowState(state) {
  const file = stateFile();
  const temp = `${file}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temp, file);
  } catch {
    try { fs.rmSync(temp, { force: true }); } catch { /* sin permisos: no es crítico */ }
  }
}

module.exports = { readWindowState, writeWindowState };
