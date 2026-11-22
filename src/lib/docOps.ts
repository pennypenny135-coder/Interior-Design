import type { Doc, Item, ItemType, RoomZone, Selection, SharedOpening, Vec2, Wall, WallNode, ZoneType } from '../types';
import { CAT } from './catalog';
import {
  MERGE_DIST,
  MERGE_MIN_OVERLAP,
  WALL_T,
  add,
  bezier,
  clone,
  controlForMid,
  dot,
  docBounds,
  lerp,
  mul,
  normDeg,
  pairKey,
  pairMetrics,
  rotatePoint,
  sharedGeom,
  sub,
  uid,
  vlen,
  wallEnds,
  wallLength,
  zoneAt,
  zoneCentroid,
  zoneWalls,
  isOpeningItem,
  toDeg,
  wallCuts,
} from './geometry';

export function emptyDoc(): Doc {
  return { nodes: {}, walls: [], zones: [], items: [], shared: [], blocked: [] };
}

// ---------- 分區 ----------
export function freeOrigin(doc: Doc): Vec2 {
  const b = docBounds(doc);
  if (!b) return { x: 100, y: 100 };
  if (b.maxX > 1800) return { x: b.minX, y: b.maxY + 80 };
  return { x: Math.round((b.maxX + 80) / 10) * 10, y: Math.round(b.minY / 10) * 10 };
}

export function createRectZone(
  doc: Doc,
  p: { name: string; type: ZoneType; w: number; d: number; color: string },
  origin?: Vec2,
): string {
  const o = origin ?? freeOrigin(doc);
  const zoneId = uid('zone');
  const pts = [
    { x: o.x, y: o.y },
    { x: o.x + p.w, y: o.y },
    { x: o.x + p.w, y: o.y + p.d },
    { x: o.x, y: o.y + p.d },
  ];
  const ids = pts.map((pt) => {
    const id = uid('n');
    doc.nodes[id] = { id, x: pt.x, y: pt.y };
    return id;
  });
  ids.forEach((a, i) => {
    doc.walls.push({ id: uid('w'), zoneId, a, b: ids[(i + 1) % ids.length], thickness: WALL_T, curve: null, open: false });
  });
  const same = doc.zones.filter((z) => z.name === p.name || z.name.startsWith(p.name + ' ')).length;
  doc.zones.push({ id: zoneId, name: same ? `${p.name} ${same + 1}` : p.name, type: p.type, color: p.color, nodeIds: ids });
  return zoneId;
}

export function translateZone(doc: Doc, zoneId: string, dx: number, dy: number) {
  const z = doc.zones.find((x) => x.id === zoneId);
  if (!z) return;
  for (const id of z.nodeIds) {
    const n = doc.nodes[id];
    if (n) {
      n.x += dx;
      n.y += dy;
    }
  }
  for (const w of doc.walls) if (w.zoneId === zoneId && w.curve) w.curve = { x: w.curve.x + dx, y: w.curve.y + dy };
  for (const it of doc.items) if (it.zoneId === zoneId) {
    it.x += dx;
    it.y += dy;
  }
}

export function rotateZone90(doc: Doc, zoneId: string) {
  const z = doc.zones.find((x) => x.id === zoneId);
  if (!z) return;
  const c = zoneCentroid(doc, z);
  const rc = { x: Math.round(c.x / 10) * 10, y: Math.round(c.y / 10) * 10 };
  for (const id of z.nodeIds) {
    const n = doc.nodes[id];
    const p = rotatePoint(n, 90, rc);
    n.x = Math.round(p.x * 10) / 10;
    n.y = Math.round(p.y * 10) / 10;
  }
  for (const w of doc.walls) if (w.zoneId === zoneId && w.curve) w.curve = rotatePoint(w.curve, 90, rc);
  for (const it of doc.items) if (it.zoneId === zoneId) {
    const p = rotatePoint(it, 90, rc);
    it.x = p.x;
    it.y = p.y;
    it.rotation = normDeg(it.rotation + 90);
  }
  reconcileShared(doc);
}

