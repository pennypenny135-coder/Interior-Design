import { Copy, Link2Off, RotateCw, Scissors, Spline, Trash2, Unlink, DoorOpen, Square, Layers } from 'lucide-react';
import { useStore } from '../store';
import { CAT, ZONE_TYPE_LABEL } from '../lib/catalog';
import type { Doc, Item, RoomZone, Wall, ZoneType } from '../types';
import {
  computeIssues,
  m2ToSqft,
  normDeg,
  sharedGeom,
  wallLength,
  zoneAreaM2,
  isOpeningItem,
} from '../lib/geometry';
import {
  deleteZone,
  duplicateItem,
  removeShared,
  removeWallSegment,
  rotateZone90,
  setSharedOpening,
  splitWall,
  toggleCurve,
  reconcileShared,
} from '../lib/docOps';
import { Btn, NumField, Section, Seg } from './ui';

const fmtArea = (m2: number) => `${m2.toFixed(2)} m² / ${m2ToSqft(m2).toFixed(1)} 平方呎`;

export default function RightInspector() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);

  let body;
  if (!selection) body = <Stats doc={doc} />;
  else if (selection.kind === 'item') {
    const it = doc.items.find((i) => i.id === selection.id);
    body = it ? <ItemPanel item={it} doc={doc} /> : <Stats doc={doc} />;
  } else if (selection.kind === 'wall') {
    const w = doc.walls.find((x) => x.id === selection.id);
    body = w ? <WallPanel wall={w} doc={doc} /> : <Stats doc={doc} />;
  } else if (selection.kind === 'zone') {
    const z = doc.zones.find((x) => x.id === selection.id);
    body = z ? <ZonePanel zone={z} doc={doc} /> : <Stats doc={doc} />;
  } else {
    body = <SharedPanel id={selection.id} doc={doc} />;
  }

  return (
    <aside className="w-72 shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700">
        {!selection ? '房間 / 全屋統計' : '屬性面板'}
      </div>
      {body}
    </aside>
  );
}

