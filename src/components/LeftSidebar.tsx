import { useStore } from '../store';
import { CATALOG, GROUP_LABEL } from '../lib/catalog';

const STRUCT = ['structure'];
const FURN = ['furniture', 'living', 'bathroom', 'kitchen'];

export default function LeftSidebar() {
  const add = useStore((s) => s.addItemOfType);
  const zones = useStore((s) => s.doc.zones.length);

  const renderGroup = (g: string) => (
    <div key={g} className="mb-3">
      <div className="text-[11px] text-slate-400 mb-1.5">{GROUP_LABEL[g]}</div>
      <div className="grid grid-cols-2 gap-1.5">
        {CATALOG.filter((c) => c.group === g).map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.type}
              onClick={() => add(c.type)}
              title={`${c.name} ${c.w}×${c.d}×${c.h} cm`}
              className="group flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-2 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
            >
              <span className="rounded-md p-1.5" style={{ background: c.color + '55' }}>
                <Icon size={18} />
              </span>
              <span className="text-[11px] leading-tight text-center">{c.name}</span>
              <span className="text-[9px] text-slate-400 group-hover:text-blue-400">
                {c.w}×{c.d}×{c.h}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-700">元件庫</div>
      <div className="p-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">建築結構</div>
        {STRUCT.map(renderGroup)}
        <div className="text-xs font-semibold text-slate-700 mb-2 mt-4">常用傢俬</div>
        {FURN.map(renderGroup)}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          點擊即在目前選中分區生成（未選取則於畫面中央）。門窗會自動貼附牆壁，拖曳時吸附最近牆段。
          {zones === 0 && <span className="block text-amber-600 mt-1">請先新增分區。</span>}
        </p>
      </div>
    </aside>
  );
}
