import type { Doc, Vec2 } from '../types';
import {
  WALL_H,
  add,
  mul,
  pointInPolygon,
  sub,
  toDeg,
  vlen,
  wallCuts,
  wallEnds,
  wallPolyline,
  zonePolygon,
} from './geometry';

export interface WallBox {
  key: string;
  cx: number; // cm（2D x）
  cz: number; // cm（2D y）
  len: number;
  angle: number; // 2D 角度（度）
  thick: number;
  y0: number;
  y1: number;
  /** 朝向屋外的法線（2D）；內牆 / 兩側皆室內 = null */
  ext: Vec2 | null;
}

/** 依 2D 牆資料生成 3D 牆體方塊（含門窗洞、共用牆略過、曲線離散） */
export function buildWallBoxes(doc: Doc): WallBox[] {
  const polys = doc.zones.map((z) => zonePolygon(doc, z));
  const inside = (p: Vec2) => polys.some((poly) => pointInPolygon(p, poly));
  const boxes: WallBox[] = [];

  const extNormal = (mid: Vec2, n: Vec2, thick: number): Vec2 | null => {
    const off = thick / 2 + 12;
    const s1 = inside(add(mid, mul(n, off)));
    const s2 = inside(sub(mid, mul(n, off)));
    if (s1 && !s2) return mul(n, -1);
    if (!s1 && s2) return n;
    return null;
  };

  for (const wall of doc.walls) {
    if (wall.open) continue;
    const T = wall.thickness;

    if (wall.curve) {
      const pts = wallPolyline(doc, wall, 24);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const L = vlen(sub(b, a));
        if (L < 0.5) continue;
        const u = mul(sub(b, a), 1 / L);
        const mid = mul(add(a, b), 0.5);
        boxes.push({
          key: `${wall.id}:c${i}`,
          cx: mid.x,
          cz: mid.y,
          len: L + T * 0.35,
          angle: toDeg(Math.atan2(u.y, u.x)),
          thick: T,
          y0: 0,
          y1: WALL_H,
          ext: extNormal(mid, { x: -u.y, y: u.x }, T),
        });
      }
      continue;
    }

    const [a, b] = wallEnds(doc, wall);
    const L = vlen(sub(b, a));
    if (L < 1) continue;
    const u = mul(sub(b, a), 1 / L);
    const n = { x: -u.y, y: u.x };
    const angle = toDeg(Math.atan2(u.y, u.x));
    const cuts = wallCuts(doc, wall);
    const bps = new Set<number>([0, L]);
    for (const c of cuts) {
      bps.add(Math.max(0, Math.min(L, c.t0)));
      bps.add(Math.max(0, Math.min(L, c.t1)));
    }
    const sorted = [...bps].sort((p, q) => p - q);
    let idx = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i];
      const e = sorted[i + 1];
      if (e - s < 0.5) continue;
      const mid = (s + e) / 2;
      const active = cuts.filter((c) => c.t0 <= mid && c.t1 >= mid).sort((p, q) => p.y0 - q.y0);
      const ranges: [number, number][] = [];
      let cursor = 0;
      for (const c of active) {
        if (c.y0 > cursor) ranges.push([cursor, Math.min(c.y0, WALL_H)]);
        cursor = Math.max(cursor, c.y1);
      }
      if (cursor < WALL_H) ranges.push([cursor, WALL_H]);
      // 牆端延伸半個牆厚，補滿轉角
      const sx = s <= 0.01 ? s - T / 2 : s;
      const ex = e >= L - 0.01 ? e + T / 2 : e;
      const c = add(a, mul(u, (sx + ex) / 2));
      const ext = extNormal(add(a, mul(u, mid)), n, T);
      for (const [y0, y1] of ranges) {
        if (y1 - y0 < 0.5) continue;
        boxes.push({ key: `${wall.id}:${idx++}`, cx: c.x, cz: c.y, len: ex - sx, angle, thick: T, y0, y1, ext });
      }
    }
  }
  return boxes;
}