// ---------- 統計 ----------
function Stats({ doc }: { doc: Doc }) {
  const select = useStore((s) => s.select);
  const total = doc.zones.reduce((s, z) => s + zoneAreaM2(doc, z), 0);
  const counts = new Map<string, number>();
  doc.items.forEach((i) => counts.set(i.name, (counts.get(i.name) ?? 0) + 1));
  const issues = computeIssues(doc);
  const nIssue = Object.keys(issues).length;
  return (
    <>
      <Section title="總面積">
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
          <div className="text-2xl font-bold text-blue-700 tabular-nums">
            {m2ToSqft(total).toFixed(1)} <span className="text-sm font-medium">平方呎</span>
          </div>
          <div className="text-sm text-blue-600 tabular-nums">{total.toFixed(2)} m²</div>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">以牆中心線輪廓計算（含曲線牆離散取樣）</div>
      </Section>
      <Section title={`分區（${doc.zones.length}）`}>
        {doc.zones.length === 0 && <div className="text-xs text-slate-400">尚未建立分區</div>}
        <div className="space-y-1">
          {doc.zones.map((z) => (
            <button
              key={z.id}
              onClick={() => select({ kind: 'zone', id: z.id })}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                {z.name}
              </span>
              <span className="text-slate-500 tabular-nums">{zoneAreaM2(doc, z).toFixed(1)} m²</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title={`已擺放傢俬（${doc.items.length}）`}>
        {doc.items.length === 0 && <div className="text-xs text-slate-400">尚無傢俬</div>}
        <ul className="space-y-0.5">
          {[...counts.entries()].map(([name, n]) => (
            <li key={name} className="flex justify-between text-xs text-slate-600">
              <span>{name}</span>
              <span className="tabular-nums text-slate-400">× {n}</span>
            </li>
          ))}
        </ul>
        {nIssue > 0 && <div className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">⚠ {nIssue} 件傢俬重疊或超出牆壁邊界</div>}
      </Section>
      <Section title="共用牆">
        <div className="text-xs text-slate-600">
          {doc.shared.length === 0 ? '尚無。拖曳兩個分區靠近（≤ 20cm）即自動合併。' : `共 ${doc.shared.length} 處（橘色牆段，點擊可編輯）`}
        </div>
      </Section>
    </>
  );
}

// ---------- 傢俬 ----------
function ItemPanel({ item, doc }: { item: Item; doc: Doc }) {
  const act = useStore((s) => s.act);
  const select = useStore((s) => s.select);
  const issue = computeIssues(doc)[item.id];
  const upd = (patch: Partial<Item>, field: string) =>
    act((d) => {
      const it = d.items.find((i) => i.id === item.id);
      if (it) Object.assign(it, patch);
    }, `item:${item.id}:${field}`);
  const opening = isOpeningItem(item);

  return (
    <>
      <Section title={CAT[item.type]?.name ?? '物件'}>
        {issue && (
          <div className="mb-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">
            ⚠ {issue === 'collision' ? '與其他傢俬重疊' : '超出牆壁邊界'}
          </div>
        )}
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
          名稱
          <input
            value={item.name}
            onChange={(e) => upd({ name: e.target.value }, 'name')}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          顏色
          <input type="color" value={item.color} onChange={(e) => upd({ color: e.target.value }, 'color')} className="h-7 w-10 cursor-pointer rounded border border-slate-300" />
          <span className="font-mono text-slate-400">{item.color}</span>
        </label>

        {item.type === 'door' && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              開向
              <Seg value={item.swing ?? 'in'} onChange={(v) => upd({ swing: v }, 'swing')} options={[{ value: 'in', label: '向內' }, { value: 'out', label: '向外' }]} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              門軸
              <Seg value={item.hinge ?? 'left'} onChange={(v) => upd({ hinge: v }, 'hinge')} options={[{ value: 'left', label: '左' }, { value: 'right', label: '右' }]} />
            </div>
            <Btn className="w-full" onClick={() => upd({ rotation: normDeg(item.rotation + 180) }, 'flip')}>
              翻轉門朝向（180°）
            </Btn>
          </div>
        )}
        {item.type === 'stove' && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            爐頭型號
            <Seg
              value={item.variant ?? '2'}
              onChange={(v) => upd(v === '2' ? { variant: v, w: 60, d: 50 } : { variant: v, w: 80, d: 50 }, 'variant')}
              options={[{ value: '2', label: '2 爐' }, { value: '4', label: '4 爐' }]}
            />
          </div>
        )}
        {item.type === 'kitchen-cabinet' && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            櫃體層級
            <Seg
              value={item.variant ?? 'base'}
              onChange={(v) => upd(v === 'base' ? { variant: v, d: 60, h: 85, elevation: 0, name: '廚櫃' } : { variant: v, d: 35, h: 70, elevation: 140, name: '吊櫃' }, 'variant')}
              options={[{ value: 'base', label: '地櫃' }, { value: 'wall', label: '吊櫃' }]}
            />
          </div>
        )}
      </Section>

      <Section title="尺寸（cm）">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="寬度 W" value={item.w} min={5} onChange={(v) => upd({ w: v }, 'w')} />
          <NumField label="深度 D" value={item.d} min={2} onChange={(v) => upd({ d: v }, 'd')} />
          <NumField label="高度 H" value={item.h} min={2} onChange={(v) => upd({ h: v }, 'h')} />
        </div>
        <div className="mt-2 grid grid-cols-1">
          <NumField
            label={item.type === 'mirror-cabinet' ? '離地懸空高度（cm）' : '離地高度（cm）'}
            value={item.elevation}
            min={0}
            onChange={(v) => upd({ elevation: v }, 'elevation')}
          />
        </div>
      </Section>

      <Section title="位置與旋轉">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="X 座標" value={item.x} onChange={(v) => upd({ x: v }, 'x')} />
          <NumField label="Y 座標" value={item.y} onChange={(v) => upd({ y: v }, 'y')} />
          <NumField label="旋轉角度 (°)" value={item.rotation} onChange={(v) => upd({ rotation: normDeg(v) }, 'rot')} />
        </div>
      </Section>

      <Section title="操作">
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => upd({ rotation: normDeg(item.rotation + 90) }, 'rot90')}>
            <RotateCw size={13} /> 順時針轉 90°
          </Btn>
          <Btn
            onClick={() => {
              let nid: string | null = null;
              act((d) => {
                nid = duplicateItem(d, item.id);
              });
              if (nid) select({ kind: 'item', id: nid });
            }}
          >
            <Copy size={13} /> 複製物件
          </Btn>
          <Btn
            variant="danger"
            className="col-span-2"
            onClick={() => {
              act((d) => {
                d.items = d.items.filter((i) => i.id !== item.id);
              });
              select(null);
            }}
          >
            <Trash2 size={13} /> 刪除物件
          </Btn>
        </div>
        {opening && <div className="mt-2 text-[11px] text-slate-400">門窗拖曳時會吸附最近牆段並自動對齊牆厚。</div>}
      </Section>
    </>
  );
}

