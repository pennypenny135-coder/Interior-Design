import type { Doc, Item, RoomZone, SharedWall, Vec2, Wall } from '../types';

// ---------- 常數 ----------
export const PX_PER_CM = 1.5; // 2D：1 cm = 1.5 px（再乘以 zoom）
export const CM_TO_3D = 1 / 100; // 3D：100 cm = 1 unit
export const WALL_H = 260;
export const WALL_T = 15;
export const GRID = 10;
export const MERGE_DIST = 20;
export const MERGE_MIN_OVERLAP = 30;
export const SQFT_PER_M2 = 10.7639;

// ---------- 基礎工具 ----------
export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;
export const normDeg = (d: number) => ((d % 360) + 360) % 360;
export const snapVal = (v: number, on: boolean, step = GRID) => (on ? Math.round(v / step) * step : v);
export const round1 = (v: number) => Math.round(v * 10) / 10;

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;
export const vlen = (a: Vec2) => Math.hypot(a.x, a.y);
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function rotatePoint(p: Vec2, deg: number, center: Vec2 = { x: 0, y: 0 }): Vec2 {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * c - dy * s, y: center.y + dx * s + dy * c };
}

export function bezier(a: Vec2, c: Vec2, b: Vec2, t: number): Vec2 {
  const m = 1 - t;
  return {
    x: m * m * a.x + 2 * m * t * c.x + t * t * b.x,
    y: m * m * a.y + 2 * m * t * c.y + t * t * b.y,
  };
}

/** 讓曲線經過 P（t=0.5）所需的控制點 */
export function controlForMid(a: Vec2, b: Vec2, p: Vec2): Vec2 {
  return { x: 2 * p.x - 0.5 * (a.x + b.x), y: 2 * p.y - 0.5 * (a.y + b.y) };
}

// ---------- 牆 / 分區 ----------
export function nodeOf(doc: Doc, id: string): Vec2 {
  const n = doc.nodes[id];
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

export function wallEnds(doc: Doc, w: Wall): [Vec2, Vec2] {
  return [nodeOf(doc, w.a), nodeOf(doc, w.b)];
}

export function wallPolyline(doc: Doc, w: Wall, steps = 20): Vec2[] {
  const [a, b] = wallEnds(doc, w);
  if (!w.curve) return [a, b];
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) pts.push(bezier(a, w.curve, b, i / steps));
  return pts;
}

export function polylineLength(pts: Vec2[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += vlen(sub(pts[i], pts[i - 1]));
  return l;
}

export function wallLength(doc: Doc, w: Wall) {
  return polylineLength(wallPolyline(doc, w, 32));
}

export function wallMid(doc: Doc, w: Wall): Vec2 {
  const [a, b] = wallEnds(doc, w);
  return w.curve ? bezier(a, w.curve, b, 0.5) : lerp(a, b, 0.5);
}

export function zoneWalls(doc: Doc, zone: RoomZone): Wall[] {
  const n = zone.nodeIds.length;
  const out: Wall[] = [];
  for (let i = 0; i < n; i++) {
    const a = zone.nodeIds[i];
    const b = zone.nodeIds[(i + 1) % n];
    const w = doc.walls.find((x) => x.zoneId === zone.id && x.a === a && x.b === b);
    if (w) out.push(w);
  }
  return out;
}

/** 分區輪廓（曲線牆離散取樣） */
export function zonePolygon(doc: Doc, zone: RoomZone): Vec2[] {
  const pts: Vec2[] = [];
  const n = zone.nodeIds.length;
  for (let i = 0; i < n; i++) {
    const a = zone.nodeIds[i];
    const b = zone.nodeIds[(i + 1) % n];
    const w = doc.walls.find((x) => x.zoneId === zone.id && x.a === a && x.b === b);
    if (w && w.curve) {
      const poly = wallPolyline(doc, w, 16);
      for (let k = 0; k < poly.length - 1; k++) pts.push(poly[k]);
    } else {
      pts.push(nodeOf(doc, a));
    }
  }
  return pts;
}

export function polygonArea(pts: Vec2[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

export const zoneAreaM2 = (doc: Doc, zone: RoomZone) => polygonArea(zonePolygon(doc, zone)) / 10000;
export const m2ToSqft = (m2: number) => m2 * SQFT_PER_M2;

export function polygonCentroid(pts: Vec2[]): Vec2 {
  if (!pts.length) return { x: 0, y: 0 };
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-6) {
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return vlen(sub(p, add(a, mul(ab, t))));
}

export function distToPolygon(p: Vec2, poly: Vec2[]) {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) m = Math.min(m, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return m;
}

export function zoneCentroid(doc: Doc, zone: RoomZone) {
  return polygonCentroid(zonePolygon(doc, zone));
}

export function zoneAt(doc: Doc, p: Vec2): RoomZone | undefined {
  return doc.zones.find((z) => pointInPolygon(p, zonePolygon(doc, z)));
}

export function docBounds(doc: Doc) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const z of doc.zones) {
    for (const p of zonePolygon(doc, z)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

// ---------- 傢俬幾何 / 碰撞 ----------
export const isOpeningItem = (it: Item) => it.type === 'door' || it.type === 'window';

export function itemCorners(it: Item): Vec2[] {
  const r = toRad(it.rotation);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const hw = it.w / 2;
  const hd = it.d / 2;
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([lx, ly]) => ({ x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c }));
}

/** SAT：旋轉矩形（OBB）重疊偵測；邊緣相接不算重疊 */
export function obbOverlap(A: Vec2[], B: Vec2[], eps = 0.5): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < 2; i++) {
      const e = sub(poly[i + 1], poly[i]);
      const l = vlen(e) || 1;
      const ax = { x: -e.y / l, y: e.x / l };
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of A) {
        const v = dot(p, ax);
        minA = Math.min(minA, v);
        maxA = Math.max(maxA, v);
      }
      for (const p of B) {
        const v = dot(p, ax);
        minB = Math.min(minB, v);
        maxB = Math.max(maxB, v);
      }
      if (maxA <= minB + eps || maxB <= minA + eps) return false;
    }
  }
  return true;
}

