import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Box,
  ChevronDown,
  Columns2,
  Download,
  FolderOpen,
  Grid3x3,
  Home,
  Map as MapIcon,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useStore } from '../store';
import { ZONE_PRESETS } from '../lib/catalog';
import { normalizeDoc } from '../lib/docOps';
import type { ViewMode } from '../types';

function Pop({ open, onClose, children, width = 'w-72' }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute left-0 top-full mt-1 z-40 ${width} rounded-lg border border-slate-200 bg-white shadow-xl p-2`}>{children}</div>
    </>
  );
}

const tbtn =
  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';

export default function TopBar() {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const snap = useStore((s) => s.snap);
  const setSnap = useStore((s) => s.setSnap);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const addZone = useStore((s) => s.addZone);
  const clearAll = useStore((s) => s.clearAll);
  const drafts = useStore((s) => s.drafts);
  const saveDraft = useStore((s) => s.saveDraft);
  const loadDraft = useStore((s) => s.loadDraft);
  const deleteDraft = useStore((s) => s.deleteDraft);
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);

  const [zoneOpen, setZoneOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [cw, setCw] = useState(400);
  const [cd, setCd] = useState(300);
  const [cname, setCname] = useState('自訂房間');
  const [dname, setDname] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selZoneId =
    selection?.kind === 'zone'
      ? selection.id
      : selection?.kind === 'item'
        ? doc.items.find((i) => i.id === selection.id)?.zoneId
        : selection?.kind === 'wall'
          ? doc.walls.find((w) => w.id === selection.id)?.zoneId
          : undefined;
  const selZone = doc.zones.find((z) => z.id === selZoneId);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'interior-planner', version: 1, doc }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `floorplan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      const d = normalizeDoc(JSON.parse(await f.text()));
      if (!d) throw new Error('bad');
      useStore.getState().replaceDoc(d);
    } catch {
      alert('匯入失敗：不是有效的戶型 .json 檔案');
    }
  };

  const modes: { v: ViewMode; label: string; icon: ReactNode }[] = [
    { v: '2d', label: '2D 平面', icon: <MapIcon size={14} /> },
    { v: '3d', label: '3D 預覽', icon: <Box size={14} /> },
    { v: 'split', label: '雙視窗', icon: <Columns2 size={14} /> },
  ];

  return (
    <header className="relative z-20 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 mr-2">
        <div className="rounded-lg bg-blue-600 p-1.5 text-white">
          <Home size={16} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-800">全屋戶型擺位工具</div>
          <div className="text-[10px] text-slate-400">2D 規劃 · 3D 即時預覽</div>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.v}
            onClick={() => setViewMode(m.v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${viewMode === m.v ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* 新增分區 */}
      <div className="relative">
        <button className={tbtn} onClick={() => setZoneOpen((o) => !o)}>
          <Plus size={14} /> 新增分區 <ChevronDown size={12} />
        </button>
        <Pop open={zoneOpen} onClose={() => setZoneOpen(false)}>
          <div className="text-[11px] text-slate-400 px-1 pb-1">預設房間（自動錯開位置）</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ZONE_PRESETS.map((p) => (
              <button
                key={p.key}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-left text-xs hover:border-blue-400 hover:bg-blue-50"
                onClick={() => {
                  addZone(p);
                  setZoneOpen(false);
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: p.color }} />
                {p.name}
                <div className="text-[10px] text-slate-400">
                  {p.w}×{p.d} cm
                </div>
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="text-[11px] text-slate-400 px-1 pb-1">自訂矩形（cm）</div>
            <div className="flex items-center gap-1.5">
              <input value={cname} onChange={(e) => setCname(e.target.value)} className="w-20 rounded border border-slate-300 px-1.5 py-1 text-xs" />
              <input type="number" value={cw} onChange={(e) => setCw(+e.target.value)} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-xs" title="長 W" />
              <span className="text-xs text-slate-400">×</span>
              <input type="number" value={cd} onChange={(e) => setCd(+e.target.value)} className="w-16 rounded border border-slate-300 px-1.5 py-1 text-xs" title="深 D" />
            </div>
            <button
              className="mt-1.5 w-full rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              onClick={() => {
                addZone({ name: cname || '自訂房間', type: 'custom', w: Math.max(60, cw), d: Math.max(60, cd), color: '#e2e8f0' });
                setZoneOpen(false);
              }}
            >
              建立自訂分區
            </button>
          </div>
        </Pop>
      </div>

      {/* Temp Save */}
      <div className="relative">
        <button className={tbtn} onClick={() => setDraftOpen((o) => !o)}>
          <FolderOpen size={14} /> Temp Save <span className="text-slate-400">({drafts.length})</span>
        </button>
        <Pop open={draftOpen} onClose={() => setDraftOpen(false)} width="w-80">
          <div className="flex items-center gap-1.5">
            <input
              value={dname}
              onChange={(e) => setDname(e.target.value)}
              placeholder="草稿名稱（可留空）"
              className="flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs"
            />
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              className="rounded-md bg-blue-600 py-1.5 text-xs text-white hover:bg-blue-700"
              onClick={() => {
                saveDraft(dname || `全屋 ${new Date().toLocaleTimeString()}`, 'full');
                setDname('');
              }}
            >
              暫存目前設計
            </button>
            <button
              disabled={!selZone}
              className="rounded-md border border-blue-300 py-1.5 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-40"
              onClick={() => {
                saveDraft(dname || `${selZone?.name} 範本`, 'zone', selZone?.id);
                setDname('');
              }}
            >
              暫存選中分區
            </button>
          </div>
          <div className="mt-2 max-h-60 overflow-y-auto divide-y divide-slate-100">
            {drafts.length === 0 && <div className="py-4 text-center text-xs text-slate-400">尚無草稿</div>}
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2 py-1.5 px-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-700">{d.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {d.kind === 'full' ? '全屋' : '分區範本'} · {new Date(d.savedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] hover:bg-slate-50"
                  onClick={() => {
                    if (d.kind === 'full' && !confirm('載入全屋草稿會取代目前畫布（可復原），確定？')) return;
                    loadDraft(d.id);
                    setDraftOpen(false);
                  }}
                >
                  載入
                </button>
                <button className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => deleteDraft(d.id)} title="刪除">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Pop>
      </div>

      <div className="mx-1 h-6 w-px bg-slate-200" />

      <button className={tbtn} onClick={undo} disabled={!canUndo} title="復原 (Ctrl+Z)">
        <Undo2 size={14} /> 復原
      </button>
      <button className={tbtn} onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z / Ctrl+Y)">
        <Redo2 size={14} /> 重做
      </button>
      <button
        className={`${tbtn} ${snap ? '!bg-emerald-50 !border-emerald-400 !text-emerald-700' : ''}`}
        onClick={() => setSnap(!snap)}
        title="網格吸附 10 cm"
      >
        <Grid3x3 size={14} /> 吸附 10cm：{snap ? '開' : '關'}
      </button>
      <button
        className={`${tbtn} !text-red-600 !border-red-200`}
        onClick={() => confirm('確定清空整個畫布？（可用復原找回）') && clearAll()}
      >
        <Trash2 size={14} /> 清空
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <button className={tbtn} onClick={exportJson}>
          <Download size={14} /> 匯出 .json
        </button>
        <button className={tbtn} onClick={() => fileRef.current?.click()}>
          <Upload size={14} /> 匯入 .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
            e.target.value = '';
          }}
        />
        <span className="hidden xl:inline-flex items-center gap-1 text-[10px] text-slate-400">
          <Save size={11} /> 自動暫存
        </span>
      </div>
    </header>
  );
}