// ---------- 牆 ----------
function WallPanel({ wall, doc }: { wall: Wall; doc: Doc }) {
  const act = useStore((s) => s.act);
  const select = useStore((s) => s.select);
  const zone = doc.zones.find((z) => z.id === wall.zoneId);
  const sh = doc.shared.find((s) => s.wallA === wall.id || s.wallB === wall.id);
  const n = zone?.nodeIds.length ?? 0;
  const edit = (fn: (w: Wall, d: Doc) => void) =>
    act((d) => {
      const w = d.walls.find((x) => x.id === wall.id);
      if (w) fn(w, d);
    });
  return (
    <>
      <Section title={`牆段 · ${zone?.name ?? ''}`}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-slate-500">實際長度{wall.curve ? '（弧長）' : ''}</span>
          <span className="text-lg font-bold text-slate-800 tabular-nums">{Math.round(wallLength(doc, wall))} cm</span>
        </div>
        <NumField
          label="牆厚（cm）"
          value={wall.thickness}
          min={5}
          max={60}
          onChange={(v) =>
            act((d) => {
              const w = d.walls.find((x) => x.id === wall.id);
              if (w) w.thickness = v;
            }, `wall:${wall.id}:t`)
          }
        />
        {wall.open && <div className="mt-2 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">此牆段已拆除（開口），2D 以虛線表示、3D 不生成牆體。</div>}
      </Section>
      <Section title="牆段操作">
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant={wall.open ? 'primary' : 'default'}
            onClick={() =>
              edit((w, d) => {
                w.open = !w.open;
                reconcileShared(d);
              })
            }
          >
            <Unlink size={13} /> {wall.open ? '還原牆壁' : '拆牆（設為開口）'}
          </Btn>
          <Btn onClick={() => act((d) => splitWall(d, wall.id))}>
            <Scissors size={13} /> 分割牆壁
          </Btn>
          <Btn variant={wall.curve ? 'warn' : 'default'} onClick={() => act((d) => toggleCurve(d, wall.id))}>
            <Spline size={13} /> {wall.curve ? '拉直牆壁' : '設為曲線牆'}
          </Btn>
          <Btn
            variant="danger"
            disabled={n <= 3}
            title={n <= 3 ? '至少需要 3 面牆' : '刪除牆段並合併相鄰牆'}
            onClick={() => {
              act((d) => removeWallSegment(d, wall.id));
              select(null);
            }}
          >
            <Trash2 size={13} /> 刪除牆段
          </Btn>
        </div>
        {wall.curve && <div className="mt-2 text-[11px] text-orange-600">拖曳橘色圓點調整曲率；選取牆後拖曳牆身可平移（垂直牆向）。</div>}
        {!wall.curve && <div className="mt-2 text-[11px] text-slate-400">拖曳藍色角點調整尺寸；已選取的牆可沿法線方向拖曳。</div>}
      </Section>
      {sh && (
        <Section title="共用牆">
          <div className="text-xs text-slate-600 mb-2">此牆段與另一分區合併為共用牆。</div>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => select({ kind: 'shared', id: sh.id })}>
              <Layers size={13} /> 編輯連接位
            </Btn>
            <Btn variant="warn" onClick={() => act((d) => removeShared(d, sh.id))}>
              <Link2Off size={13} /> 移除共用牆
            </Btn>
          </div>
        </Section>
      )}
    </>
  );
}

