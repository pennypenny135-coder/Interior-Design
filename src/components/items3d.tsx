import { Html } from '@react-three/drei';
import type { Item } from '../types';
import { shade, toRad } from '../lib/geometry';

interface BProps {
  x?: number;
  z?: number;
  y?: number; // 底部高度
  w: number;
  h: number;
  d: number;
  c: string;
  o?: number;
}

/** 方塊（局部座標 cm：x、z 為中心，y 為底部） */
export function B({ x = 0, z = 0, y = 0, w, h, d, c, o }: BProps) {
  return (
    <mesh position={[x / 100, (y + h / 2) / 100, z / 100]} castShadow={o === undefined} receiveShadow>
      <boxGeometry args={[w / 100, h / 100, d / 100]} />
      <meshStandardMaterial color={c} transparent={o !== undefined} opacity={o ?? 1} roughness={0.8} depthWrite={o === undefined} />
    </mesh>
  );
}

function Cy({ x = 0, z = 0, y = 0, r, h, c }: { x?: number; z?: number; y?: number; r: number; h: number; c: string }) {
  return (
    <mesh position={[x / 100, (y + h / 2) / 100, z / 100]} castShadow receiveShadow>
      <cylinderGeometry args={[r / 100, r / 100, h / 100, 20]} />
      <meshStandardMaterial color={c} roughness={0.6} />
    </mesh>
  );
}

