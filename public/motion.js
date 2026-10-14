// Rendering-only interpolation. Combat and collision remain server-authoritative.
export class Motion {
  constructor() { this.reset(); }
  reset() { this.tracks = new Map(); this.lastTime = null; this.receivedAt = null; }
  sample(id, now) {
    const t = this.tracks.get(id);
    if (!t) return null;
    const alpha = Math.max(0, Math.min(1, (now - t.at) / t.duration));
    return { x: t.from.x + (t.to.x - t.from.x) * alpha,
      y: t.from.y + (t.to.y - t.from.y) * alpha };
  }
  push(state, now) {
    const interval = this.lastTime === null ? 1000 / 15 : (state.time - this.lastTime) * 1000;
    const reset = this.receivedAt === null || now - this.receivedAt > 250 || interval <= 0 || interval > 250;
    const duration = Math.max(16, Math.min(100, interval));
    const ids = new Set();
    for (const u of [...state.players, ...state.minions, ...state.projectiles]) {
      ids.add(u.id);
      const old = this.tracks.get(u.id);
      const from = this.sample(u.id, now);
      // Respawn and dash are discontinuities, not ordinary walking.
      const jump = old && Math.hypot(u.x - old.to.x, u.y - old.to.y) >
        Math.max(90, (u.speed || 680) * duration / 1000 * 2.5);
      const relocated = old && old.revision !== u.positionRevision;
      const respawn = old && old.alive !== (u.hp === undefined || u.hp > 0);
      const dash = old && u.cd && u.cd.f > (old.dashCooldown || 0) + 1;
      this.tracks.set(u.id, { from: !old || reset || jump || respawn || dash || relocated ? {x:u.x,y:u.y} : from,
        to: {x:u.x,y:u.y}, at: now, duration, alive: u.hp === undefined || u.hp > 0,
        revision:u.positionRevision, dashCooldown: u.cd?.f });
    }
    for (const id of this.tracks.keys()) if (!ids.has(id)) this.tracks.delete(id);
    this.lastTime = state.time;
    this.receivedAt = now;
  }
  entity(u, now) { return { ...u, ...(this.sample(u.id, now) || {}) }; }
}
