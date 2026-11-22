// 所有座標 / 尺寸單位皆為 cm；rotation 為度數（2D 順時針為正）

export interface Vec2 {
  x: number;
  y: number;
}

export type ZoneType = 'bedroom' | 'living' | 'bathroom' | 'kitchen' | 'custom';

export interface WallNode {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  zoneId: string;
  a: string; // 起點節點 id
  b: string; // 終點節點 id
  thickness: number;
  /** 二次貝茲控制點（絕對座標 cm）；null = 直牆 */
  curve: Vec2 | null;
  /** true = 拆牆（設為開口，不生成牆體） */
  open: boolean;
}

export interface RoomZone {
  id: string;
  name: string;
  type: ZoneType;
  color: string;
  /** 依序（順時針）的節點迴圈；第 i 面牆 = nodeIds[i] → nodeIds[i+1] */
  nodeIds: string[];
}

export type ItemType =
  | 'door'
  | 'window'
  | 'bed-single'
  | 'bed-double'
  | 'sofa'
  | 'coffee-table'
  | 'dining'
  | 'wardrobe'
  | 'desk'
  | 'mirror-cabinet'
  | 'bathtub'
  | 'shower'
  | 'kitchen-cabinet'
  | 'stove'
  | 'office-chair'
  | 'c-shelf';

export interface Item {
  id: string;
  type: ItemType;
  name: string;
  x: number; // 中心 x
  y: number; // 中心 y
  w: number; // 寬（局部 x）
  d: number; // 深（局部 y，正面朝 +y）
  h: number; // 高
  rotation: number;
  elevation: number; // 離地高度
  color: string;
  zoneId?: string;
  /** stove: '2' | '4'；kitchen-cabinet: 'base' | 'wall' */
  variant?: string;
  hinge?: 'left' | 'right';
  swing?: 'in' | 'out';
}

export type OpeningKind = 'door' | 'open' | 'bar';

export interface SharedOpening {
  kind: OpeningKind;
  /** 開口中心：距共用段起點 p 的 cm */
  center: number;
  width: number;
  hinge: 'left' | 'right';
  swing: 'in' | 'out';
}

export interface SharedOriginal {
  wallId: string;
  zoneId: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
}

export interface SharedWall {
  id: string;
  wallA: string; // 保留完整牆體的一側
  wallB: string; // 重疊段在 3D / 渲染中被略過的一側
  zoneA: string;
  zoneB: string;
  original: SharedOriginal[]; // 合併當下的原始牆段快照
  opening: SharedOpening | null;
}

export interface Doc {
  nodes: Record<string, WallNode>;
  walls: Wall[];
  zones: RoomZone[];
  items: Item[];
  shared: SharedWall[];
  /** 使用者已手動移除共用牆的牆對 key（wallA|wallB），避免立即重新合併 */
  blocked: string[];
}

export type Selection =
  | { kind: 'item' | 'wall' | 'zone' | 'shared'; id: string }
  | null;

export type ViewMode = '2d' | '3d' | 'split';
export type WallMode = 'auto' | 'full' | 'low';

export interface Draft {
  id: string;
  name: string;
  savedAt: number;
  kind: 'full' | 'zone';
  doc: Doc;
}
