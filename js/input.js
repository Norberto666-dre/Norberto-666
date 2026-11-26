export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.touches = new Map(); // id -> {x, y, startX, startY, time, dragged}
    this.pointers = []; // {x, y, time}
    this.bufferMs = 80; // buffer de entrada
    this.lastPointerTime = 0;
    this.lastEventLatency = 0;
    this.lastX = -100; // posición del cursor para la estela diegética
    this.lastY = -100;
    this.onPointer = null; // callback(x, y, phase, info)
    this.onHover = null; // callback(x, y) o callback(null, null) al salir
    this.hover = null;

    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    this.canvas.addEventListener('pointerleave', (e) => this.onLeave(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Prevenir zoom/scroll en táctil
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  getRect() { return this.canvas.getBoundingClientRect(); }

  getId(p) {
    return p.pointerId !== undefined ? p.pointerId : p.identifier;
  }

  emit(x, y, phase, p, extra = {}) {
    if (!this.onPointer) return;
    const id = this.getId(p);
    const t = this.touches.get(id);
    const startX = t ? t.startX : x;
    const startY = t ? t.startY : y;
    const dx = x - startX;
    const dy = y - startY;
    this.onPointer(x, y, phase, {
      id, startX, startY, dx, dy,
      distance: Math.hypot(dx, dy),
      dragged: !!(t && t.dragged),
      isTrusted: !!p.isTrusted,
      ...extra
    });
  }

  onDown(e) {
    // Ratón: solo el botón principal. Los botones laterales no disparan el juego.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = this.getRect();
    const pts = e.changedTouches ? Array.from(e.changedTouches) : [e];
    pts.forEach(p => {
      const x = p.clientX - r.left;
      const y = p.clientY - r.top;
      const id = this.getId(p);
      const now = performance.now();
      this.touches.set(id, { x, y, startX: x, startY: y, time: now, dragged: false });
      try { this.canvas.setPointerCapture?.(id); } catch (_) { /* puntero ya liberado */ }
      this.lastEventLatency = Math.max(0, now - (p.timeStamp || now));
      this.lastPointerTime = now;
      this.lastX = x;
      this.lastY = y;
      this.pointers.push({ x, y, time: now });
      if (this.pointers.length > 10) this.pointers.shift();
      this.emit(x, y, 'down', p);
    });
  }

  onMove(e) {
    const r = this.getRect();
    const pts = e.changedTouches ? Array.from(e.changedTouches) : [e];
    pts.forEach(p => {
      const x = p.clientX - r.left;
      const y = p.clientY - r.top;
      this.hover = { x, y };
      if (this.onHover) this.onHover(x, y);
      const id = this.getId(p);
      const t = this.touches.get(id);
      if (!t) return;
      t.x = x;
      t.y = y;
      this.lastX = x;
      this.lastY = y;
      this.emit(x, y, 'move', p);
    });
  }

  onLeave(e) {
    if (this.touches.size === 0) {
      this.hover = null;
      if (this.onHover) this.onHover(null, null);
    }
    this.onUp(e);
  }

  onUp(e) {
    const r = this.getRect();
    const pts = e.changedTouches ? Array.from(e.changedTouches) : [e];
    pts.forEach(p => {
      const id = this.getId(p);
      const t = this.touches.get(id);
      if (!t) return;
      const x = p.clientX !== undefined ? p.clientX - r.left : t.x;
      const y = p.clientY !== undefined ? p.clientY - r.top : t.y;
      this.emit(x, y, 'up', p, { dragged: t.dragged });
      this.touches.delete(id);
      try { this.canvas.releasePointerCapture?.(id); } catch (_) { /* ya liberado */ }
    });
  }

  // Devuelve punteros recientes dentro del buffer (para input buffer de ~80ms)
  recentPointers() {
    const now = performance.now();
    return this.pointers.filter(p => now - p.time <= this.bufferMs);
  }

  clearRecent() { this.pointers = []; }

  resize() {}
}
