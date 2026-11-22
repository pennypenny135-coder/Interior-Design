import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent, ReactElement } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { useStore } from '../store';
import type { Item, Vec2, Wall } from '../types';
import {
  PX_PER_CM,
  bezier,
  computeIssues,
  controlForMid,
  dot,
  isOpeningItem,
  m2ToSqft,
  mul,
  normDeg,
  nodeOf,
  polygonCentroid,
  sharedGeom,
  snapOpeningToWall,
  snapVal,
  sub,
  toDeg,
  vlen,
  wallEnds,
  wallLength,
  wallPolyline,
  zoneAreaM2,
  zoneAt,
  zonePolygon,
  docBounds,
} from '../lib/geometry';
import { reconcileShared, translateZone } from '../lib/docOps';
import { DoorSymbol, FrontArrow, ItemBody } from './items2d';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number; moved: boolean }
  | { kind: 'item'; id: string; off: Vec2; sx: number; sy: number; started: boolean }
  | { kind: 'zone'; id: string; start: Vec2; last: Vec2; sx: number; sy: number; started: boolean }
  | { kind: 'node'; id: string }
  | { kind: 'wall'; id: string; start: Vec2; a0: Vec2; b0: Vec2; n: Vec2; sx: number; sy: number; started: boolean }
  | { kind: 'curve'; id: string }
  | { kind: 'rotate'; id: string };

