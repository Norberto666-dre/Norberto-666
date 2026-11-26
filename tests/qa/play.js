// Guion de QA que se ejecuta dentro de la app (Electron).
// Entra a una partida real y la deja corriendo para revisar HUD y tablero.
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

  if (visible($('screen-menu'))) {
    $('btn-jugar').click();
    await sleep(400);
    if (visible($('screen-prep'))) $('btn-iniciar').click();
  }

  await sleep(2200);

  const game = window.__OVERCLOCK?.game;
  const board = window.__OVERCLOCK?.renderer?.board;
  return {
    screen: game?.screen,
    board: game?.boardId,
    voltage: Math.round(game?.voltage ?? -1),
    hudVisible: !$('hud').classList.contains('hidden'),
    activeHoles: (game?.holes || []).filter((hole) => hole && hole.active).length,
    cell: board ? Math.round(board.cell) : 0,
    boardY: board ? Math.round(board.y) : 0,
    hudBottom: Math.round($('hud')?.getBoundingClientRect().bottom ?? 0)
  };
})()