export type Issue = 'collision' | 'bounds';

export function computeIssues(doc: Doc): Record<string, Issue> {
  const out: Record<string, Issue> = {};
  const items = doc.items.filter((i) => !isOpeningItem(i));
  const corners = items.map(itemCorners);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      // 垂直方向不重疊（如爐頭放在地櫃上、吊櫃在地櫃上方）
      const overlapY = Math.min(a.elevation + a.h, b.elevation + b.h) - Math.max(a.elevation, b.elevation);
      if (overlapY <= 1) continue;
      const pair = [a.type, b.type];
      if (pair.includes('office-chair') && (pair.includes('desk') || pair.includes('dining'))) continue;
      if (obbOverlap(corners[i], corners[j])) {
        out[a.id] = 'collision';
        out[b.id] = 'collision';
      }
    }
  }
  const polys = doc.zones.map((z) => zonePolygon(doc, z));
  if (polys.length) {
    items.forEach((it, idx) => {
      const ok = corners[idx].every((c) => polys.some((p) => pointInPolygon(c, p) || distToPolygon(c, p) <= 9));
      if (!ok && !out[it.id]) out[it.id] = 'bounds';
    });
  }
  return out;
}

/** 門 / 窗吸附到最近的直牆；回傳吸附後位置與旋轉 */
export function snapOpeningToWall(doc: Doc, it: Item, target: Vec2) {
  let best: { dist: number; p: Vec2; theta: number; side: number; thick: number } | null = null;
  for (const w of doc.walls) {
    if (w.open || w.curve) continue;
    const [a, b] = wallEnds(doc, w);
    const L = vlen(sub(b, a));
    if (L < it.w + 2) continue;
    const u = mul(sub(b, a), 1 / L);
    const rel = sub(target, a);
    const s = dot(rel, u);
    if (s < -30 || s > L + 30) continue;
    const dist = Math.abs(cross(u, rel));
    if (dist > 50) continue;
    if (!best || dist < best.dist) {
      const sc = Math.max(it.w / 2, Math.min(L - it.w / 2, s));
      best = {
        dist,
        p: add(a, mul(u, sc)),
        theta: normDeg(toDeg(Math.atan2(u.y, u.x))),
        side: cross(u, rel),
        thick: w.thickness,
      };
    }
  }
  if (!best) return null;
  let rot = best.theta;
  const flipped = normDeg(best.theta + 180);
  if (Math.abs(best.side) > 6) {
    rot = best.side > 0 ? best.theta : flipped;
  } else {
    const dd = (x: number) => Math.min(Math.abs(normDeg(x - it.rotation)), 360 - Math.abs(normDeg(x - it.rotation)));
    rot = dd(best.theta) <= dd(flipped) ? best.theta : flipped;
  }
  return { x: best.p.x, y: best.p.y, rotation: normDeg(rot), d: best.thick };
}

// ---------- 共用牆幾何 ----------
export interface PairMetrics {
  d: number; // B 相對 A 的有號垂直距離
  overlap: number;
  lo: number;
  hi: number;
  u: Vec2;
  n: Vec2;
}

