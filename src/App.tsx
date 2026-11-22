import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './store';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import RightInspector from './components/RightInspector';
import Canvas2D from './components/Canvas2D';
import { normDeg } from './lib/geometry';

const View3D = lazy(() => import('./components/View3D'));

export default function App() {
  const viewMode = useStore((s) => s.viewMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection?.kind === 'item') {
        const id = st.selection.id;
        st.act((d) => {
          d.items = d.items.filter((i) => i.id !== id);
        });
        st.select(null);
      } else if (e.key.toLowerCase() === 'r' && !mod && st.selection?.kind === 'item') {
        const id = st.selection.id;
        st.act((d) => {
          const it = d.items.find((i) => i.id === id);
          if (it) it.rotation = normDeg(it.rotation + 90);
        });
      } else if (e.key === 'Escape') {
        st.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const show2d = viewMode !== '3d';
  const show3d = viewMode !== '2d';

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100 text-slate-800">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <main className="flex min-w-0 flex-1">
          {show2d && (
            <div className={`relative min-w-0 ${show3d ? 'w-1/2 border-r border-slate-300' : 'w-full'}`}>
              <Canvas2D />
              <span className="absolute right-3 top-3 rounded bg-slate-800/70 px-2 py-0.5 text-[11px] text-white pointer-events-none">2D 平面</span>
            </div>
          )}
          {show3d && (
            <div className={`relative min-w-0 ${show2d ? 'w-1/2' : 'w-full'}`}>
              <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">載入 3D 場景…</div>}>
                <View3D />
              </Suspense>
            </div>
          )}
        </main>
        <RightInspector />
      </div>
    </div>
  );
}
