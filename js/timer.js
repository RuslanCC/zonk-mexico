// Таймер партии. Хранит накопленное время и умеет паузу/резюме.
// Состояние сериализуемо — переживает перезагрузку страницы.

export class GameTimer {
  // snapshot: { accumulatedMs, startedAt(ts|null) }
  constructor(snapshot = null) {
    this.accumulatedMs = snapshot?.accumulatedMs || 0;
    this.startedAt = snapshot?.startedAt || null; // timestamp мс, когда запущен; null = на паузе
    this._tickCb = null;
    this._interval = null;
  }

  get running() { return this.startedAt !== null; }

  elapsed() {
    return this.accumulatedMs + (this.startedAt ? Date.now() - this.startedAt : 0);
  }

  start() {
    if (this.startedAt === null) this.startedAt = Date.now();
  }

  pause() {
    if (this.startedAt !== null) {
      this.accumulatedMs += Date.now() - this.startedAt;
      this.startedAt = null;
    }
  }

  toggle() { this.running ? this.pause() : this.start(); }

  snapshot() {
    return { accumulatedMs: this.accumulatedMs, startedAt: this.startedAt };
  }

  // вызывать cb каждую секунду для обновления UI
  onTick(cb) {
    this._tickCb = cb;
    clearInterval(this._interval);
    this._interval = setInterval(() => this._tickCb && this._tickCb(this.elapsed()), 1000);
  }

  destroy() { clearInterval(this._interval); this._tickCb = null; }
}
