import {
  AppWindow,
  Armchair,
  Bath,
  Bed,
  BedDouble,
  Coffee,
  DoorOpen,
  Flame,
  Library,
  Monitor,
  Shirt,
  ShowerHead,
  Sofa,
  Square,
  Utensils,
  Archive,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { ItemType, ZoneType } from '../types';

export interface CatalogEntry {
  type: ItemType;
  name: string;
  group: 'structure' | 'furniture' | 'bathroom' | 'kitchen' | 'living';
  w: number;
  d: number;
  h: number;
  elevation: number;
  color: string;
  variant?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** 2D 方向文字 */
  dirLabel?: string;
}

export const CATALOG: CatalogEntry[] = [
  { type: 'door', name: '房門', group: 'structure', w: 90, d: 15, h: 210, elevation: 0, color: '#a16207', icon: DoorOpen },
  { type: 'window', name: '窗戶', group: 'structure', w: 150, d: 15, h: 120, elevation: 90, color: '#38bdf8', icon: AppWindow },
  { type: 'bed-single', name: '單人床', group: 'furniture', w: 100, d: 200, h: 50, elevation: 0, color: '#93c5fd', icon: Bed, dirLabel: '床頭' },
  { type: 'bed-double', name: '雙人床', group: 'furniture', w: 150, d: 200, h: 55, elevation: 0, color: '#f9a8d4', icon: BedDouble, dirLabel: '床頭' },
  { type: 'sofa', name: '三人梳化', group: 'furniture', w: 210, d: 90, h: 80, elevation: 0, color: '#a7b99a', icon: Sofa, dirLabel: '正面' },
  { type: 'coffee-table', name: '茶几', group: 'furniture', w: 110, d: 60, h: 45, elevation: 0, color: '#d6b48a', icon: Coffee },
  { type: 'dining', name: '餐檯連椅組', group: 'furniture', w: 140, d: 80, h: 75, elevation: 0, color: '#c9a27a', icon: Utensils },
  { type: 'wardrobe', name: '衣櫃', group: 'furniture', w: 120, d: 60, h: 210, elevation: 0, color: '#d4c4a8', icon: Shirt, dirLabel: '櫃門' },
  { type: 'desk', name: '書檯', group: 'furniture', w: 120, d: 60, h: 75, elevation: 0, color: '#e0c9a6', icon: Monitor, dirLabel: '座位' },
  { type: 'office-chair', name: '電腦椅', group: 'living', w: 55, d: 55, h: 90, elevation: 0, color: '#475569', icon: Armchair, dirLabel: '椅背' },
  { type: 'c-shelf', name: '貼牆C形櫃', group: 'living', w: 120, d: 40, h: 200, elevation: 0, color: '#d6c1a0', icon: Library, dirLabel: '開口' },
  { type: 'mirror-cabinet', name: '鏡櫃', group: 'bathroom', w: 60, d: 15, h: 70, elevation: 130, color: '#bae6fd', icon: Square, dirLabel: '鏡面' },
  { type: 'bathtub', name: '浴缸', group: 'bathroom', w: 170, d: 75, h: 55, elevation: 0, color: '#f1f5f9', icon: Bath },
  { type: 'shower', name: '企缸（淋浴間）', group: 'bathroom', w: 90, d: 90, h: 200, elevation: 0, color: '#bfdbfe', icon: ShowerHead },
  { type: 'kitchen-cabinet', name: '廚櫃', group: 'kitchen', w: 60, d: 60, h: 85, elevation: 0, color: '#e7e5e4', variant: 'base', icon: Archive, dirLabel: '櫃門' },
  { type: 'stove', name: '爐頭', group: 'kitchen', w: 60, d: 50, h: 8, elevation: 85, color: '#475569', variant: '2', icon: Flame },
];

export const CAT: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map((c) => [c.type, c]));

export const GROUP_LABEL: Record<string, string> = {
  structure: '建築結構（貼牆）',
  furniture: '基礎傢俬',
  living: '生活與貼牆傢俬',
  bathroom: '廁所元件',
  kitchen: '廚房元件',
};

export interface ZonePreset {
  key: string;
  name: string;
  type: ZoneType;
  w: number;
  d: number;
  color: string;
}

export const ZONE_PRESETS: ZonePreset[] = [
  { key: 'bedroom', name: '睡房', type: 'bedroom', w: 350, d: 300, color: '#fde68a' },
  { key: 'living', name: '客飯廳', type: 'living', w: 520, d: 400, color: '#bfdbfe' },
  { key: 'bathroom', name: '廁所', type: 'bathroom', w: 220, d: 240, color: '#a5f3fc' },
  { key: 'kitchen', name: '廚房', type: 'kitchen', w: 260, d: 300, color: '#fecaca' },
];

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  bedroom: '睡房',
  living: '客飯廳',
  bathroom: '廁所',
  kitchen: '廚房',
  custom: '自訂',
};