export function deleteZone(doc: Doc, zoneId: string) {
  const z = doc.zones.find((x) => x.id === zoneId);
  if (!z) return;
  const wallIds = new Set(doc.walls.filter((w) => w.zoneId === zoneId).map((w) => w.id));
  for (const id of z.nodeIds) delete doc.nodes[id];
  doc.walls = doc.walls.filter((w) => w.zoneId !== zoneId);
  doc.items = doc.items.filter((i) => i.zoneId !== zoneId);
  doc.zones = doc.zones.filter((x) => x.id !== zoneId);
  doc.shared = doc.shared.filter((s) => !wallIds.has(s.wallA) && !wallIds.has(s.wallB));
  doc.blocked = doc.blocked.filter((k) => !k.split('|').some((id) => wallIds.has(id)));
}

// ---------- 牆 ----------
export function splitWall(doc: Doc, wallId: string) {
  const w = doc.walls.find((x) => x.id === wallId);
  if (!w) return;
  const z = doc.zones.find((x) => x.id === w.zoneId);
  if (!z) return;
  const [a, b] = wallEnds(doc, w);
  const mp = w.curve ? bezier(a, w.curve, b, 0.5) : lerp(a, b, 0.5);
  const m: WallNode = { id: uid('n'), x: Math.round(mp.x * 10) / 10, y: Math.round(mp.y * 10) / 10 };
  doc.nodes[m.id] = m;
  const i = z.nodeIds.indexOf(w.a);
  z.nodeIds.splice(i + 1, 0, m.id);
  const w2: Wall = { ...clone(w), id: uid('w'), a: m.id, b: w.b };
  if (w.curve) {
    w2.curve = lerp(w.curve, b, 0.5);
    w.curve = lerp(a, w.curve, 0.5);
  }
  w.b = m.id;
  doc.walls.splice(doc.walls.indexOf(w) + 1, 0, w2);
  reconcileShared(doc);
}

export function removeWallSegment(doc: Doc, wallId: string) {
  const w = doc.walls.find((x) => x.id === wallId);
  if (!w) return;
  const z = doc.zones.find((x) => x.id === w.zoneId);
  if (!z || z.nodeIds.length <= 3) return;
  const next = doc.walls.find((x) => x.zoneId === w.zoneId && x.a === w.b);
  if (next) next.a = w.a;
  z.nodeIds = z.nodeIds.filter((id) => id !== w.b);
  delete doc.nodes[w.b];
  doc.walls = doc.walls.filter((x) => x.id !== wallId);
  doc.shared = doc.shared.filter((s) => s.wallA !== wallId && s.wallB !== wallId);
  reconcileShared(doc);
}

export function toggleCurve(doc: Doc, wallId: string) {
  const w = doc.walls.find((x) => x.id === wallId);
  if (!w) return;
  if (w.curve) {
    w.curve = null;
  } else {
    const [a, b] = wallEnds(doc, w);
    const l = vlen(sub(b, a)) || 1;
    const u = mul(sub(b, a), 1 / l);
    const n = { x: -u.y, y: u.x };
    const mid = lerp(a, b, 0.5);
    // 預設向外鼓出（順時針迴圈的外側為 -n）
    const peak = add(mid, mul(n, -Math.min(60, l * 0.25)));
    w.curve = controlForMid(a, b, peak);
  }
  reconcileShared(doc);
}

