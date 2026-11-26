// Configuración del tablero online. Déjalo vacío para usar solo la tabla offline.
// También se puede sobrescribir en localStorage con la clave overclock9_online_config:
// { "leaderboardUrl": "https://tu-servicio/daily", "token": "opcional", "timeoutMs": 5000 }
export const ONLINE_CONFIG = Object.freeze({
  leaderboardUrl: '',
  token: '',
  timeoutMs: 5000
});

export function onlineConfig() {
  let runtime = {};
  try {
    runtime = JSON.parse(globalThis.localStorage?.getItem('overclock9_online_config') || '{}') || {};
  } catch (e) { /* configuración por defecto */ }
  return {
    leaderboardUrl: String(runtime.leaderboardUrl ?? ONLINE_CONFIG.leaderboardUrl).trim(),
    token: String(runtime.token ?? ONLINE_CONFIG.token).trim(),
    timeoutMs: Math.max(500, Number(runtime.timeoutMs ?? ONLINE_CONFIG.timeoutMs) || ONLINE_CONFIG.timeoutMs)
  };
}

export function isOnlineEnabled() {
  return /^https?:\/\//i.test(onlineConfig().leaderboardUrl);
}