export function pairMetrics(doc: Doc, wa: Wall, wb: Wall): PairMetrics | null {
  if (wa.curve || wb.curve) return null;
  const [a0, a1] = wallEnds(doc, wa);
  const [b0, b1] = wallEnds(doc, wb);
  const la = vlen(sub(a1, a0));
  const lb = vlen(sub(b1, b0));
  if (la < 1 || lb < 1) return null;
  const u = mul(sub(a1, a0), 1 / la);
  const ub = mul(sub(b1, b0), 1 / lb);
  if (Math.abs(cross(u, ub)) > 0.035) return null;
  const n = { x: -u.y, y: u.x };
  const bm = lerp(b0, b1, 0.5);
  const d = dot(sub(bm, a0), n);
  const t0 = dot(sub(b0, a0), u);
  const t1 = dot(sub(b1, a0), u);
  const lo = Math.max(0, Math.min(t0, t1));
  const hi = Math.min(la, Math.max(t0, t1));
  return { d, overlap: hi - lo, lo, hi, u, n };
}

export interface SharedGeom {
  p: Vec2;
  q: Vec2;
  u: Vec2;
  n: Vec2;
  len: number;
  wa: Wall;
  wb: Wall;
  thickness: number;
}

export function sharedGeom(doc: Doc, sh: SharedWall): SharedGeom | null {
  const wa = doc.walls.find((w) => w.id === sh.wallA);
  const wb = doc.walls.find((w) => w.id === sh.wallB);
  if (!wa || !wb) return null;
  const m = pairMetrics(doc, wa, wb);
  if (!m || m.overlap <= 1) return null;
  const [a0] = wallEnds(doc, wa);
  return {
    p: add(a0, mul(m.u, m.lo)),
    q: add(a0, mul(m.u, m.hi)),
    u: m.u,
    n: m.n,
    len: m.hi - m.lo,
    wa,
    wb,
    thickness: Math.max(wa.thickness, wb.thickness),
  };
}

export interface Cut {
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

export const DOOR_H = 210;

export function openingYRange(kind: 'door' | 'open' | 'bar'): [number, number] {
  if (kind === 'door') return [0, DOOR_H];
  if (kind === 'bar') return [100, WALL_H + 1];
  return [0, WALL_H + 1];
}

/** 牆體上的開口（門、窗、共用牆開口、被共用略過的段落），沿牆長度參數 */
export function wallCuts(doc: Doc, wall: Wall): Cut[] {
  if (wall.curve) return [];
  const [a, b] = wallEnds(doc, wall);
  const L = vlen(sub(b, a));
  if (L < 1) return [];
  const u = mul(sub(b, a), 1 / L);
  const cuts: Cut[] = [];
  for (const it of doc.items) {
    if (!isOpeningItem(it)) continue;
    const r = toRad(it.rotation);
    const iu = { x: Math.cos(r), y: Math.sin(r) };
    if (Math.abs(cross(u, iu)) > 0.05) continue;
    const rel = sub({ x: it.x, y: it.y }, a);
    const s = dot(rel, u);
    const dist = Math.abs(cross(u, rel));
    if (dist > wall.thickness / 2 + 3 || s < 0 || s > L) continue;
    const y0 = it.type === 'door' ? 0 : it.elevation;
    cuts.push({ t0: s - it.w / 2, t1: s + it.w / 2, y0, y1: y0 + it.h });
  }
  for (const sh of doc.shared) {
    if (sh.wallA !== wall.id && sh.wallB !== wall.id) continue;
    const g = sharedGeom(doc, sh);
    if (!g) continue;
    const proj = (p: Vec2) => dot(sub(p, a), u);
    if (sh.wallB === wall.id) {
      const t0 = proj(g.p);
      const t1 = proj(g.q);
      cuts.push({ t0: Math.min(t0, t1), t1: Math.max(t0, t1), y0: 0, y1: WALL_H + 1 });
    } else if (sh.opening) {
      const op = sh.opening;
      const c = add(g.p, mul(g.u, op.center));
      const t0 = proj(add(c, mul(g.u, -op.width / 2)));
      const t1 = proj(add(c, mul(g.u, op.width / 2)));
      const [y0, y1] = openingYRange(op.kind);
      cuts.push({ t0: Math.min(t0, t1), t1: Math.max(t0, t1), y0, y1 });
    }
  }
  return cuts;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function shade(hex: string, amt: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * (amt > 0 ? 255 - c : c))));
  const r = f((v >> 16) & 255);
  const g = f((v >> 8) & 255);
  const b = f(v & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