// ---------- 共用牆 ----------
export function reconcileShared(doc: Doc, movedZoneId?: string) {
  const find = (id: string) => doc.walls.find((w) => w.id === id);
  doc.shared = doc.shared.filter((sh) => {
    const wa = find(sh.wallA);
    const wb = find(sh.wallB);
    if (!wa || !wb || wa.open || wb.open) return false;
    const m = pairMetrics(doc, wa, wb);
    return !!m && Math.abs(m.d) <= 1.5 && m.overlap >= 20;
  });
  doc.blocked = doc.blocked.filter((k) => {
    const [ia, ib] = k.split('|');
    const wa = find(ia);
    const wb = find(ib);
    if (!wa || !wb) return false;
    const m = pairMetrics(doc, wa, wb);
    return !!m && Math.abs(m.d) <= 25 && m.overlap >= 20;
  });
  const taken = (a: string, b: string) =>
    doc.blocked.includes(pairKey(a, b)) || doc.shared.some((s) => pairKey(s.wallA, s.wallB) === pairKey(a, b));
  const usable = (w: Wall) => !w.open && !w.curve;

  if (movedZoneId) {
    let best: { score: number; dx: number; dy: number } | null = null;
    for (const wb of doc.walls.filter((w) => w.zoneId === movedZoneId && usable(w))) {
      for (const wa of doc.walls.filter((w) => w.zoneId !== movedZoneId && usable(w))) {
        if (taken(wa.id, wb.id)) continue;
        const m = pairMetrics(doc, wa, wb);
        if (!m || Math.abs(m.d) > MERGE_DIST || m.overlap < MERGE_MIN_OVERLAP) continue;
        const score = Math.abs(m.d) - m.overlap * 0.001;
        if (!best || score < best.score) best = { score, dx: -m.d * m.n.x, dy: -m.d * m.n.y };
      }
    }
    if (best && (Math.abs(best.dx) > 0.01 || Math.abs(best.dy) > 0.01)) translateZone(doc, movedZoneId, best.dx, best.dy);
  }

  const ws = doc.walls.filter(usable);
  for (let i = 0; i < ws.length; i++) {
    for (let j = i + 1; j < ws.length; j++) {
      let wa = ws[i];
      let wb = ws[j];
      if (wa.zoneId === wb.zoneId) continue;
      if (wa.zoneId === movedZoneId) [wa, wb] = [wb, wa];
      if (taken(wa.id, wb.id)) continue;
      const m = pairMetrics(doc, wa, wb);
      if (!m || Math.abs(m.d) > 1.5 || m.overlap < MERGE_MIN_OVERLAP) continue;
      const snap = (w: Wall) => {
        const [a, b] = wallEnds(doc, w);
        return { wallId: w.id, zoneId: w.zoneId, a, b, thickness: w.thickness };
      };
      doc.shared.push({
        id: uid('sh'),
        wallA: wa.id,
        wallB: wb.id,
        zoneA: wa.zoneId,
        zoneB: wb.zoneId,
        original: [snap(wa), snap(wb)],
        opening: null,
      });
    }
  }
}

/** 移除共用牆：還原為兩道獨立牆，並把 B 分區推開一個牆厚 */
export function removeShared(doc: Doc, id: string) {
  const sh = doc.shared.find((s) => s.id === id);
  if (!sh) return;
  const g = sharedGeom(doc, sh);
  doc.shared = doc.shared.filter((s) => s.id !== id);
  doc.blocked.push(pairKey(sh.wallA, sh.wallB));
  const zb = doc.zones.find((z) => z.id === sh.zoneB);
  if (g && zb) {
    const side = dot(sub(zoneCentroid(doc, zb), g.p), g.n) >= 0 ? 1 : -1;
    translateZone(doc, zb.id, g.n.x * side * g.thickness, g.n.y * side * g.thickness);
  }
}

export function setSharedOpening(doc: Doc, id: string, kind: SharedOpening['kind'] | null) {
  const sh = doc.shared.find((s) => s.id === id);
  if (!sh) return;
  if (!kind) {
    sh.opening = null;
    return;
  }
  const g = sharedGeom(doc, sh);
  if (!g) return;
  const width = Math.max(30, Math.min(kind === 'door' ? 90 : 150, g.len - 10));
  sh.opening = {
    kind,
    center: sh.opening ? Math.min(sh.opening.center, g.len - width / 2) : g.len / 2,
    width,
    hinge: sh.opening?.hinge ?? 'left',
    swing: sh.opening?.swing ?? 'in',
  };
}