export function DoorModel({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const fr = '#6b4423';
  return (
    <group>
      <B x={-w / 2 + 2} w={4} d={d + 2} h={h} c={fr} />
      <B x={w / 2 - 2} w={4} d={d + 2} h={h} c={fr} />
      <B y={h - 4} w={w} d={d + 2} h={4} c={fr} />
      <B y={0} w={w - 8} d={4} h={h - 4} c={color} />
      <B x={w / 2 - 14} y={100} z={4} w={10} d={3} h={2.5} c="#d1d5db" />
    </group>
  );
}

export function WindowModel({ w, d, h }: { w: number; d: number; h: number }) {
  const fr = '#f8fafc';
  return (
    <group>
      <B y={0} w={w} d={d + 2} h={4} c={fr} />
      <B y={h - 4} w={w} d={d + 2} h={4} c={fr} />
      <B x={-w / 2 + 2} w={4} d={d + 2} h={h} c={fr} />
      <B x={w / 2 - 2} w={4} d={d + 2} h={h} c={fr} />
      <B w={3} d={d} h={h - 8} y={4} c={fr} />
      <B y={4} w={w - 8} d={2} h={h - 8} c="#7dd3fc" o={0.3} />
    </group>
  );
}

function Parts({ item }: { item: Item }) {
  const { w: W, d: D, h: H, color } = item;
  const dark = shade(color, -0.3);
  const light = shade(color, 0.3);
  switch (item.type) {
    case 'door':
      return <DoorModel w={W} d={D} h={H} color={color} />;
    case 'window':
      return <WindowModel w={W} d={D} h={H} />;
    case 'bed-single':
    case 'bed-double': {
      const two = item.type === 'bed-double';
      return (
        <>
          <B w={W} d={D} h={H * 0.45} c="#8b5e3c" />
          <B z={4} y={H * 0.45} w={W - 6} d={D - 14} h={H * 0.55} c={color} />
          <B z={-D / 2 + 3} w={W} d={6} h={H + 40} c="#8b5e3c" />
          {two ? (
            <>
              <B x={-W * 0.25} z={-D / 2 + 28} y={H} w={W * 0.4} d={30} h={9} c="#ffffff" />
              <B x={W * 0.25} z={-D / 2 + 28} y={H} w={W * 0.4} d={30} h={9} c="#ffffff" />
            </>
          ) : (
            <B z={-D / 2 + 28} y={H} w={W * 0.6} d={30} h={9} c="#ffffff" />
          )}
          <B z={20} y={H} w={W - 8} d={D * 0.55} h={2} c={light} />
        </>
      );
    }
    case 'sofa':
      return (
        <>
          <B w={W} d={D} h={H * 0.45} c={dark} />
          <B z={-D / 2 + 10} y={H * 0.45} w={W} d={20} h={H * 0.55} c={color} />
          <B x={-W / 2 + 10} z={8} y={H * 0.45} w={20} d={D - 20} h={H * 0.22} c={color} />
          <B x={W / 2 - 10} z={8} y={H * 0.45} w={20} d={D - 20} h={H * 0.22} c={color} />
          <B z={10} y={H * 0.45} w={W - 40} d={D - 30} h={8} c={light} />
        </>
      );
    case 'coffee-table':
      return (
        <>
          <B y={H - 4} w={W} d={D} h={4} c={color} />
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} x={sx * (W / 2 - 5)} z={sz * (D / 2 - 5)} w={5} d={5} h={H - 4} c={dark} />))}
        </>
      );
    case 'dining':
      return (
        <>
          <B y={H - 4} w={W - 20} d={D - 30} h={4} c={color} />
          {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} x={sx * (W / 2 - 18)} z={sz * (D / 2 - 22)} w={5} d={5} h={H - 4} c={dark} />))}
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <group key={`c${sx}${sz}`}>
                <B x={sx * W * 0.25} z={sz * (D / 2 - 14)} y={42} w={34} d={30} h={4} c={light} />
                <B x={sx * W * 0.25} z={sz * (D / 2 - 2)} y={42} w={34} d={4} h={42} c={dark} />
                <B x={sx * W * 0.25} z={sz * (D / 2 - 14)} w={6} d={6} h={42} c={dark} />
              </group>
            )),
          )}
        </>
      );
    case 'wardrobe':
      return (
        <>
          <B w={W} d={D} h={H} c={color} />
          <B z={D / 2 + 0.3} y={5} w={0.8} d={0.6} h={H - 10} c={dark} />
          <B x={-W / 4} z={D / 2 + 0.3} y={5} w={0.8} d={0.6} h={H - 10} c={dark} />
          <B x={W / 4} z={D / 2 + 0.3} y={5} w={0.8} d={0.6} h={H - 10} c={dark} />
          <B x={-5} z={D / 2 + 1.5} y={H * 0.45} w={2} d={2} h={22} c="#555" />
          <B x={5} z={D / 2 + 1.5} y={H * 0.45} w={2} d={2} h={22} c="#555" />
        </>
      );
    case 'desk':
      return (
        <>
          <B y={H - 3} w={W} d={D} h={3} c={color} />
          <B x={-W / 2 + 2} y={0} w={4} d={D - 4} h={H - 3} c={dark} />
          <B x={W / 2 - 20} z={0} y={H - 3 - 50} w={36} d={D - 6} h={50} c={light} />
          <B z={-D / 2 + 2} y={H - 3 - 40} w={W - 8} d={2} h={40} c={dark} />
        </>
      );
    case 'mirror-cabinet':
      return (
        <>
          <B w={W} d={D} h={H} c="#e2e8f0" />
          <B z={D / 2 + 0.3} y={3} w={W - 6} d={0.6} h={H - 6} c="#bfe3f2" />
        </>
      );
    case 'bathtub': {
      const t = 8;
      return (
        <>
          <B w={W} d={D} h={H * 0.4} c="#f8fafc" />
          <B x={-W / 2 + t / 2} y={H * 0.4} w={t} d={D} h={H * 0.6} c="#f8fafc" />
          <B x={W / 2 - t / 2} y={H * 0.4} w={t} d={D} h={H * 0.6} c="#f8fafc" />
          <B z={-D / 2 + t / 2} y={H * 0.4} w={W - 2 * t} d={t} h={H * 0.6} c="#f8fafc" />
          <B z={D / 2 - t / 2} y={H * 0.4} w={W - 2 * t} d={t} h={H * 0.6} c="#f8fafc" />
          <B y={H * 0.4} w={W - 2 * t} d={D - 2 * t} h={H * 0.35} c="#bae6fd" o={0.8} />
          <Cy x={-W / 2 + 14} z={-D / 2 + 4} y={H} r={2.5} h={14} c="#9ca3af" />
        </>
      );
    }
    case 'shower':
      return (
        <>
          <B w={W} d={D} h={6} c="#e2e8f0" />
          <B z={D / 2 - 1} y={6} w={W} d={1.5} h={H - 6} c="#93c5fd" o={0.25} />
          <B x={W / 2 - 1} y={6} w={1.5} d={D} h={H - 6} c="#93c5fd" o={0.25} />
          <B x={-W / 2 + 1.5} z={D / 2 - 1.5} w={3} d={3} h={H} c="#94a3b8" />
          <B x={W / 2 - 1.5} z={D / 2 - 1.5} w={3} d={3} h={H} c="#94a3b8" />
          <B x={W / 2 - 1.5} z={-D / 2 + 1.5} w={3} d={3} h={H} c="#94a3b8" />
          <Cy x={-W / 2 + 12} z={-D / 2 + 12} y={H - 12} r={9} h={3} c="#cbd5e1" />
        </>
      );
    case 'kitchen-cabinet': {
      const wall = item.variant === 'wall';
      return (
        <>
          <B w={W} d={D} h={wall ? H : H - 3} c={color} />
          {!wall && <B z={1} y={H - 3} w={W + 1} d={D + 2} h={3} c="#78716c" />}
          <B z={D / 2 + 0.3} y={wall ? 4 : 8} w={0.8} d={0.6} h={(wall ? H : H - 3) - 12} c={dark} />
          <B x={-W / 4} z={D / 2 + 1.5} y={wall ? 6 : H - 20} w={2} d={2} h={10} c="#555" />
          <B x={W / 4} z={D / 2 + 1.5} y={wall ? 6 : H - 20} w={2} d={2} h={10} c="#555" />
        </>
      );
    }
    case 'stove': {
      const four = item.variant === '4';
      const pos: [number, number][] = four
        ? [
            [-W / 4, -D / 4],
            [W / 4, -D / 4],
            [-W / 4, D / 4],
            [W / 4, D / 4],
          ]
        : [
            [-W / 4, 0],
            [W / 4, 0],
          ];
      const r = Math.min(W / 4, D / 4) * 0.75;
      return (
        <>
          <B w={W} d={D} h={H} c="#1f2937" />
          {pos.map(([x, z], i) => (
            <group key={i}>
              <Cy x={x} z={z} y={H} r={r} h={1.2} c="#9ca3af" />
              <Cy x={x} z={z} y={H + 1.2} r={r * 0.5} h={1} c="#111827" />
            </group>
          ))}
        </>
      );
    }
    case 'office-chair':
      return (
        <>
          <B y={4} w={W * 0.8} d={5} h={3} c="#1f2937" />
          <B y={4} w={5} d={D * 0.8} h={3} c="#1f2937" />
          <Cy y={7} r={2.5} h={H * 0.3} c="#9ca3af" />
          <B y={H * 0.45} w={W * 0.85} d={D * 0.85} h={8} c={color} />
          <B z={-D * 0.4} y={H * 0.45 + 8} w={W * 0.8} d={6} h={H * 0.45} c={dark} />
        </>
      );
    case 'c-shelf': {
      const t = 12;
      return (
        <>
          <B z={-D / 2 + t / 2} w={W} d={t} h={H} c={color} />
          <B x={-W / 2 + t / 2} w={t} d={D} h={H} c={color} />
          <B x={W / 2 - t / 2} w={t} d={D} h={H} c={color} />
          {[1, 2, 3].map((i) => (
            <B key={i} z={t / 2} y={(H / 4) * i} w={W - 2 * t} d={D - t} h={2.5} c={light} />
          ))}
          <B y={H - 2.5} z={0} w={W} d={D} h={2.5} c={dark} o={0.55} />
        </>
      );
    }
    default:
      return <B w={W} d={D} h={H} c={color} />;
  }
}

export function Item3D({
  item,
  selected,
  onSelect,
  showLabel = true,
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
  showLabel?: boolean;
}) {
  const opening = item.type === 'door' || item.type === 'window';
  return (
    <group
      position={[item.x / 100, item.elevation / 100, item.y / 100]}
      // 2D 順時針 +θ → 3D 繞 Y 軸 -θ
      rotation={[0, -toRad(item.rotation), 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Parts item={item} />
      {selected && (
        <mesh position={[0, item.h / 200, 0]}>
          <boxGeometry args={[item.w / 100 + 0.04, item.h / 100 + 0.04, item.d / 100 + 0.04]} />
          <meshBasicMaterial color="#3b82f6" wireframe />
        </mesh>
      )}
      {!opening && (
        <>
          {/* 正面方向箭頭（+y → 3D +z） */}
          <mesh position={[0, item.h / 100 + 0.02, item.d / 200 - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.14, 12]} />
            <meshStandardMaterial color="#0ea5e9" />
          </mesh>
          {showLabel && (
            <Html position={[0, item.h / 100 + 0.22, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className="whitespace-nowrap rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white">
                {item.name}
                {item.elevation > 0 ? ` ↑${item.elevation}` : ''}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
