import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import type { Doc, RoomZone, WallMode } from '../types';
import { buildWallBoxes } from '../lib/wallBoxes';
import type { WallBox } from '../lib/wallBoxes';
import { WALL_H, add, docBounds, mul, sharedGeom, toDeg, toRad, zonePolygon } from '../lib/geometry';
import { DoorModel, Item3D, B } from './items3d';
import { ArrowDownToLine, Box, Eye, ScanEye } from 'lucide-react';

// ---------- 程式化地板貼圖 ----------
function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const tones = ['#c9a06b', '#bf9460', '#d3ab76', '#b98b58'];
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i % tones.length];
    g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let k = 0; k < 6; k++) g.fillRect(((i * 53 + k * 41) % 256), i * 32 + 6 + ((k * 7) % 20), 40, 1);
    g.fillStyle = 'rgba(60,35,10,0.45)';
    g.fillRect(0, i * 32, 256, 1.5);
    g.fillRect((i % 2) * 128 + 64, i * 32, 1.5, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeTileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#e5e7eb' : '#f3f4f6';
      g.fillRect(i * 64, j * 64, 64, 64);
    }
  g.strokeStyle = '#9ca3af';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 64, 0);
    g.lineTo(i * 64, 256);
    g.moveTo(0, i * 64);
    g.lineTo(256, i * 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(2, 2);
  return t;
}

