# Todo Thought Universe / 待辦事項思想宇宙

一個 local-first 思想管理系統 MVP。

它不是普通 todo list，而是用來管理：

- 想法
- 靈感
- 任務
- 目標
- 專案
- 宇宙
- 想法關係
- AI 整理建議
- 工程交接輸出

## 核心流程

```text
Quick Capture
→ Idea Inbox
→ 分類成靈感 / 任務 / 專案 / 目標 / 問題
→ 放入 Universe
→ 補上 Why / Desired Outcome / Next Action
→ 升級為 Project
→ 判斷 Engineering Readiness
→ 匯出 EngineeringFlowInput
```

## 啟動

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

## 預覽 production build

```bash
npm run preview
```

## 本地資料

目前資料存在 browser `localStorage`：

```text
todo-thought-universe:v1
```

如需清除資料，可在 UI 按「重置 Demo」，或於 DevTools 清除 localStorage。

## MVP 功能

- Universe Dashboard
- Quick Capture
- Idea Inbox
- Thought Detail
- Project Detail
- Mock AI Planning Panel
- Relationship list
- Engineering Handoff Export
- Local-first localStorage persistence