// ---------- 傢俬 ----------
export function zoneFromSelection(doc: Doc, sel: Selection): RoomZone | undefined {
  if (!sel) return undefined;
  if (sel.kind === 'zone') return doc.zones.find((z) => z.id === sel.id);
  if (sel.kind === 'item') {
    const it = doc.items.find((i) => i.id === sel.id);
    return doc.zones.find((z) => z.id === it?.zoneId);
  }
  if (sel.kind === 'wall') {
    const w = doc.walls.find((x) => x.id === sel.id);
    return doc.zones.find((z) => z.id === w?.zoneId);
  }
  const sh = doc.shared.find((s) => s.id === sel.id);
  return doc.zones.find((z) => z.id === sh?.zoneA);
}

export function addItem(doc: Doc, type: ItemType, sel: Selection, viewCenter: Vec2): string {
  const cat = CAT[type];
  const zone = zoneFromSelection(doc, sel) ?? zoneAt(doc, viewCenter) ?? doc.zones[0];
  const item: Item = {
    id: uid('i'),
    type,
    name: cat.name,
    x: viewCenter.x,
    y: viewCenter.y,
    w: cat.w,
    d: cat.d,
    h: cat.h,
    rotation: 0,
    elevation: cat.elevation,
    color: cat.color,
    zoneId: zone?.id,
    variant: cat.variant,
    hinge: 'left',
    swing: 'in',
  };
  if (zone) {
    const c = zoneCentroid(doc, zone);
    const n = doc.items.filter((i) => i.zoneId === zone.id).length;
    const off = (n % 6) * 25;
    item.x = Math.round((c.x + off) / 10) * 10;
    item.y = Math.round((c.y + off) / 10) * 10;
    if (isOpeningItem(item)) placeOnWall(doc, zone, item);
  } else {
    item.x = Math.round(item.x / 10) * 10;
    item.y = Math.round(item.y / 10) * 10;
  }
  doc.items.push(item);
  return item.id;
}

function placeOnWall(doc: Doc, zone: RoomZone, item: Item) {
  const walls = zoneWalls(doc, zone)
    .filter((w) => !w.open && !w.curve && wallLength(doc, w) >= item.w + 40)
    .sort((a, b) => wallLength(doc, b) - wallLength(doc, a));
  if (!walls.length) return;
  const w = item.type === 'door' ? walls[walls.length - 1] : walls[0];
  const [a, b] = wallEnds(doc, w);
  const L = vlen(sub(b, a));
  const u = mul(sub(b, a), 1 / L);
  const existing = wallCuts(doc, w).length;
  let s = L / 2 + existing * (item.w + 20);
  if (s > L - item.w / 2) s = L / 2;
  const p = add(a, mul(u, s));
  item.x = Math.round(p.x * 10) / 10;
  item.y = Math.round(p.y * 10) / 10;
  item.rotation = normDeg(toDeg(Math.atan2(u.y, u.x)));
  item.d = w.thickness;
}

export function duplicateItem(doc: Doc, id: string): string | null {
  const it = doc.items.find((i) => i.id === id);
  if (!it) return null;
  const copy: Item = { ...clone(it), id: uid('i'), x: it.x + 30, y: it.y + 30 };
  doc.items.push(copy);
  return copy.id;
}

// ---------- 範本（Temp Save 分區） ----------
export function extractZoneTemplate(doc: Doc, zoneId: string): Doc | null {
  const z = doc.zones.find((x) => x.id === zoneId);
  if (!z) return null;
  const t = emptyDoc();
  t.zones = [clone(z)];
  for (const id of z.nodeIds) t.nodes[id] = clone(doc.nodes[id]);
  t.walls = clone(doc.walls.filter((w) => w.zoneId === zoneId));
  t.items = clone(doc.items.filter((i) => i.zoneId === zoneId));
  return t;
}