// ---------- 分區 ----------
function ZonePanel({ zone, doc }: { zone: RoomZone; doc: Doc }) {
  const act = useStore((s) => s.act);
  const select = useStore((s) => s.select);
  const saveDraft = useStore((s) => s.saveDraft);
  const upd = (patch: Partial<RoomZone>, f: string) =>
    act((d) => {
      const z = d.zones.find((x) => x.id === zone.id);
      if (z) Object.assign(z, patch);
    }, `zone:${zone.id}:${f}`);
  const m2 = zoneAreaM2(doc, zone);
  const items = doc.items.filter((i) => i.zoneId === zone.id);
  const shared = doc.shared.filter((s) => s.zoneA === zone.id || s.zoneB === zone.id);
  return (
    <>
      <Section title="分區">
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-500">
          名稱
          <input value={zone.name} onChange={(e) => upd({ name: e.target.value }, 'name')} className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800" />
        </label>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          類型
          <select
            value={zone.type}
            onChange={(e) => upd({ type: e.target.value as ZoneType }, 'type')}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
          >
            {Object.entries(ZONE_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          地面顏色
          <input type="color" value={zone.color} onChange={(e) => upd({ color: e.target.value }, 'color')} className="h-7 w-10 cursor-pointer rounded border border-slate-300" />
        </label>
        <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          面積：<b className="text-slate-800">{fmtArea(m2)}</b>
          <div className="text-[11px] text-slate-400">
            牆段 {zone.nodeIds.length} 面 · 傢俬 {items.length} 件 · 共用牆 {shared.length} 處
          </div>
        </div>
      </Section>
      <Section title="操作">
        <div className="grid grid-cols-2 gap-2">
          <Btn onClick={() => act((d) => rotateZone90(d, zone.id))}>
            <RotateCw size={13} /> 轉 90°
          </Btn>
          <Btn onClick={() => saveDraft(`${zone.name} 範本`, 'zone', zone.id)}>暫存為範本</Btn>
          {shared.map((s, i) => (
            <Btn key={s.id} variant="warn" onClick={() => select({ kind: 'shared', id: s.id })}>
              <DoorOpen size={13} /> 連接位 {i + 1}
            </Btn>
          ))}
          <Btn
            variant="danger"
            className="col-span-2"
            onClick={() => {
              if (!confirm(`刪除分區「${zone.name}」及其所有傢俬？`)) return;
              act((d) => deleteZone(d, zone.id));
              select(null);
            }}
          >
            <Trash2 size={13} /> 刪除分區
          </Btn>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">拖曳地面可移動分區；靠近另一分區 ≤ 20cm 並放開，即自動拼合為共用牆。</div>
      </Section>
    </>
  );
}

// ---------- 共用牆 ----------
function SharedPanel({ id, doc }: { id: string; doc: Doc }) {
  const act = useStore((s) => s.act);
  const select = useStore((s) => s.select);
  const sh = doc.shared.find((s) => s.id === id);
  if (!sh) return <Stats doc={doc} />;
  const g = sharedGeom(doc, sh);
  const za = doc.zones.find((z) => z.id === sh.zoneA);
  const zb = doc.zones.find((z) => z.id === sh.zoneB);
  const op = sh.opening;
  const updOp = (patch: Partial<NonNullable<typeof op>>, f: string) =>
    act((d) => {
      const s = d.shared.find((x) => x.id === id);
      if (s?.opening) Object.assign(s.opening, patch);
    }, `shared:${id}:${f}`);
  return (
    <>
      <Section title="共用牆（合併牆段）">
        <div className="space-y-1 text-xs text-slate-600">
          <div>
            來源分區：<b>{za?.name ?? '?'}</b> ⇄ <b>{zb?.name ?? '?'}</b>
          </div>
          <div>
            共用長度：<b className="tabular-nums">{g ? Math.round(g.len) : 0} cm</b>
          </div>
          <div className="text-[11px] text-slate-400">
            原始牆段：
            {sh.original.map((o, i) => (
              <div key={i} className="tabular-nums">
                {doc.zones.find((z) => z.id === o.zoneId)?.name ?? '?'}：({Math.round(o.a.x)},{Math.round(o.a.y)}) → ({Math.round(o.b.x)},{Math.round(o.b.y)}) · 厚 {o.thickness}
              </div>
            ))}
          </div>
        </div>
        <Btn
          variant="warn"
          className="mt-3 w-full"
          onClick={() => {
            act((d) => removeShared(d, id));
            select(null);
          }}
        >
          <Link2Off size={13} /> 移除共用牆（還原獨立牆壁）
        </Btn>
      </Section>
      <Section title="連接位開口">
        <div className="grid grid-cols-3 gap-1.5">
          <Btn variant={op?.kind === 'door' ? 'primary' : 'default'} onClick={() => act((d) => setSharedOpening(d, id, 'door'))}>
            <DoorOpen size={13} /> 房門
          </Btn>
          <Btn variant={op?.kind === 'open' ? 'primary' : 'default'} onClick={() => act((d) => setSharedOpening(d, id, 'open'))}>
            <Square size={13} /> 開放式
          </Btn>
          <Btn variant={op?.kind === 'bar' ? 'primary' : 'default'} onClick={() => act((d) => setSharedOpening(d, id, 'bar'))}>
            吧檯口
          </Btn>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">開放式 = 無門門洞；吧檯口 = 半腰開口（開放式廚房）。</div>
        {op && g && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <NumField label="開口寬度（cm）" value={op.width} min={30} max={Math.max(30, g.len)} onChange={(v) => updOp({ width: v }, 'w')} />
              <NumField label="位置（距起點 cm）" value={op.center} min={0} max={g.len} onChange={(v) => updOp({ center: v }, 'c')} />
            </div>
            <input
              type="range"
              min={op.width / 2}
              max={Math.max(op.width / 2, g.len - op.width / 2)}
              value={op.center}
              onChange={(e) => updOp({ center: +e.target.value }, 'c')}
              className="w-full"
            />
            {op.kind === 'door' && (
              <>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  開向
                  <Seg value={op.swing} onChange={(v) => updOp({ swing: v }, 'swing')} options={[{ value: 'in', label: '朝 A→' }, { value: 'out', label: '朝 ←B' }]} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  門軸
                  <Seg value={op.hinge} onChange={(v) => updOp({ hinge: v }, 'hinge')} options={[{ value: 'left', label: '左' }, { value: 'right', label: '右' }]} />
                </div>
              </>
            )}
            <Btn variant="danger" className="w-full" onClick={() => act((d) => setSharedOpening(d, id, null))}>
              <Trash2 size={13} /> 移除連接開口
            </Btn>
          </div>
        )}
      </Section>
    </>
  );
}