function Floor({ zone, doc, wood, tile, y }: { zone: RoomZone; doc: Doc; wood: THREE.Texture; tile: THREE.Texture; y: number }) {
  const geo = useMemo(() => {
    const pts = zonePolygon(doc, zone);
    if (pts.length < 3) return null;
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x / 100, p.y / 100)));
    return new THREE.ShapeGeometry(shape);
  }, [doc, zone]);
  if (!geo) return null;
  const wet = zone.type === 'bathroom' || zone.type === 'kitchen';
  // ShapeGeometry 位於 XY 平面；繞 X 軸 +90° 後 (x, y) → (x, 0, y)，對應 2D(x,y) → 3D(x,z)
  return (
    <mesh geometry={geo} rotation={[Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial map={wet ? tile : wood} side={THREE.DoubleSide} roughness={0.85} />
    </mesh>
  );
}

// ---------- 牆體（含動態隱藏） ----------
function WallMesh({ box, mode }: { box: WallBox; mode: WallMode }) {
  const g = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const LOW = 0.09;
  useFrame(() => {
    if (!g.current) return;
    let target = 1;
    if (mode === 'low') target = LOW;
    else if (mode === 'auto' && box.ext) {
      const dx = camera.position.x - box.cx / 100;
      const dz = camera.position.z - box.cz / 100;
      // 相機位於此牆外側 → 壓低，避免遮擋室內視線
      if (dx * box.ext.x + dz * box.ext.y > 0.3) target = LOW;
    }
    g.current.scale.y += (target - g.current.scale.y) * 0.18;
  });
  const h = box.y1 - box.y0;
  return (
    <group ref={g} position={[box.cx / 100, 0, box.cz / 100]} rotation={[0, -toRad(box.angle), 0]}>
      <mesh position={[0, (box.y0 + h / 2) / 100, 0]} castShadow receiveShadow>
        <boxGeometry args={[box.len / 100, h / 100, box.thick / 100]} />
        <meshStandardMaterial color="#f3f1ec" roughness={0.95} />
      </mesh>
    </group>
  );
}

function SharedOpenings({ doc }: { doc: Doc }) {
  return (
    <>
      {doc.shared.map((sh) => {
        const op = sh.opening;
        if (!op) return null;
        const g = sharedGeom(doc, sh);
        if (!g) return null;
        const c = add(g.p, mul(g.u, op.center));
        const ang = toDeg(Math.atan2(g.u.y, g.u.x));
        return (
          <group key={sh.id} position={[c.x / 100, 0, c.y / 100]} rotation={[0, -toRad(ang), 0]}>
            {op.kind === 'door' && <DoorModel w={op.width} d={g.thickness} h={210} color="#a16207" />}
            {op.kind === 'bar' && (
              <>
                <B y={98} w={op.width} d={g.thickness + 4} h={4} c="#78716c" />
              </>
            )}
            {op.kind === 'open' && (
              <>
                <B x={-op.width / 2 + 1.5} w={3} d={g.thickness + 1} h={WALL_H} c="#e7e5e4" />
                <B x={op.width / 2 - 1.5} w={3} d={g.thickness + 1} h={WALL_H} c="#e7e5e4" />
              </>
            )}
          </group>
        );
      })}
    </>
  );
}

function CameraRig({ cx, cz, size }: { cx: number; cz: number; size: number }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const req = useStore((s) => s.camReq);
  useEffect(() => {
    if (!controls) return;
    const dist = Math.max(size * 1.0, 6);
    if (req.preset === 'top') camera.position.set(cx, dist * 1.7, cz + 0.01);
    else camera.position.set(cx + dist * 0.75, dist * 0.95, cz + dist * 0.95);
    controls.target.set(cx, 0, cz);
    controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req.nonce, controls]);
  return null;
}

function Scene() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const wallMode = useStore((s) => s.wallMode);
  const select = useStore((s) => s.select);
  const boxes = useMemo(() => buildWallBoxes(doc), [doc]);
  const wood = useMemo(makeWoodTexture, []);
  const tile = useMemo(makeTileTexture, []);
  const b = docBounds(doc);
  const cx = b ? (b.minX + b.maxX) / 200 : 3;
  const cz = b ? (b.minY + b.maxY) / 200 : 3;
  const size = b ? Math.max(b.maxX - b.minX, b.maxY - b.minY) / 100 : 6;

  return (
    <>
      <color attach="background" args={['#e9eef4']} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#ffffff', '#b8b3a8', 0.5]} />
      <directionalLight
        position={[cx + 9, 16, cz + 7]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
      />
      <gridHelper args={[80, 80, '#c7d0db', '#dde3ea']} position={[0, -0.01, 0]} />
      {doc.zones.map((z, i) => (
        <Floor key={z.id} zone={z} doc={doc} wood={wood} tile={tile} y={0.002 * (i + 1)} />
      ))}
      {boxes.map((bx) => (
        <WallMesh key={bx.key} box={bx} mode={wallMode} />
      ))}
      <SharedOpenings doc={doc} />
      {doc.items.map((it) => (
        <Item3D key={it.id} item={it} selected={selection?.kind === 'item' && selection.id === it.id} onSelect={() => select({ kind: 'item', id: it.id })} />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={1.5} maxDistance={60} />
      <CameraRig cx={cx} cz={cz} size={size} />
    </>
  );
}

export default function View3D() {
  const select = useStore((s) => s.select);
  const wallMode = useStore((s) => s.wallMode);
  const setWallMode = useStore((s) => s.setWallMode);
  const requestCamera = useStore((s) => s.requestCamera);
  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${active ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`;
  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [10, 9, 10], fov: 45, near: 0.1, far: 300 }} dpr={[1, 2]} onPointerMissed={() => select(null)}>
        <Scene />
      </Canvas>
      <span className="absolute left-3 top-3 rounded bg-slate-800/70 px-2 py-0.5 text-[11px] text-white pointer-events-none">3D 預覽</span>
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow">
          <button className={btn(false)} onClick={() => requestCamera('top')}>
            <ArrowDownToLine size={12} /> 俯視圖
          </button>
          <button className={btn(false)} onClick={() => requestCamera('iso')}>
            <Box size={12} /> 等角透視
          </button>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow" title="牆體顯示">
          <button className={btn(wallMode === 'auto')} onClick={() => setWallMode('auto')}>
            <ScanEye size={12} /> 自動隱藏
          </button>
          <button className={btn(wallMode === 'low')} onClick={() => setWallMode('low')}>
            <Eye size={12} /> 矮牆
          </button>
          <button className={btn(wallMode === 'full')} onClick={() => setWallMode('full')}>
            全高
          </button>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 text-[11px] text-slate-500 pointer-events-none">
        左鍵旋轉 · 右鍵平移 · 滾輪縮放 · 點擊傢俬可選取
      </div>
    </div>
  );
}
