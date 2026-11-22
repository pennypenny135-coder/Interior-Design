# 全屋戶型擺位工具（2D 平面規劃 + 3D 即時預覽）

React 19 + TypeScript + Vite + Tailwind v4 + Zustand + three / @react-three/fiber / drei + lucide-react。
介面文字一律使用繁體中文；尺寸單位 `cm`，面積同時顯示 `平方呎` 與 `m²`。

## 常用指令
```bash
npm install
npm run dev        # 開發伺服器
npm run build      # vite build（單檔輸出 dist/index.html）
npx tsc --noEmit   # TypeScript 型別檢查（strict + noUnused*）
```

## 單位與座標規範（極重要）
- **內部單位一律 cm**：節點、牆厚、傢俬 x/y/w/d/h、離地高度 `elevation` 全部是 cm。
- **2D 畫布**：SVG，`PX_PER_CM = 1.5`（再乘 zoom）。世界座標 = cm；`<g transform="translate(pan) scale(1.5*zoom)">`。
  描邊 / 文字以 `k = 1/scale` 補償，保持固定像素大小。
- **3D 場景**：所有長度 `/ 100`（100 cm = 1 Three.js unit）。
- **平面對應**：2D `(x, y)` → 3D `(x/100, ·, y/100)`；3D 的 `y` 為高度（向上為正）。
- **旋轉**：`rotation` 以度數 0–360 儲存；2D（Y 向下）順時針為 `+θ`。
  3D（Y 向上、右手系）使用 `rotation.y = -θ·π/180`，因此 2D 順時針 = 3D 同方向旋轉。
- **傢俬局部座標**：`w` 沿局部 x，`d` 沿局部 y（正面朝 `+y`），2D 與 3D 的局部 `y` ↔ `z` 一致。
  床頭 = `-y`、梳化 / 椅背 = `-y`、C 形櫃開口 = `+y`、門的開向 `in` = `+y`。
- **網格吸附**：預設 10 cm（頂部開關）。旋轉手把 15° 吸附（Alt 取消）；曲線手把 5 cm。

## 資料結構（`src/types.ts`）
`Doc = { nodes, walls, zones, items, shared, blocked }`
- `RoomZone.nodeIds`：順時針節點迴圈；第 i 面牆 = `nodeIds[i] → nodeIds[i+1]`。
- `Wall`：`a/b` 節點、`thickness`(預設 15)、`curve`（二次貝茲控制點，絕對座標，null=直牆）、`open`（拆牆開口）。
- `Item`：含 `variant`（爐頭 2/4 爐、廚櫃地櫃/吊櫃）、`hinge/swing`（門）、`zoneId`。
- `SharedWall`：`wallA`（保留完整牆）、`wallB`（重疊段被略過）、`original`（合併時原始牆段快照）、`opening`（連接開口）。

## 共用牆合併 / 移除（`src/lib/docOps.ts → reconcileShared / removeShared`）
1. 拖曳分區**放開後**呼叫 `reconcileShared(doc, movedZoneId)`：
   - 先驗證既有共用牆（需平行、中心線距離 ≤ 1.5 cm、重疊 ≥ 20 cm，否則自動解除）。
   - 找出移動分區與其他分區之間「平行直牆、中心線距離 ≤ 20 cm、重疊 ≥ 30 cm」最佳的一對，
     將移動分區平移 `-d·n` 使中心線重合，再為所有重合的牆對建立 `SharedWall`。
   - 曲線牆 / 拆除的牆不參與合併。
2. 共用段幾何由 `sharedGeom()` 即時由兩面牆算出（不存死座標），故分區移動後會自動驗證。
3. 3D：`wallCuts()` 對 `wallB` 的重疊段加入「全高略過」，只生成 A 側牆體，避免 z-fighting；
   `opening` 在 A 側開洞（門 0–210、開放式 全高、吧檯口 100–260）。
4. **移除共用牆**（`removeShared`）：刪除記錄、把 B 分區朝自己內側推開一個牆厚（還原獨立牆壁），
   並把牆對 key 寫入 `blocked`，避免立即重新合併；距離 > 25 cm 後自動清除。
5. 連接位開口：`setSharedOpening(doc, id, 'door' | 'open' | 'bar' | null)`。

## 歷史紀錄（`src/store.ts`）
- `act(fn, key?)`：離散操作，推入 past；同一 `key` 在 800 ms 內連續呼叫合併為一筆（數字輸入）。
- 拖曳：`beginTx()` → 多次 `live(fn)`（不入歷史）→ `endTx()` 一次入歷史。
- 自動暫存：`doc` 變更後 300 ms 防抖寫入 `localStorage['interior-doc-v1']`；草稿在 `interior-drafts-v1`。

## 檔案架構
```
src/types.ts                 資料結構
src/store.ts                 Zustand（doc、歷史、視圖、草稿）
src/lib/geometry.ts          常數、向量、貝茲、面積、SAT 碰撞、吸附、共用牆幾何、牆開口
src/lib/docOps.ts            對 Doc 的純操作（建分區、拆/分割/曲線牆、共用牆、範本、匯入驗證）
src/lib/catalog.ts           元件庫與分區預設
src/lib/wallBoxes.ts         2D 牆 → 3D 牆體方塊（門窗洞、曲線離散、屋外法線）
src/components/Canvas2D.tsx  2D SVG 畫布（拖曳 / 旋轉 / 節點 / 曲線 / 共用牆 / 碰撞提示）
src/components/items2d.tsx   2D 傢俬符號（含方向標示、門弧）
src/components/View3D.tsx    3D 場景（地板貼圖、牆體動態隱藏、相機預設）
src/components/items3d.tsx   3D 傢俬 whitebox 組件
src/components/{TopBar,LeftSidebar,RightInspector,ui}.tsx
```

## 擴充提示
- 新增傢俬：在 `types.ts` 加 `ItemType` → `catalog.ts` 加規格 → `items2d.tsx` 與 `items3d.tsx` 各加一個 case。
- 碰撞：`computeIssues()`（OBB SAT + 垂直方向重疊判斷 + 牆內邊界容差 9 cm）。
- 3D 牆體動態隱藏：`WallMesh` 依相機是否位於牆的屋外側，壓低牆高（模式：自動 / 矮牆 / 全高）。
