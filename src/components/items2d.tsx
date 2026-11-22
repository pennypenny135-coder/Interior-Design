import type { Item } from '../types';
import { CAT } from '../lib/catalog';
import { shade } from '../lib/geometry';

const STROKE = '#475569';

/** 門符號（局部座標：x 沿牆、+y = 正面 / 開門側） */
export function DoorSymbol({
  w,
  d,
  hinge,
  swing,
  k,
  color = '#a16207',
}: {
  w: number;
  d: number;
  hinge: 'left' | 'right';
  swing: 'in' | 'out';
  k: number;
  color?: string;
}) {
  const s = swing === 'in' ? 1 : -1;
  const hx = hinge === 'left' ? -w / 2 : w / 2;
  const cx = -hx;
  const sweep = (hinge === 'left') === (s === 1) ? 1 : 0;
  return (
    <g>
      <rect x={-w / 2} y={-d / 2 - 0.5} width={w} height={d + 1} fill="#ffffff" />
      <line x1={-w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} stroke={STROKE} strokeWidth={2 * k} />
      <line x1={w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} stroke={STROKE} strokeWidth={2 * k} />
      <line x1={hx} y1={0} x2={hx} y2={s * w} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <path
        d={`M ${cx} 0 A ${w} ${w} 0 0 ${sweep} ${hx} ${s * w}`}
        fill="none"
        stroke={color}
        strokeWidth={1.2 * k}
        strokeDasharray={`${4 * k} ${3 * k}`}
      />
    </g>
  );
}

export function WindowSymbol({ w, d, k }: { w: number; d: number; k: number }) {
  return (
    <g>
      <rect x={-w / 2} y={-d / 2 - 0.5} width={w} height={d + 1} fill="#ffffff" />
      <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#e0f2fe" stroke="#0284c7" strokeWidth={1.5 * k} />
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#0284c7" strokeWidth={1.5 * k} />
      <line x1={0} y1={-d / 2} x2={0} y2={d / 2} stroke="#0284c7" strokeWidth={1.2 * k} />
    </g>
  );
}

function Rect({
  x,
  y,
  w,
  h,
  fill,
  k,
  r = 0,
  sw = 1,
  dash,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  k: number;
  r?: number;
  sw?: number;
  dash?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill={fill}
      stroke={STROKE}
      strokeWidth={sw * k}
      strokeDasharray={dash ? `${4 * k} ${3 * k}` : undefined}
    />
  );
}

function Tag({ x, y, text, k }: { x: number; y: number; text: string; k: number }) {
  return (
    <text x={x} y={y} fontSize={9 * k} textAnchor="middle" dominantBaseline="middle" fill="#334155" opacity={0.8} style={{ pointerEvents: 'none' }}>
      {text}
    </text>
  );
}

