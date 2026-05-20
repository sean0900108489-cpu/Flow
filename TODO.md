# Next Engineering Steps

## P0

- [ ] 拆分 `src/main.tsx` 成 modules：
  - `types.ts`
  - `storage.ts`
  - `seed.ts`
  - `readiness.ts`
  - `exportEngineeringInput.ts`
  - `components/*`
- [ ] 補 `delete/archive` 操作
- [ ] 新增 Relationship 建立 UI
- [ ] 新增 Project list selector
- [ ] 新增 Universe detail page
- [ ] 新增 import/export full app state JSON

## P1

- [ ] 將 mock AI 層抽成 service
- [ ] 加入真正 AI provider adapter
- [ ] AI 建議產生 structured patch，而不是只有文字
- [ ] AIInsight accepted 後可套用 patch
- [ ] EngineeringFlowInput export 加入 relatedScreenIds / relatedDataObjectIds mapping

## P2

- [ ] Relationship Map 圖形化
- [ ] Multi-version planning
- [ ] IndexedDB / SQLite local-first persistence
- [ ] Optional login / sync
