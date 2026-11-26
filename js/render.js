export class Renderer {
  constructor(canvas, ctx, { audio, input, game }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.audio = audio;
    this.input = input;
    this.game = game;

    this.width = 0;
    this.height = 0;
    this.board = { x: 0, y: 0, cell: 0, margin: 0 };

    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    // Usar CSS size como base; en móviles alta DPI usamos devicePixelRatio limitado
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = r.width * dpr;
    this.height = r.height * dpr;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.scale(dpr, dpr);
    this.drawW = r.width;
    this.drawH = r.height;

    this.computeBoard();
    if (this.game) this.game.setCanvasSize(this.drawW, this.drawH, this.board);
  }

  computeBoard() {
    const w = this.drawW;
    const h = this.drawH;
    const cols = this.game && this.game.cols ? this.game.cols : 3;
    const rows = this.game && this.game.rows ? this.game.rows : 3;
    // Tablero centrado, dejando espacio arriba para HUD y abajo para carga.
    // La celda se calcula por columnas: 4×3 y 5×4 caben sin recortar en móvil.
    const size = Math.min(w * 0.94, h * 0.62, (h * 0.60) * cols / rows);
    this.board.cell = size / cols;
    this.board.rows = rows;
    this.board.cols = cols;
    this.board.width = this.board.cell * cols;
    this.board.height = this.board.cell * rows;
    this.board.margin = Math.max(4, this.board.cell * 0.06);
    this.board.x = (w - this.board.width) / 2;
    this.board.y = Math.max(h * 0.17, (h - this.board.height) * 0.42);
  }

  // Hit test: devuelve el hoyo bajo el puntero o null
  hitTest(px, py) {
    const b = this.board;
    const col = Math.floor((px - b.x) / b.cell);
    const row = Math.floor((py - b.y) / b.cell);
    if (col < 0 || col >= b.cols || row < 0 || row >= b.rows) return null;
    const idx = row * b.cols + col;
    return this.game.holes[idx] || null;
  }

  render(dt) {
    const ctx = this.ctx;
    const w = this.drawW;
    const h = this.drawH;
    const b = this.board;

    // Fondo
    ctx.fillStyle = '#040408';
    ctx.fillRect(0, 0, w, h);

    // Pesadilla: reutiliza el lenguaje visual del antiguo Overdrive (5 s tras el Falso Final)
    if (this.game.nightmare) {
      const pulse = Math.sin(Date.now() / 180) * 0.35 + 0.65;
      ctx.save();
      ctx.strokeStyle = `rgba(255,64,208,${0.6 * pulse})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = '#ff40d0';
      ctx.shadowBlur = 18 * pulse;
      ctx.strokeRect(b.x - 10, b.y - 10, b.width + 20, b.height + 20);
      ctx.shadowBlur = 0;
      ctx.restore();
      const scanY = ((Date.now() / 8) % (h + 120)) - 60;
      ctx.save();
      ctx.fillStyle = 'rgba(255,64,208,0.05)';
      ctx.fillRect(0, scanY, w, 60);
      ctx.restore();
    }

    // Aplicar screen shake
    let shakeX = 0, shakeY = 0;
    if (this.game.shakeIntensity > 0) {
      shakeX = (Math.random() - 0.5) * this.game.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.game.shakeIntensity;
      this.game.shakeIntensity *= 0.85;
      if (this.game.shakeIntensity < 0.5) this.game.shakeIntensity = 0;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (this.game.clutchActive) ctx.filter = 'saturate(0.3)';

    // Filas bloqueadas por el boss
    if (this.game.boss) {
      this.game.boss.slammedRows.forEach(r => {
        // half 2 = crio (azul), half 1 = segundo núcleo (morado), half 0 = rojo
        const color = r.half === 2 ? 'rgba(0,243,255,0.18)'
          : r.half === 1 ? 'rgba(204,0,255,0.18)' : 'rgba(255,0,51,0.15)';
        ctx.fillStyle = color;
        ctx.fillRect(b.x, b.y + r.row * b.cell, b.width, b.cell);
      });
    }

    // Clústeres enlazados: trampa con ventana de limpieza
    this.drawLinks(ctx);

    // Dibujar tablero y hoyos
    this.game.holes.forEach((hole, i) => {
      this.drawHole(ctx, b, hole, i);
    });
    this.drawDrag(ctx);

    // Chain Lightning sobre el tablero
    if (this.game.chainLightning) {
      this.drawChainLightning(ctx);
    }

    // Prisma: eje de reflejo horizontal
    if (this.game.boss && this.game.boss.type === 'prisma' && !this.game.boss.defeated) {
      const axis = b.x + b.width / 2;
      ctx.save();
      ctx.strokeStyle = `rgba(204,0,255,${0.5 + 0.3 * Math.sin(Date.now() / 140)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(axis, b.y - 8);
      ctx.lineTo(axis, b.y + b.height + 8);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Onda Nova y ripples de toque: encima del tablero, debajo del HUD
    this.drawShockwaves(ctx);
    this.drawTapRipples(ctx);

    // Boss: barra de vida
    if (this.game.boss) {
      this.drawBoss(ctx, w);
    }

    // Banner de inversión (jefe Espejo o espejo latente de Ascensión)
    const bossInvert = this.game.boss && this.game.boss.type === 'mirror' &&
      this.game.boss.invertRemaining > 0 && !this.game.boss.defeated;
    if (bossInvert || (this.game.globalInvertRemaining || 0) > 0) {
      this.drawInvertBanner(ctx, w,
        bossInvert ? this.game.boss.invertRemaining : this.game.globalInvertRemaining);
    }

    // Flash
    if (this.game.flashAmount > 0) {
      ctx.save();
      ctx.globalAlpha = this.game.flashAmount * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this.game.flashAmount *= 0.75;
      if (this.game.flashAmount < 0.02) this.game.flashAmount = 0;
    }

    // Clutch Slow-Mo: tinte azul y banner inferior
    if (this.game.clutchActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,20,40,0.35)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.8 + 0.2 * Math.sin(Date.now() / 100);
      ctx.fillStyle = '#00f3ff';
      ctx.font = 'bold 16px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f3ff';
      ctx.shadowBlur = 15;
      ctx.fillText('CLUTCH SLOW-MO', w / 2, b.y + b.height + 32);
      ctx.restore();
    }

    // Partículas
    this.drawParticles(ctx);

    // Popups de puntuación
    this.drawPopups(ctx);

    // Cursor diegético con estela propia
    this.drawCursor(ctx);

    // Banner de Jackpot Frenzy
    if (this.game.jackpotActive) {
      this.drawJackpotBanner(ctx, w);
    }

    // Overlay de pantalla (scanlines sutiles)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 20, 0.15)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }

  // Clúster: línea pulsante entre núcleos y cuenta atrás de la trampa.
  drawLinks(ctx) {
    const links = this.game.links || [];
    links.forEach(group => {
      if (group.done) return;
      const indices = group.indices;
      for (let i = 0; i < indices.length - 1; i++) {
        const a = this.game.holes[indices[i]];
        const c = this.game.holes[indices[i + 1]];
        if (!a || !c) continue;
        ctx.save();
        ctx.strokeStyle = group.trapped ? '#ffcc00' : 'rgba(0,243,255,0.55)';
        ctx.lineWidth = group.trapped ? 3 : 1.5;
        ctx.shadowColor = group.trapped ? '#ffcc00' : '#00f3ff';
        ctx.shadowBlur = group.trapped ? 16 : 8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.restore();
      }
      if (group.trapped && group.timer > 0) {
        const cx = indices.reduce((s, idx) => s + (this.game.holes[idx]?.x || 0), 0) / indices.length;
        const cy = indices.reduce((s, idx) => s + (this.game.holes[idx]?.y || 0), 0) / indices.length;
        ctx.save();
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 12px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`TRAMPA ${group.timer.toFixed(1)}s`, cx, cy - this.board.cell * 0.46);
        ctx.restore();
      }
    });
  }

  // Arrastre del núcleo rojo: guía visual hacia el borde y umbral de 60 px.
  drawDrag(ctx) {
    const hole = this.game._dragHole;
    if (!hole || !hole.dragX) return;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y);
    ctx.lineTo(hole.dragX, hole.dragY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(hole.dragX, hole.dragY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHole(ctx, b, hole, index) {
    const cx = hole.x != null ? hole.x : b.x + (index % b.cols + 0.5) * b.cell;
    const cy = hole.y != null ? hole.y : b.y + (Math.floor(index / b.cols) + 0.5) * b.cell;
    const r = b.cell * 0.35;

    hole.x = cx;
    hole.y = cy;
    hole.r = r;

    // Sombra / base del hoyo
    ctx.save();
    ctx.translate(cx, cy);

    // Anillo exterior (cabina)
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#121222';
    ctx.fill();
    ctx.strokeStyle = '#1a1a33';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Base interna oscura
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#06060e';
    ctx.fill();

    // Dibujar según estado
    if (hole.state === 0) { // EMPTY
      this.drawEmpty(ctx, r);
    } else if (hole.state === 1) { // TELEGRAPH
      this.drawTelegraph(ctx, r, hole);
    } else if (hole.state === 2) { // ACTIVE
      this.drawActive(ctx, r, hole);
    } else if (hole.state === 3) { // HIT
      this.drawHit(ctx, r, hole);
    } else if (hole.state === 4) { // ESCAPED
      this.drawEscaped(ctx, r, hole);
    }

    ctx.restore();

    // Número del hoyo (legibilidad)
    ctx.fillStyle = 'rgba(0,243,255,0.18)';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), cx, cy + r - 14);
  }

  drawEmpty(ctx, r) {
    // Cara de LED apagada (ojos tristes)
    ctx.fillStyle = '#0f0f1a';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.arc(r * 0.28, -r * 0.18, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, r * 0.25, r * 0.14, 0, Math.PI);
    ctx.fill();
  }

  // El Espejo (o el espejo latente de Ascensión) invierte el color; el chip ESPEJO lo anula
  isInverted() {
    const boss = this.game.boss;
    const bossInvert = boss && boss.type === 'mirror' && boss.invertRemaining > 0;
    const globalInvert = (this.game.globalInvertRemaining || 0) > 0;
    if (!bossInvert && !globalInvert) return false;
    const chips = (this.game.loadout && this.game.loadout.chips) || [];
    return !chips.includes('mirror_core');
  }

  getDisplayCore(hole) {
    if (!this.isInverted()) return hole.core;
    if (hole.core === 'bomb') return 'standard';
    if (hole.core === 'standard') return 'bomb';
    return hole.core;
  }

  // Paleta diegética por tipo de núcleo. El blanco y el jefe tienen identidad propia.
  coreVisual(core) {
    if (core === 'bomb') return { color: '#ff0033', rgb: '255,0,51' };
    if (core === 'crono') return { color: '#cc00ff', rgb: '204,0,255' };
    if (core === 'nova') return { color: '#ffcc00', rgb: '255,204,0' };
    if (core === 'white') return { color: '#ffffff', rgb: '255,255,255' };
    if (core === 'boss') {
      const boss = this.game.boss;
      const color = boss && boss.color ? boss.color : '#ff6a00';
      const n = parseInt(color.slice(1), 16);
      return { color, rgb: `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` };
    }
    return { color: '#00f3ff', rgb: '0,243,255' };
  }

  drawTelegraph(ctx, r, hole) {
    const t = hole.timer / hole.telegraphTime; // 0..1
    const pulse = Math.sin(Date.now() / 120) * 0.3 + 0.7;
    const glow = r * (0.75 + 0.15 * pulse);
    const displayCore = this.getDisplayCore(hole);
    const { color, rgb } = this.coreVisual(displayCore);

    // Brillo alrededor
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glow);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.35)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glow, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo creciente: el color anticipa el tipo
    const nr = r * (0.35 + 0.25 * t);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, nr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (window.__colorblind || this.isInverted()) this.drawCoreGlyph(ctx, nr, hole.core);

    // Ojos alerta
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.15, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.15, r * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // Anillo parpadeante
    ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.6 + 0.4 * Math.sin(Date.now() / 80)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawActive(ctx, r, hole) {
    const t = Math.min(hole.timer / hole.lifetime, 1);
    const displayCore = this.getDisplayCore(hole);
    const { color, rgb: glowRgb } = this.coreVisual(displayCore);

    // Advertencia roja si está por escapar
    const danger = t > 0.75;
    const pulse = danger ? (Math.sin(Date.now() / 60) * 0.4 + 0.6) : 1;

    // Brillo
    const glow = r * (0.8 + 0.15 * Math.sin(Date.now() / 100));
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glow);
    grad.addColorStop(0, danger ? 'rgba(255,0,51,0.45)' : `rgba(${glowRgb},${0.35 * pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, glow, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo
    const nr = r * (0.5 + 0.12 * Math.sin(Date.now() / 150));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, nr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cara según tipo (en modo daltónico se sustituye por un glifo)
    if (window.__colorblind || this.isInverted()) {
      this.drawCoreGlyph(ctx, nr, hole.core);
    } else {
    ctx.fillStyle = '#ffffff';
    if (hole.core === 'bomb') {
      // Ojos enojados
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.12);
      ctx.lineTo(-r * 0.10, -r * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.10, -r * 0.22);
      ctx.lineTo(r * 0.25, -r * 0.12);
      ctx.stroke();
      // Boca recta
      ctx.beginPath();
      ctx.moveTo(-r * 0.18, r * 0.18);
      ctx.lineTo(r * 0.18, r * 0.18);
      ctx.stroke();
    } else if (hole.core === 'crono') {
      // Ojos de reloj
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 0.12, r * 0.05, 0, Math.PI * 2);
      ctx.arc(r * 0.18, -r * 0.12, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else if (hole.core === 'nova') {
      // Estrella de 4 puntas: es recompensa, no peligro
      ctx.lineWidth = Math.max(2, r * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rad = i % 2 === 0 ? r * 0.30 : r * 0.12;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    } else if (hole.core === 'white') {
      // Falso Final: destello neón con rombo central
      ctx.lineWidth = Math.max(2, r * 0.05);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Date.now() / 900;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
        ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.22); ctx.lineTo(r * 0.22, 0);
      ctx.lineTo(0, r * 0.22); ctx.lineTo(-r * 0.22, 0);
      ctx.closePath();
      ctx.stroke();
    } else if (hole.core === 'boss') {
      this.drawCoreGlyph(ctx, nr, 'boss');
    } else {
      // Ojos confiados
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 0.10, r * 0.05, 0, Math.PI * 2);
      ctx.arc(r * 0.18, -r * 0.10, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.10, 0, Math.PI, true);
      ctx.stroke();
    }
    }

    // Barra de tiempo alrededor (arco)
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (1 - t));
    ctx.stroke();

    if (danger) {
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Glifo geométrico para modo daltónico: forma + color, nunca solo color
  drawCoreGlyph(ctx, size, core) {
    ctx.save();
    ctx.strokeStyle = '#05050a';
    ctx.fillStyle = '#05050a';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.lineCap = 'round';
    if (core === 'bomb') {
      // X = peligro
      ctx.beginPath();
      ctx.moveTo(-size * 0.42, -size * 0.42);
      ctx.lineTo(size * 0.42, size * 0.42);
      ctx.moveTo(size * 0.42, -size * 0.42);
      ctx.lineTo(-size * 0.42, size * 0.42);
      ctx.stroke();
    } else if (core === 'crono') {
      // Manecillas de reloj = tiempo
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size * 0.48);
      ctx.moveTo(0, 0);
      ctx.lineTo(size * 0.34, 0);
      ctx.stroke();
    } else if (core === 'nova') {
      // Estrella = onda que limpia el tablero
      ctx.lineWidth = Math.max(2, size * 0.10);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rad = i % 2 === 0 ? size * 0.48 : size * 0.16;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (core === 'white') {
      // Rombo con rayos = Falso Final
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.5);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(0, size * 0.5);
      ctx.lineTo(-size * 0.5, 0);
      ctx.closePath();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62);
        ctx.lineTo(Math.cos(a) * size * 0.86, Math.sin(a) * size * 0.86);
        ctx.stroke();
      }
    } else if (core === 'boss') {
      // Engranaje = núcleo de jefe móvil
      const glyph = (this.game.boss && this.game.boss.glyph) || 'gear';
      if (glyph === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(-size * 0.45, 0); ctx.lineTo(0, -size * 0.45);
        ctx.lineTo(size * 0.45, 0); ctx.lineTo(0, size * 0.45);
        ctx.closePath(); ctx.stroke();
      } else if (glyph === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.5); ctx.lineTo(size * 0.45, size * 0.35);
        ctx.lineTo(-size * 0.45, size * 0.35); ctx.closePath(); ctx.stroke();
      } else if (glyph === 'frost') {
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * size * 0.5, Math.sin(a) * size * 0.5);
          ctx.stroke();
        }
      } else if (glyph === 'bolt') {
        ctx.beginPath();
        ctx.moveTo(size * 0.12, -size * 0.5);
        ctx.lineTo(-size * 0.28, size * 0.08);
        ctx.lineTo(size * 0.02, size * 0.08);
        ctx.lineTo(-size * 0.12, size * 0.5);
        ctx.lineTo(size * 0.34, -size * 0.1);
        ctx.lineTo(size * 0.04, -size * 0.1);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * size * 0.38, Math.sin(a) * size * 0.38);
          ctx.lineTo(Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55);
          ctx.stroke();
        }
      }
    } else {
      // Triángulo = núcleo estándar
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.45);
      ctx.lineTo(size * 0.42, size * 0.34);
      ctx.lineTo(-size * 0.42, size * 0.34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawHit(ctx, r, hole) {
    const t = Math.min(hole.timer / 0.25, 1);
    const color = hole.core === 'bomb' ? '#ff0033' : hole.core === 'crono' ? '#cc00ff' : '#00f3ff';
    // Explosión hacia fuera
    const er = r * (0.5 + 1.5 * t);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, er, 0, Math.PI * 2);
    ctx.stroke();
    // Núcleo se reduce
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25 * (1 - t), 0, Math.PI * 2);
    ctx.fill();
  }

  drawEscaped(ctx, r, hole) {
    const t = Math.min(hole.timer / 0.25, 1);
    ctx.strokeStyle = '#ff0033';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.5);
    ctx.lineTo(r * 0.5, r * 0.5);
    ctx.moveTo(r * 0.5, -r * 0.5);
    ctx.lineTo(-r * 0.5, r * 0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,0,51,0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4 * t, 0, Math.PI * 2);
    ctx.fill();
  }

  // Onda expansiva de la Nova: dos anillos con desfase y destello central.
  drawShockwaves(ctx) {
    const waves = this.game.shockwaves || [];
    waves.forEach(s => {
      const t = 1 - Math.max(0, s.life / s.maxLife); // 0 → 1
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const delays = s.extraRing ? [0, 0.09, 0.18] : [0, 0.09];
      delays.forEach((delay, i) => {
        const local = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
        if (local <= 0) return;
        const radius = s.radius * (1 - Math.pow(1 - local, 2));
        const alpha = Math.pow(1 - local, 1.6) * (i === 0 ? 0.8 : i === 1 ? 0.45 : 0.3);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = i === 0 ? '#ffcc00' : i === 1 ? '#ff6a00' : '#fff0a0';
        ctx.lineWidth = (i === 0 ? 9 : i === 1 ? 4 : 2) * (1 - local * 0.5);
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.globalAlpha = Math.max(0, 1 - t * 3) * 0.5;
      ctx.fillStyle = '#fff6cc';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // Ripple mínimo en cada toque: confirma el input sin competir con el núcleo.
  drawTapRipples(ctx) {
    (this.game.tapRipples || []).forEach(r => {
      const t = 1 - Math.max(0, r.life / r.maxLife);
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.45;
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + t * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  drawParticles(ctx) {
    if (!this.game.particles) return;
    this.game.particles.forEach(p => {
      const a = Math.max(0, p.life / (p.maxLife || 0.8));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.streak && p.px != null) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * a * 0.8);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  drawPopups(ctx) {
    if (!this.game.popups) return;
    this.game.popups.forEach(p => {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });
  }

  // Glifo del cursor sobre el último toque: estela y partículas propias por cursor.
  drawCursor(ctx) {
    const def = this.game.cursorDef;
    const input = this.input;
    if (!def || !input || input.lastX == null || input.lastX < 0) return;
    const x = input.lastX;
    const y = input.lastY;
    const color = def.color || '#00f3ff';
    const phase = Date.now() / 180;
    const spin = (Date.now() / 420) % (Math.PI * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.translate(x, y);

    switch (def.trail) {
      case 'arc': {
        ctx.rotate(spin);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const r = i % 2 ? 6 : 12;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      }
      case 'shield': {
        ctx.rotate(spin * 0.3);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = Math.cos(a) * 11;
          const py = Math.sin(a) * 11;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'clock': {
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(spin) * 7, Math.sin(spin) * 7);
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(spin * 0.25) * 5, Math.sin(spin * 0.25) * 5);
        ctx.stroke();
        break;
      }
      case 'star': {
        ctx.rotate(spin);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const r = i % 2 ? 4 : 13;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'mirror': {
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.rotate(-Math.PI / 4);
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-10, -1, 20, 2);
        break;
      }
      case 'frost': {
        ctx.rotate(spin * 0.2);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
          ctx.stroke();
        }
        break;
      }
      case 'halo': {
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(phase);
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ghost': {
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.arc(-3, -2, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(3, 2, 9, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'rainbow': {
        ['#ff3355', '#ffcc00', '#00f3ff'].forEach((c, i) => {
          ctx.strokeStyle = c;
          ctx.beginPath();
          ctx.arc(0, 0, 9 + i * 3, spin + i * 1.6, spin + i * 1.6 + 2.2);
          ctx.stroke();
        });
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(0, 0, 8 + Math.sin(phase) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawJackpotBanner(ctx, w) {
    const pulse = Math.sin(Date.now() / 120) * 0.3 + 0.7;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 15;
    ctx.fillText('JACKPOT FRENZY', w / 2, this.board.y - 20);
    ctx.restore();
  }

  // Banner persistente y legible en viewport estrecho (una sola línea, altura fija)
  drawInvertBanner(ctx, w, remaining) {
    const chips = (this.game.loadout && this.game.loadout.chips) || [];
    const shielded = chips.includes('mirror_core');
    const y = Math.max(this.drawH - 14, this.board.y + this.board.height + 22);
    ctx.save();
    ctx.fillStyle = 'rgba(8,0,18,0.92)';
    ctx.fillRect(0, y - 13, w, 26);
    ctx.fillStyle = shielded ? '#00f3ff' : '#cc00ff';
    ctx.font = 'bold 12px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    const text = shielded
      ? `ESPEJO ACTIVO · INVERSIÓN NEUTRALIZADA · ${remaining.toFixed(1)}s`
      : `LECTURA INVERTIDA · USA FORMAS · ${remaining.toFixed(1)}s`;
    ctx.fillText(text, w / 2, y + 4, w - 8);
    ctx.restore();
  }

  drawBoss(ctx, w) {
    const boss = this.game.boss;
    const b = this.board;
    const barW = b.width;
    const barX = b.x;
    const barY = b.y - 18;
    const hp = Math.max(0, boss.hpPercent);
    const color = boss.color || (boss.phase === 3 ? '#ff0033' : boss.phase === 2 ? '#ffcc00' : '#00f3ff');

    ctx.save();
    ctx.fillStyle = 'rgba(13,13,26,0.85)';
    ctx.fillRect(barX, barY, barW, 10);

    if (boss.phase === 3 && !boss.defeated) {
      // Fase 3: el núcleo se parte en dos fragmentos con barras propias
      const gap = 6;
      const halfW = (barW - gap) / 2;
      [0, 1].forEach(i => {
        const x = barX + i * (halfW + gap);
        const halfRatio = boss.halves
          ? Math.max(0, boss.halves[i] / (boss.maxHp / 2))
          : hp;
        ctx.fillStyle = '#060610';
        ctx.fillRect(x, barY, halfW, 10);
        ctx.fillStyle = color;
        ctx.fillRect(x, barY, halfW * halfRatio, 10);
        ctx.strokeStyle = '#1a1a33';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, barY, halfW, 10);
      });
      const pulse = Math.sin(Date.now() / 90) * 0.5 + 0.5;
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.fillStyle = color;
      [0, 1].forEach(i => {
        const cx = barX + (i === 0 ? halfW * 0.5 : barW - halfW * 0.5);
        ctx.beginPath();
        ctx.arc(cx, barY + 5, 7, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(barX, barY, barW * hp, 10);
      ctx.strokeStyle = '#1a1a33';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, 10);
    }

    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    const splitLabel = boss.phase === 3 && !boss.defeated ? ' · PARTIDO' : '';
    ctx.fillText(`${boss.name} · FASE ${boss.phase}${splitLabel}`, barX + barW / 2, barY - 5);

    if (boss.damageFlash > 0) {
      ctx.globalAlpha = boss.damageFlash * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(barX, barY, barW, 10);
      ctx.globalAlpha = 1;
    }

    let mechanic = null;
    if (boss.type === 'prisma' && !boss.defeated) {
      const chance = boss.phase === 3 ? 80 : boss.phase === 2 ? 60 : 40;
      mechanic = `REFLEJO HORIZONTAL ${chance}%`;
    } else if (boss.type === 'crio' && !boss.defeated) {
      mechanic = 'CONGELACIÓN ACTIVA';
    } else if (boss.type === 'sobrecarga' && !boss.defeated) {
      mechanic = 'NÚCLEOS INESTABLES';
    }
    if (mechanic) {
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(Date.now() / 120);
      ctx.fillStyle = '#cc00ff';
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.shadowColor = '#cc00ff';
      ctx.shadowBlur = 10;
      ctx.fillText(mechanic, barX + barW / 2, b.y + b.height + 56);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (boss.defeated) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 14px Orbitron, sans-serif';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 12;
      ctx.fillText(`${boss.name} DERROTADO`, barX + barW / 2, b.y + b.height + 32);
    }
    ctx.restore();
  }

  drawChainLightning(ctx) {
    const cl = this.game.chainLightning;
    const from = this.game.holes[cl.from];
    if (!from) return;
    const alpha = Math.max(0, cl.life / 0.25);
    ctx.save();
    ctx.strokeStyle = `rgba(0,243,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f3ff';
    ctx.shadowBlur = 12;
    cl.to.forEach(idx => {
      const to = this.game.holes[idx];
      if (!to) return;
      const mx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 24;
      const my = (from.y + to.y) / 2 + (Math.random() - 0.5) * 24;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(mx, my);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
    ctx.restore();
  }
}
