import { create } from 'zustand';
import type { Doc, Draft, Selection, Vec2, ViewMode, WallMode } from './types';
import { clone, uid } from './lib/geometry';
import {
  addItem,
  createRectZone,
  defaultDoc,
  deleteZone,
  emptyDoc,
  extractZoneTemplate,
  insertTemplate,
  normalizeDoc,
} from './lib/docOps';
import type { ZonePreset } from './lib/catalog';
import type { ItemType } from './types';

const DOC_KEY = 'interior-doc-v1';
const DRAFT_KEY = 'interior-drafts-v1';
const MAX_HISTORY = 100;

function loadDoc(): Doc {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) {
      const d = normalizeDoc(JSON.parse(raw));
      if (d) return d;
    }
  } catch {
    /* ignore */
  }
  return defaultDoc();
}

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    /* ignore */
  }
  return [];
}

interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  selection: Selection;
  viewMode: ViewMode;
  snap: boolean;
  zoom: number;
  pan: Vec2;
  viewCenter: Vec2;
  wallMode: WallMode;
  camReq: { preset: 'iso' | 'top'; nonce: number };
  drafts: Draft[];

  act: (fn: (d: Doc) => void, key?: string) => void;
  live: (fn: (d: Doc) => void) => void;
  beginTx: () => void;
  endTx: () => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection) => void;
  setViewMode: (m: ViewMode) => void;
  setSnap: (b: boolean) => void;
  setView: (zoom: number, pan: Vec2) => void;
  setViewCenter: (c: Vec2) => void;
  setWallMode: (m: WallMode) => void;
  requestCamera: (preset: 'iso' | 'top') => void;

  addZone: (preset: Pick<ZonePreset, 'name' | 'type' | 'w' | 'd' | 'color'>) => void;
  addItemOfType: (type: ItemType) => void;
  clearAll: () => void;
  replaceDoc: (d: Doc) => void;

  saveDraft: (name: string, kind: 'full' | 'zone', zoneId?: string) => void;
  loadDraft: (id: string) => void;
  deleteDraft: (id: string) => void;
}

let tx: Doc | null = null;
let lastKey = '';
let lastTime = 0;

export const useStore = create<State>((set, get) => ({
  doc: loadDoc(),
  past: [],
  future: [],
  selection: null,
  viewMode: 'split',
  snap: true,
  zoom: 1,
  pan: { x: 60, y: 60 },
  viewCenter: { x: 300, y: 250 },
  wallMode: 'auto',
  camReq: { preset: 'iso', nonce: 0 },
  drafts: loadDrafts(),

  act: (fn, key) => {
    const { doc, past } = get();
    const next = clone(doc);
    fn(next);
    const now = Date.now();
    const coalesce = !!key && key === lastKey && now - lastTime < 800;
    lastKey = key ?? '';
    lastTime = now;
    set({ doc: next, past: coalesce ? past : [...past.slice(-(MAX_HISTORY - 1)), doc], future: [] });
  },
  live: (fn) => {
    const next = clone(get().doc);
    fn(next);
    set({ doc: next });
  },
  beginTx: () => {
    tx = get().doc;
    lastKey = '';
  },
  endTx: () => {
    if (tx && tx !== get().doc) {
      set({ past: [...get().past.slice(-(MAX_HISTORY - 1)), tx], future: [] });
    }
    tx = null;
  },
  undo: () => {
    const { past, future, doc, selection } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    lastKey = '';
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], selection: validSel(prev, selection) });
  },
  redo: () => {
    const { past, future, doc, selection } = get();
    if (!future.length) return;
    const [next, ...rest] = future;
    lastKey = '';
    set({ doc: next, past: [...past, doc], future: rest, selection: validSel(next, selection) });
  },
  select: (s) => set({ selection: s }),
  setViewMode: (m) => set({ viewMode: m }),
  setSnap: (b) => set({ snap: b }),
  setView: (zoom, pan) => set({ zoom, pan }),
  setViewCenter: (c) => set({ viewCenter: c }),
  setWallMode: (m) => set({ wallMode: m }),
  requestCamera: (preset) => set({ camReq: { preset, nonce: get().camReq.nonce + 1 } }),

  addZone: (preset) => {
    let id = '';
    get().act((d) => {
      id = createRectZone(d, preset);
    });
    set({ selection: { kind: 'zone', id } });
  },
  addItemOfType: (type) => {
    const { selection, viewCenter } = get();
    let id = '';
    get().act((d) => {
      id = addItem(d, type, selection, viewCenter);
    });
    set({ selection: { kind: 'item', id } });
  },
  clearAll: () => {
    get().act((d) => {
      Object.assign(d, emptyDoc());
    });
    set({ selection: null });
  },
  replaceDoc: (d) => {
    get().act((x) => {
      Object.assign(x, d);
    });
    set({ selection: null });
  },

  saveDraft: (name, kind, zoneId) => {
    const { doc, drafts } = get();
    const data = kind === 'zone' && zoneId ? extractZoneTemplate(doc, zoneId) : clone(doc);
    if (!data) return;
    const draft: Draft = { id: uid('draft'), name: name || (kind === 'zone' ? '分區範本' : '草稿'), savedAt: Date.now(), kind, doc: data };
    const next = [draft, ...drafts];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    set({ drafts: next });
  },
  loadDraft: (id) => {
    const draft = get().drafts.find((d) => d.id === id);
    if (!draft) return;
    if (draft.kind === 'full') {
      get().replaceDoc(clone(draft.doc));
    } else {
      let zid: string | null = null;
      get().act((d) => {
        zid = insertTemplate(d, clone(draft.doc));
      });
      if (zid) set({ selection: { kind: 'zone', id: zid } });
    }
  },
  deleteDraft: (id) => {
    const next = get().drafts.filter((d) => d.id !== id);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    set({ drafts: next });
  },
}));

function validSel(doc: Doc, sel: Selection): Selection {
  if (!sel) return null;
  const ok =
    (sel.kind === 'item' && doc.items.some((i) => i.id === sel.id)) ||
    (sel.kind === 'wall' && doc.walls.some((w) => w.id === sel.id)) ||
    (sel.kind === 'zone' && doc.zones.some((z) => z.id === sel.id)) ||
    (sel.kind === 'shared' && doc.shared.some((s) => s.id === sel.id));
  return ok ? sel : null;
}

// 自動暫存（防抖）
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((s, prev) => {
  if (s.doc === prev.doc) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DOC_KEY, JSON.stringify(s.doc));
    } catch {
      /* ignore quota */
    }
  }, 300);
});

export { deleteZone };
