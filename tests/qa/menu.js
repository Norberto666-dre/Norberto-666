// Guion de QA que se ejecuta dentro de la app (Electron).
// Crea un perfil si hace falta y deja el menú principal listo para capturar.
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (id) => document.getElementById(id);
  const visible = (element) => !!element && !element.classList.contains('hidden');

  if (visible($('screen-launcher'))) {
    $('tab-register').click();
    $('register-nickname').value = 'QA DESKTOP';
    $('register-password').value = 'qa123456';
    $('form-register').requestSubmit();
    for (let i = 0; i < 80; i++) {
      await sleep(100);
      if (visible($('screen-menu'))) break;
    }
  }

  return {
    screen: window.__OVERCLOCK?.game?.screen,
    menu: visible($('screen-menu')),
    installVisible: visible($('btn-install-app')),
    datasave: $('launcher-storage')?.textContent?.trim(),
    deskHints: getComputedStyle(document.querySelector('.desktop-hints')).display,
    glitch: getComputedStyle(document.querySelector('#menu-glitch')).fontSize,
    tiles: (() => {
      const r = document.querySelector('#gameCanvas').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })()
  };
})()