const pathOf = (pts: Vec2[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

export default function Canvas2D() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const zoom = useStore((s) => s.zoom);
  const pan = useStore((s) => s.pan);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const fitted = useRef(false);

  const s = PX_PER_CM * zoom;
  const k = 1 / s;

  const issues = useMemo(() => computeIssues(doc), [doc]);

  // 尺寸監聽
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = (w = size.w, h = size.h) => {
    const d = useStore.getState().doc;
    const b = docBounds(d);
    if (!b) {
      useStore.getState().setView(1, { x: 60, y: 60 });
      return;
    }
    const bw = b.maxX - b.minX + 120;
    const bh = b.maxY - b.minY + 120;
    const z = Math.max(0.3, Math.min(3, Math.min(w / (bw * PX_PER_CM), h / (bh * PX_PER_CM))));
    const sc = PX_PER_CM * z;
    useStore.getState().setView(z, {
      x: w / 2 - ((b.minX + b.maxX) / 2) * sc,
      y: h / 2 - ((b.minY + b.maxY) / 2) * sc,
    });
  };

  useEffect(() => {
    if (!fitted.current && size.w > 100) {
      fitted.current = true;
      fit(size.w, size.h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // 視窗中心（新增元件時使用）
  useEffect(() => {
    useStore.getState().setViewCenter({ x: (size.w / 2 - pan.x) / s, y: (size.h / 2 - pan.y) / s });
  }, [size, pan, s]);

  const toWorld = (e: { clientX: number; clientY: number }): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    const st = useStore.getState();
    const sc = PX_PER_CM * st.zoom;
    return { x: (e.clientX - r.left - st.pan.x) / sc, y: (e.clientY - r.top - st.pan.y) / sc };
  };

  // 滾輪縮放（非 passive）
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStore.getState();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const s0 = PX_PER_CM * st.zoom;
      const nz = Math.max(0.2, Math.min(5, st.zoom * Math.pow(1.0015, -e.deltaY)));
      const s1 = PX_PER_CM * nz;
      const wx = (mx - st.pan.x) / s0;
      const wy = (my - st.pan.y) / s0;
      st.setView(nz, { x: mx - wx * s1, y: my - wy * s1 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const startDrag = (e: RPointerEvent, drag: Drag, tx = true) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = drag;
    if (tx) useStore.getState().beginTx();
  };

  const onBgDown = (e: RPointerEvent) => {
    const st = useStore.getState();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: st.pan.x, py: st.pan.y, moved: false };
  };

  const onMove = (e: RPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const st = useStore.getState();
    if (d.kind === 'pan') {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      st.setView(st.zoom, { x: d.px + dx, y: d.py + dy });
      return;
    }
    const w = toWorld(e);
    switch (d.kind) {
      case 'item': {
        if (!d.started) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
          d.started = true;
        }
        const target = { x: snapVal(w.x - d.off.x, st.snap), y: snapVal(w.y - d.off.y, st.snap) };
        st.live((doc) => {
          const it = doc.items.find((i) => i.id === d.id);
          if (!it) return;
          if (isOpeningItem(it)) {
            const r = snapOpeningToWall(doc, it, target);
            if (r) Object.assign(it, r);
            else {
              it.x = target.x;
              it.y = target.y;
            }
          } else {
            it.x = target.x;
            it.y = target.y;
          }
          const z = zoneAt(doc, { x: it.x, y: it.y });
          if (z) it.zoneId = z.id;
        });
        break;
      }
      case 'zone': {
        if (!d.started) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
          d.started = true;
        }
        const dx = snapVal(w.x - d.start.x, st.snap);
        const dy = snapVal(w.y - d.start.y, st.snap);
        const ddx = dx - d.last.x;
        const ddy = dy - d.last.y;
        if (!ddx && !ddy) return;
        d.last = { x: dx, y: dy };
        st.live((doc) => translateZone(doc, d.id, ddx, ddy));
        break;
      }
      case 'node': {
        const p = { x: snapVal(w.x, st.snap), y: snapVal(w.y, st.snap) };
        st.live((doc) => {
          const n = doc.nodes[d.id];
          if (n) {
            n.x = p.x;
            n.y = p.y;
          }
        });
        break;
      }
      case 'wall': {
        if (!d.started) {
          if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
          d.started = true;
        }
        const sv = snapVal(dot(sub(w, d.start), d.n), st.snap);
        st.live((doc) => {
          const wl = doc.walls.find((x) => x.id === d.id);
          if (!wl) return;
          const na = doc.nodes[wl.a];
          const nb = doc.nodes[wl.b];
          na.x = d.a0.x + d.n.x * sv;
          na.y = d.a0.y + d.n.y * sv;
          nb.x = d.b0.x + d.n.x * sv;
          nb.y = d.b0.y + d.n.y * sv;
        });
        break;
      }
      case 'curve': {
        const p = { x: snapVal(w.x, st.snap, 5), y: snapVal(w.y, st.snap, 5) };
        st.live((doc) => {
          const wl = doc.walls.find((x) => x.id === d.id);
          if (!wl) return;
          const [a, b] = wallEnds(doc, wl);
          wl.curve = controlForMid(a, b, p);
        });
        break;
      }
      case 'rotate': {
        st.live((doc) => {
          const it = doc.items.find((i) => i.id === d.id);
          if (!it) return;
          let ang = toDeg(Math.atan2(w.y - it.y, w.x - it.x)) + 90;
          if (!e.altKey) ang = Math.round(ang / 15) * 15;
          it.rotation = normDeg(ang);
        });
        break;
      }
    }
  };

  const onUp = (e: RPointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d) return;
    const st = useStore.getState();
    if (d.kind === 'pan') {
      if (!d.moved) st.select(null);
      return;
    }
    if (d.kind === 'zone' && d.started) st.live((doc) => reconcileShared(doc, d.id));
    else if (d.kind === 'node' || d.kind === 'wall' || d.kind === 'curve') st.live((doc) => reconcileShared(doc));
    st.endTx();
  };

  // ---------- 渲染 ----------
  const vx = -pan.x / s;
  const vy = -pan.y / s;
  const vw = size.w / s;
  const vh = size.h / s;
  const showMinor = 10 * s >= 6;

  const selZone =
    selection?.kind === 'zone'
      ? doc.zones.find((z) => z.id === selection.id)
      : selection?.kind === 'wall'
        ? doc.zones.find((z) => z.id === doc.walls.find((w) => w.id === selection.id)?.zoneId)
        : undefined;
  const selWall = selection?.kind === 'wall' ? doc.walls.find((w) => w.id === selection.id) : undefined;
  const secondary = new Set(doc.shared.map((x) => x.wallB));

  const renderWall = (w: Wall) => {
    const pts = wallPolyline(doc, w, 24);
    const [a, b] = wallEnds(doc, w);
    const d = w.curve ? `M ${a.x} ${a.y} Q ${w.curve.x} ${w.curve.y} ${b.x} ${b.y}` : pathOf(pts);
    const sel = selection?.kind === 'wall' && selection.id === w.id;
    const zone = doc.zones.find((z) => z.id === w.zoneId);
    const mid = w.curve ? bezier(a, w.curve, b, 0.5) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let label: ReactElement | null = null;
    if (!secondary.has(w.id)) {
      const l = vlen(sub(b, a)) || 1;
      let n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
      const c = zone ? polygonCentroid(zonePolygon(doc, zone)) : mid;
      if (dot(n, sub(mid, c)) < 0) n = mul(n, -1);
      const off = w.thickness / 2 + 12 * k;
      label = (
        <text
          x={mid.x + n.x * off}
          y={mid.y + n.y * off}
          fontSize={10 * k}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#64748b"
          stroke="#ffffff"
          strokeWidth={3 * k}
          paintOrder="stroke"
          style={{ pointerEvents: 'none' }}
        >
          {Math.round(wallLength(doc, w))} cm
        </text>
      );
    }
    return (
      <g key={w.id}>
        {sel && <path d={d} fill="none" stroke="#3b82f6" strokeOpacity={0.45} strokeWidth={w.thickness + 8 * k} strokeLinecap="square" />}
        {w.open ? (
          <path d={d} fill="none" stroke="#94a3b8" strokeWidth={2 * k} strokeDasharray={`${6 * k} ${4 * k}`} />
        ) : (
          <path d={d} fill="none" stroke="#1e293b" strokeWidth={w.thickness} strokeLinecap="square" strokeLinejoin="miter" />
        )}
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(w.thickness, 12 * k)}
          style={{ pointerEvents: 'stroke', cursor: sel ? 'move' : 'pointer' }}
          onPointerDown={(e) => {
            const st = useStore.getState();
            if (e.button !== 0) return;
            if (sel) {
              const l = vlen(sub(b, a)) || 1;
              const n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
              startDrag(e, { kind: 'wall', id: w.id, start: toWorld(e), a0: a, b0: b, n, sx: e.clientX, sy: e.clientY, started: false });
            } else {
              e.stopPropagation();
              st.select({ kind: 'wall', id: w.id });
            }
          }}
        />
        {label}
      </g>
    );
  };

  const renderItem = (it: Item) => {
    const sel = selection?.kind === 'item' && selection.id === it.id;
    const issue = issues[it.id];
    const hw = it.w / 2;
    const hd = it.d / 2;
    const opening = isOpeningItem(it);
    const r = 8 * k;
    const ctrlY = -hd - 26 * k;
    return (
      <g key={it.id}>
        <g
          transform={`translate(${it.x} ${it.y}) rotate(${it.rotation})`}
          style={{ cursor: 'move' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const wpt = toWorld(e);
            useStore.getState().select({ kind: 'item', id: it.id });
            startDrag(e, { kind: 'item', id: it.id, off: { x: wpt.x - it.x, y: wpt.y - it.y }, sx: e.clientX, sy: e.clientY, started: false });
          }}
        >
          <ItemBody item={it} k={k} />
          <FrontArrow item={it} k={k} />
          <rect x={-hw} y={-Math.max(hd, 10 * k)} width={it.w} height={Math.max(it.d, 20 * k)} fill="transparent" />
          {issue && (
            <rect
              x={-hw}
              y={-hd}
              width={it.w}
              height={it.d}
              fill="rgba(239,68,68,0.32)"
              stroke="#ef4444"
              strokeWidth={2 * k}
              strokeDasharray={`${5 * k} ${3 * k}`}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
        {!opening && (
          <text
            x={it.x}
            y={it.y}
            fontSize={10 * k}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#0f172a"
            stroke="#ffffff"
            strokeWidth={3 * k}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {it.name} {Math.round(it.w)}×{Math.round(it.d)}
          </text>
        )}
        {sel && (
          <g transform={`translate(${it.x} ${it.y}) rotate(${it.rotation})`}>
            <rect
              x={-hw - 3 * k}
              y={-hd - 3 * k}
              width={it.w + 6 * k}
              height={it.d + 6 * k}
              fill="none"
              stroke={issue ? '#ef4444' : '#2563eb'}
              strokeWidth={1.5 * k}
              strokeDasharray={`${5 * k} ${3 * k}`}
              style={{ pointerEvents: 'none' }}
            />
            {!opening && (
              <>
                <line x1={0} y1={-hd - 3 * k} x2={0} y2={ctrlY} stroke="#2563eb" strokeWidth={1.2 * k} />
                <circle
                  cx={0}
                  cy={ctrlY}
                  r={r}
                  fill="#ffffff"
                  stroke="#2563eb"
                  strokeWidth={1.5 * k}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => startDrag(e, { kind: 'rotate', id: it.id })}
                />
                <text x={0} y={ctrlY} fontSize={11 * k} textAnchor="middle" dominantBaseline="central" fill="#2563eb" style={{ pointerEvents: 'none' }}>
                  ⟳
                </text>
                <g
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    useStore.getState().act((d) => {
                      const x = d.items.find((i) => i.id === it.id);
                      if (x) x.rotation = normDeg(x.rotation + 90);
                    });
                  }}
                >
                  <circle cx={-24 * k} cy={ctrlY} r={r} fill="#2563eb" />
                  <text x={-24 * k} y={ctrlY} fontSize={7 * k} textAnchor="middle" dominantBaseline="central" fill="#fff" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    90°
                  </text>
                </g>
              </>
            )}
            <g
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const st = useStore.getState();
                st.act((d) => {
                  d.items = d.items.filter((i) => i.id !== it.id);
                });
                st.select(null);
              }}
            >
              <circle cx={opening ? 0 : 24 * k} cy={opening ? -hd - 18 * k : ctrlY} r={r} fill="#ef4444" />
              <text
                x={opening ? 0 : 24 * k}
                y={opening ? -hd - 18 * k : ctrlY}
                fontSize={12 * k}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                style={{ pointerEvents: 'none' }}
              >
                ×
              </text>
            </g>
          </g>
        )}
      </g>
    );
  };

  const nodeHandles = selZone
    ? selZone.nodeIds.map((id) => {
        const p = nodeOf(doc, id);
        return (
          <circle
            key={id}
            cx={p.x}
            cy={p.y}
            r={6 * k}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={2 * k}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => e.button === 0 && startDrag(e, { kind: 'node', id })}
          />
        );
      })
    : null;

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-white overflow-hidden select-none">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor: 'default' }}
        onPointerDown={onBgDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <pattern id="grid100" width={100} height={100} patternUnits="userSpaceOnUse">
            {showMinor && (
              <path
                d={Array.from({ length: 9 }, (_, i) => `M ${(i + 1) * 10} 0 V 100 M 0 ${(i + 1) * 10} H 100`).join(' ')}
                stroke="#eef1f4"
                strokeWidth={k}
                fill="none"
              />
            )}
            <path d="M 50 0 V 100 M 0 50 H 100" stroke="#dde2e8" strokeWidth={k} fill="none" />
            <path d="M 0 0 V 100 M 0 0 H 100" stroke="#c4ccd6" strokeWidth={k * 1.2} fill="none" />
          </pattern>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${s})`}>
          <rect x={vx} y={vy} width={vw} height={vh} fill="url(#grid100)" />

          {/* 分區地面 */}
          {doc.zones.map((z) => {
            const poly = zonePolygon(doc, z);
            const sel = selection?.kind === 'zone' && selection.id === z.id;
            return (
              <polygon
                key={z.id}
                points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={z.color}
                fillOpacity={0.5}
                stroke={sel ? '#2563eb' : 'none'}
                strokeWidth={2 * k}
                strokeDasharray={`${6 * k} ${4 * k}`}
                style={{ cursor: 'move' }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  useStore.getState().select({ kind: 'zone', id: z.id });
                  startDrag(e, { kind: 'zone', id: z.id, start: toWorld(e), last: { x: 0, y: 0 }, sx: e.clientX, sy: e.clientY, started: false });
                }}
              />
            );
          })}

          {doc.walls.map(renderWall)}

          {/* 共用牆疊加 */}
          {doc.shared.map((sh) => {
            const g = sharedGeom(doc, sh);
            if (!g) return null;
            const sel = selection?.kind === 'shared' && selection.id === sh.id;
            const op = sh.opening;
            const ang = toDeg(Math.atan2(g.u.y, g.u.x));
            const c = op ? { x: g.p.x + g.u.x * op.center, y: g.p.y + g.u.y * op.center } : null;
            return (
              <g key={sh.id}>
                <line
                  x1={g.p.x}
                  y1={g.p.y}
                  x2={g.q.x}
                  y2={g.q.y}
                  stroke={sel ? '#2563eb' : '#d97706'}
                  strokeWidth={g.thickness}
                  strokeOpacity={0.9}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    useStore.getState().select({ kind: 'shared', id: sh.id });
                  }}
                />
                {op && c && (
                  <g transform={`translate(${c.x} ${c.y}) rotate(${ang})`} style={{ pointerEvents: 'none' }}>
                    {op.kind === 'door' ? (
                      <DoorSymbol w={op.width} d={g.thickness} hinge={op.hinge} swing={op.swing} k={k} />
                    ) : (
                      <g>
                        <rect
                          x={-op.width / 2}
                          y={-g.thickness / 2 - 0.5}
                          width={op.width}
                          height={g.thickness + 1}
                          fill={op.kind === 'bar' ? '#fef3c7' : '#ffffff'}
                        />
                        <line x1={-op.width / 2} y1={-g.thickness / 2} x2={-op.width / 2} y2={g.thickness / 2} stroke="#475569" strokeWidth={2 * k} />
                        <line x1={op.width / 2} y1={-g.thickness / 2} x2={op.width / 2} y2={g.thickness / 2} stroke="#475569" strokeWidth={2 * k} />
                        {op.kind === 'bar' && (
                          <>
                            <line x1={-op.width / 2} y1={0} x2={op.width / 2} y2={0} stroke="#b45309" strokeWidth={3 * k} />
                            <text y={-g.thickness / 2 - 8 * k} fontSize={9 * k} textAnchor="middle" fill="#b45309">
                              吧檯
                            </text>
                          </>
                        )}
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* 分區標籤 */}
          {doc.zones.map((z) => {
            const poly = zonePolygon(doc, z);
            if (!poly.length) return null;
            const minX = Math.min(...poly.map((p) => p.x));
            const minY = Math.min(...poly.map((p) => p.y));
            const m2 = zoneAreaM2(doc, z);
            return (
              <text key={z.id} x={minX + 14} y={minY + 26} fontSize={12 * k} fill="#334155" style={{ pointerEvents: 'none' }} fontWeight={600}>
                {z.name}
                <tspan x={minX + 14} dy={14 * k} fontSize={10 * k} fontWeight={400} fill="#64748b">
                  {m2.toFixed(1)} m² / {m2ToSqft(m2).toFixed(0)} 平方呎
                </tspan>
              </text>
            );
          })}

          {doc.items.filter(isOpeningItem).map(renderItem)}
          {doc.items.filter((i) => !isOpeningItem(i)).map(renderItem)}

          {/* 節點 & 曲線手把 */}
          {nodeHandles}
          {selWall?.curve &&
            (() => {
              const [a, b] = wallEnds(doc, selWall);
              const c = selWall.curve!;
              const m = bezier(a, c, b, 0.5);
              return (
                <g>
                  <polyline points={`${a.x},${a.y} ${c.x},${c.y} ${b.x},${b.y}`} fill="none" stroke="#f97316" strokeWidth={1 * k} strokeDasharray={`${4 * k} ${3 * k}`} />
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={7 * k}
                    fill="#f97316"
                    stroke="#fff"
                    strokeWidth={2 * k}
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => e.button === 0 && startDrag(e, { kind: 'curve', id: selWall.id })}
                  />
                </g>
              );
            })()}

        </g>
      </svg>

      {doc.zones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm">
          畫布是空的 — 請從上方「新增分區」開始規劃
        </div>
      )}

      <div className="absolute left-3 top-3 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow border border-slate-200 p-1">
        <button className="p-1.5 hover:bg-slate-100 rounded" title="縮小" onClick={() => useStore.getState().setView(Math.max(0.2, zoom / 1.25), pan)}>
          <Minus size={16} />
        </button>
        <span className="text-xs w-12 text-center tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
        <button className="p-1.5 hover:bg-slate-100 rounded" title="放大" onClick={() => useStore.getState().setView(Math.min(5, zoom * 1.25), pan)}>
          <Plus size={16} />
        </button>
        <button className="p-1.5 hover:bg-slate-100 rounded" title="適應畫面" onClick={() => fit()}>
          <Maximize size={16} />
        </button>
      </div>
      <div className="absolute left-3 bottom-3 text-[11px] text-slate-500 bg-white/80 rounded px-2 py-1 pointer-events-none">
        拖曳空白處平移 · 滾輪縮放 · 拖曳分區可拼合共用牆 · 旋轉時按住 Alt 取消 15° 吸附
      </div>
    </div>
  );
}