export function insertTemplate(doc: Doc, tpl: Doc): string | null {
  if (!tpl.zones.length) return null;
  const origin = freeOrigin(doc);
  const tb = docBounds(tpl);
  const dx = origin.x - (tb?.minX ?? 0);
  const dy = origin.y - (tb?.minY ?? 0);
  const nodeMap: Record<string, string> = {};
  const wallMap: Record<string, string> = {};
  const zoneMap: Record<string, string> = {};
  for (const id of Object.keys(tpl.nodes)) nodeMap[id] = uid('n');
  for (const w of tpl.walls) wallMap[w.id] = uid('w');
  for (const z of tpl.zones) zoneMap[z.id] = uid('zone');
  for (const [id, n] of Object.entries(tpl.nodes)) doc.nodes[nodeMap[id]] = { id: nodeMap[id], x: n.x + dx, y: n.y + dy };
  for (const w of tpl.walls)
    doc.walls.push({
      ...w,
      id: wallMap[w.id],
      zoneId: zoneMap[w.zoneId],
      a: nodeMap[w.a],
      b: nodeMap[w.b],
      curve: w.curve ? { x: w.curve.x + dx, y: w.curve.y + dy } : null,
    });
  for (const z of tpl.zones) doc.zones.push({ ...z, id: zoneMap[z.id], nodeIds: z.nodeIds.map((n) => nodeMap[n]) });
  for (const it of tpl.items)
    doc.items.push({ ...it, id: uid('i'), x: it.x + dx, y: it.y + dy, zoneId: it.zoneId ? zoneMap[it.zoneId] : undefined });
  return zoneMap[tpl.zones[0].id];
}

// ---------- 匯入驗證 ----------
export function normalizeDoc(raw: unknown): Doc | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Doc> & { doc?: Doc };
  const src = (r.doc && typeof r.doc === 'object' ? r.doc : r) as Partial<Doc>;
  if (!src.nodes || !Array.isArray(src.walls) || !Array.isArray(src.zones)) return null;
  return {
    nodes: src.nodes,
    walls: src.walls.map((w) => ({ ...w, thickness: w.thickness ?? WALL_T, curve: w.curve ?? null, open: !!w.open })),
    zones: src.zones,
    items: Array.isArray(src.items) ? src.items : [],
    shared: Array.isArray(src.shared) ? src.shared : [],
    blocked: Array.isArray(src.blocked) ? src.blocked : [],
  };
}

export function defaultDoc(): Doc {
  const d = emptyDoc();
  const living = createRectZone(d, { name: '客飯廳', type: 'living', w: 520, d: 400, color: '#bfdbfe' }, { x: 100, y: 100 });
  const bed = createRectZone(d, { name: '睡房', type: 'bedroom', w: 350, d: 300, color: '#fde68a' }, { x: 700, y: 100 });
  const mk = (type: ItemType, zoneId: string, x: number, y: number, rotation = 0, extra: Partial<Item> = {}) => {
    const cat = CAT[type];
    d.items.push({
      id: uid('i'),
      type,
      name: cat.name,
      x,
      y,
      w: cat.w,
      d: cat.d,
      h: cat.h,
      rotation,
      elevation: cat.elevation,
      color: cat.color,
      zoneId,
      variant: cat.variant,
      hinge: 'left',
      swing: 'in',
      ...extra,
    });
  };
  mk('sofa', living, 260, 160 + 0, 0);
  mk('coffee-table', living, 260, 290);
  mk('dining', living, 480, 400);
  mk('bed-double', bed, 875, 210);
  mk('wardrobe', bed, 1000, 330, 90);
  mk('window', bed, 875, 100, 0, { d: 15 });
  mk('door', living, 100, 340, 270, { d: 15 });
  return d;
}