export function ItemBody({ item, k }: { item: Item; k: number }) {
  const { w, d, type, color } = item;
  const hw = w / 2;
  const hd = d / 2;
  const dark = shade(color, -0.25);
  const light = shade(color, 0.35);
  const dir = CAT[type]?.dirLabel;
  switch (type) {
    case 'door':
      return <DoorSymbol w={w} d={d} hinge={item.hinge ?? 'left'} swing={item.swing ?? 'in'} k={k} color={color} />;
    case 'window':
      return <WindowSymbol w={w} d={d} k={k} />;
    case 'bed-single':
    case 'bed-double': {
      const two = type === 'bed-double';
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} r={3} />
          <Rect x={-hw} y={-hd} w={w} h={9} fill={dark} k={k} />
          {two ? (
            <>
              <Rect x={-hw + 8} y={-hd + 14} w={w / 2 - 12} h={32} fill="#ffffff" k={k} r={6} />
              <Rect x={4} y={-hd + 14} w={w / 2 - 12} h={32} fill="#ffffff" k={k} r={6} />
            </>
          ) : (
            <Rect x={-w * 0.3} y={-hd + 14} w={w * 0.6} h={32} fill="#ffffff" k={k} r={6} />
          )}
          <line x1={-hw} y1={-hd + 70} x2={hw} y2={-hd + 70} stroke={dark} strokeWidth={1.5 * k} />
          <Tag x={0} y={-hd + 4.5} text={dir ?? ''} k={k * 0.8} />
        </g>
      );
    }
    case 'sofa':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} r={6} />
          <Rect x={-hw} y={-hd} w={w} h={d * 0.25} fill={dark} k={k} r={6} />
          <Rect x={-hw} y={-hd} w={w * 0.08} h={d} fill={dark} k={k} r={4} />
          <Rect x={hw - w * 0.08} y={-hd} w={w * 0.08} h={d} fill={dark} k={k} r={4} />
          <line x1={-w / 6} y1={-hd + d * 0.25} x2={-w / 6} y2={hd} stroke={dark} strokeWidth={1 * k} />
          <line x1={w / 6} y1={-hd + d * 0.25} x2={w / 6} y2={hd} stroke={dark} strokeWidth={1 * k} />
        </g>
      );
    case 'coffee-table':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} r={4} />
          <Rect x={-hw + 6} y={-hd + 6} w={w - 12} h={d - 12} fill={light} k={k} r={3} sw={0.6} />
        </g>
      );
    case 'dining':
      return (
        <g>
          {[-w / 4, w / 4].flatMap((cx) => [
            <Rect key={`t${cx}`} x={cx - 17} y={-hd} w={34} h={26} fill={dark} k={k} r={4} sw={0.8} />,
            <Rect key={`b${cx}`} x={cx - 17} y={hd - 26} w={34} h={26} fill={dark} k={k} r={4} sw={0.8} />,
          ])}
          <Rect x={-hw + 10} y={-hd + 14} w={w - 20} h={d - 28} fill={color} k={k} r={4} />
        </g>
      );
    case 'wardrobe':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} />
          <line x1={0} y1={hd} x2={0} y2={hd - 6} stroke={STROKE} strokeWidth={1.2 * k} />
          <line x1={-hw} y1={hd - 6} x2={hw} y2={hd - 6} stroke={STROKE} strokeWidth={1 * k} />
          <Tag x={0} y={hd - 14} text={dir ?? ''} k={k * 0.8} />
        </g>
      );
    case 'desk':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} />
          <Rect x={hw - 40} y={-hd + 3} w={37} h={d - 6} fill={light} k={k} sw={0.7} />
          <Tag x={-10} y={hd - 8} text={dir ?? ''} k={k * 0.8} />
        </g>
      );
    case 'mirror-cabinet':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} />
          <line x1={-hw + 2} y1={hd - 2} x2={hw - 2} y2={hd - 2} stroke="#0284c7" strokeWidth={2 * k} />
        </g>
      );
    case 'bathtub':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill="#f8fafc" k={k} r={8} />
          <Rect x={-hw + 7} y={-hd + 7} w={w - 14} h={d - 14} fill="#bae6fd" k={k} r={20} sw={0.8} />
          <circle cx={-hw + 20} cy={0} r={3} fill="none" stroke={STROKE} strokeWidth={1 * k} />
        </g>
      );
    case 'shower':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill="#dbeafe" k={k} />
          <line x1={-hw} y1={-hd} x2={hw} y2={hd} stroke="#60a5fa" strokeWidth={1 * k} />
          <line x1={hw} y1={-hd} x2={-hw} y2={hd} stroke="#60a5fa" strokeWidth={1 * k} />
          <circle cx={0} cy={0} r={5} fill="#93c5fd" stroke={STROKE} strokeWidth={0.8 * k} />
          <line x1={-hw} y1={hd} x2={hw} y2={hd} stroke="#0284c7" strokeWidth={2.5 * k} />
        </g>
      );
    case 'kitchen-cabinet':
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} dash={item.variant === 'wall'} />
          <line x1={0} y1={hd} x2={0} y2={hd - 5} stroke={STROKE} strokeWidth={1.2 * k} />
          <line x1={-hw} y1={hd - 5} x2={hw} y2={hd - 5} stroke={STROKE} strokeWidth={0.8 * k} />
          <Tag x={0} y={0} text={item.variant === 'wall' ? '吊櫃' : '地櫃'} k={k} />
        </g>
      );
    case 'stove': {
      const four = item.variant === '4';
      const pos: [number, number][] = four
        ? [
            [-w / 4, -d / 4],
            [w / 4, -d / 4],
            [-w / 4, d / 4],
            [w / 4, d / 4],
          ]
        : [
            [-w / 4, 0],
            [w / 4, 0],
          ];
      const r = Math.min(w / 4, d / 4) * 0.7;
      return (
        <g>
          <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} r={2} />
          {pos.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#111827" stroke="#9ca3af" strokeWidth={1.2 * k} />
          ))}
        </g>
      );
    }
    case 'office-chair': {
      const r = Math.min(hw, hd);
      return (
        <g>
          <circle cx={0} cy={2} r={r * 0.82} fill={color} stroke={STROKE} strokeWidth={k} />
          <path
            d={`M ${-r * 0.8} ${-r * 0.55} Q 0 ${-r * 1.15} ${r * 0.8} ${-r * 0.55} L ${r * 0.7} ${-r * 0.3} Q 0 ${-r * 0.8} ${-r * 0.7} ${-r * 0.3} Z`}
            fill={dark}
            stroke={STROKE}
            strokeWidth={k}
          />
          <Tag x={0} y={r * 0.15} text={dir ?? ''} k={k * 0.8} />
        </g>
      );
    }
    case 'c-shelf': {
      const t = 12;
      const pts = [
        [-hw, -hd],
        [hw, -hd],
        [hw, hd],
        [hw - t, hd],
        [hw - t, -hd + t],
        [-hw + t, -hd + t],
        [-hw + t, hd],
        [-hw, hd],
      ]
        .map((p) => p.join(','))
        .join(' ');
      return (
        <g>
          <rect x={-hw + t} y={-hd + t} width={w - 2 * t} height={d - t} fill="none" stroke={dark} strokeWidth={1 * k} strokeDasharray={`${3 * k} ${3 * k}`} />
          <polygon points={pts} fill={color} stroke={STROKE} strokeWidth={k} />
          <Tag x={0} y={hd - 14} text={dir ?? ''} k={k * 0.8} />
        </g>
      );
    }
    default:
      return <Rect x={-hw} y={-hd} w={w} h={d} fill={color} k={k} />;
  }
}

/** 正面（+y）方向箭頭 */
export function FrontArrow({ item, k }: { item: Item; k: number }) {
  if (item.type === 'door' || item.type === 'window') return null;
  const hd = item.d / 2;
  const s = Math.min(10, Math.min(item.w, item.d) * 0.3);
  return (
    <polygon
      points={`${-s * 0.7},${hd + 2 * k} ${s * 0.7},${hd + 2 * k} 0,${hd + 2 * k + s}`}
      fill="#0ea5e9"
      stroke="#0369a1"
      strokeWidth={0.8 * k}
      style={{ pointerEvents: 'none' }}
    />
  );
}
