import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type UiLanguage = "en" | "zh-TW";

export const UI_LANGUAGE_STORAGE_KEY = "todo-thought-universe:ui-language";

type TranslationValues = Record<string, number | string>;

const languageOptions: Array<{ value: UiLanguage; label: string; shortLabel: string }> = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "zh-TW", label: "Traditional Chinese", shortLabel: "繁中" }
];

const zhTW: Record<string, string> = {
  "AcceptanceTestPlan": "AcceptanceTestPlan",
  "Active": "Active",
  "Active model": "使用中模型",
  "AI": "AI",
  "AI chat dock": "AI 協作側欄",
  "AI chat draft input": "AI 協作草稿輸入",
  "AI drafts": "AI 草稿",
  "AI insights": "AI insights",
  "AI limitations": "AI 限制",
  "AI output and response": "AI 輸出與回覆",
  "AI Planning Panel": "AI 規劃面板",
  "AI review summary": "AI review 摘要",
  "AI session conversation": "AI session 對話",
  "AI setup error: {error}": "API 設定錯誤：{error}",
  "AI test error: {error}": "API 測試錯誤：{error}",
  "AI Workspace": "AI 工作區",
  "A model request is already in flight.": "模型請求正在執行中。",
  "All statuses": "所有狀態",
  "All types": "所有類型",
  "All universes": "所有宇宙",
  "API base URL": "API base URL",
  "API base URL is required before sending to the model.": "送出模型請求前必須填寫 API base URL。",
  "API error: {message}": "API 錯誤：{message}",
  "API key": "API key",
  "API key cleared from UI state and sessionStorage.": "API key 已從 UI state 與 sessionStorage 清除。",
  "API key is required before sending to the model.": "送出模型請求前必須填寫 API key。",
  "API key status": "API key 狀態",
  "API request failed; prompt preserved.": "API 請求失敗；prompt 已保留。",
  "API setup is incomplete; model test was not sent.": "API 設定尚未完成；未送出模型測試。",
  "API setup is incomplete; prompt preserved.": "API 設定尚未完成；prompt 已保留。",
  "Accepted": "Accepted",
  "Affected entities": "受影響 entities",
  "Apply": "套用",
  "Apply imported commands through executeDomainCommand?": "要透過 executeDomainCommand 套用匯入 commands 嗎？",
  "Applied {count} imported command(s).": "已套用 {count} 個匯入 command。",
  "App Info": "App 資訊",
  "App name": "App 名稱",
  "Add context...": "補充脈絡...",
  "App State imported successfully. Decision, readiness, and next action data were normalized.": "App State 匯入成功。Decision、readiness 與 next action 資料已正規化。",
  "App State imported with {count} invariant warning(s). Review the warning details before leaving transfer.": "App State 已匯入，含 {count} 個 invariant warning。離開 transfer 前請檢查 warning 詳細資料。",
  "App State Transfer": "App State 轉移",
  "App State Transfer description": "匯出或匯入完整 local-first app state，包含 universes、thoughts、projects、relationships、aiInsights、Decision Center、Review Queue、Engineering Readiness 與 Next Action state。",
  "All attachments cleared from UI memory.": "所有附件已從 UI memory 清除。",
  "Ask for a Codex prompt, paste a report, or discuss an architecture decision.": "請求 Codex prompt、貼上報告，或討論架構決策。",
  "Archive Project": "封存專案",
  "Archive Thought": "封存想法",
  "Archived Items": "封存項目",
  "Assistant": "助理",
  "Assistant error": "助理錯誤",
  "Assistant response received.": "已收到助理回覆。",
  "Attachment removed from UI memory.": "附件已從 UI memory 移除。",
  "Attachment upload": "附件上傳",
  "Attachments": "附件",
  "Blockers": "阻塞問題",
  "Blockers / Warnings": "阻塞問題 / 警告",
  "Blockers / warnings: {count}": "阻塞問題 / 警告：{count}",
  "Blocking Questions": "阻塞問題",
  "Build timestamp": "Build 時間",
  "Build, persistence, import/export, and workflow centers are checked from normalized AppState.": "Build、persistence、import/export 與 workflow centers 會從 normalized AppState 檢查。",
  "Cancel request": "取消請求",
  "canGenerateEngineeringDraft": "canGenerateEngineeringDraft",
  "canMarkHandoffReady": "canMarkHandoffReady",
  "Clear API key": "清除 API key",
  "Clear attachments": "清除附件",
  "Clear conversation": "清除對話",
  "Clear conversation cancelled.": "已取消清除對話。",
  "Clear the local AI conversation history? This removes UI-only chat history from localStorage. API key and current attachments stay in this tab's UI state.": "要清除本機 AI 對話紀錄嗎？這只會移除 localStorage 裡的 UI-only chat history；API key 與目前附件仍保留在此分頁的 UI state。",
  "Clipboard copy failed.": "剪貼簿複製失敗。",
  "Clipboard fallback used.": "已使用剪貼簿 fallback。",
  "Clipboard is unavailable in this browser context.": "此瀏覽器情境無法使用剪貼簿。",
  "Code block copied ({count} characters).": "Code block 已複製（{count} 字元）。",
  "Collapse": "收合",
  "Collapse AI workspace": "收合 AI 工作區",
  "Command JSON": "Command JSON",
  "Commands": "Commands",
  "Commands are drafts until validated, dry-run, and confirmed. Dry Run does not mutate AppState.": "Commands 在 validate、dry-run 並確認前都只是草稿。Dry Run 不會修改 AppState。",
  "Composed prompt preview copied ({count} characters{note}).": "組合後 prompt 預覽已複製（{count} 字元{note}）。",
  "Computed readiness": "計算 readiness",
  "Confirm": "確認",
  "Confirmed Command Import": "Confirmed Command Import",
  "Context counts": "Context 數量",
  "Conversation cleared locally and removed from localStorage.": "對話已在本機清除，並已從 localStorage 移除。",
  "Copy code": "複製 code",
  "Copy composed prompt preview": "複製組合後的 prompt 預覽",
  "Copy JSON": "複製 JSON",
  "Copy latest response": "複製最新回覆",
  "Copy Markdown": "複製 Markdown",
  "Copy prompt preview omitted attachment contents": "；預覽已省略原始附件內容",
  "Copy App State": "複製 App State",
  "Copied full App State JSON.": "已複製完整 App State JSON。",
  "Content": "內容",
  "Create Relationship": "建立關係",
  "Current App State JSON": "目前 App State JSON",
  "Current screen": "目前畫面",
  "Current version": "目前版本",
  "Current next steps": "目前下一步",
  "Custom": "自訂",
  "Custom model": "自訂模型",
  "Custom model ID": "自訂 model ID",
  "Dashboard": "儀表板",
  "Decision Center": "決策中心",
  "Decision Records": "決策紀錄",
  "Decision Records Center": "決策紀錄中心",
  "Decisions": "決策",
  "Delete Project": "刪除專案",
  "Delete this project?": "要刪除這個專案嗎？",
  "Delete this thought?": "要刪除這個想法嗎？",
  "Delete this universe?": "要刪除這個宇宙嗎？",
  "Deployment Status": "部署狀態",
  "Detach linked items and delete this universe?": "要解除已連結項目並刪除這個宇宙嗎？",
  "Draft package may be incomplete. This project is not handoff_ready. Resolve blockers and confirm handoff readiness before formal engineering handoff.": "草稿 package 可能不完整。此專案尚未 handoff_ready。正式工程交接前，請先解決 blockers 並確認 handoff readiness。",
  "Draft-only context surface. Actions stay in the existing review screens.": "僅產生草稿的 context surface。動作仍留在既有 review 畫面。",
  "Dry Run": "Dry Run",
  "Downloaded full App State JSON.": "已下載完整 App State JSON。",
  "Download JSON": "下載 JSON",
  "Download Markdown": "下載 Markdown",
  "English": "英文",
  "Engineering draft export does not mark the project as handoff_ready. handoff_ready requires explicit confirmed command flow.": "工程草稿匯出不會把專案標成 handoff_ready。handoff_ready 必須透過明確確認的 command flow。",
  "Engineering Export": "工程匯出",
  "Engineering FlowInput": "EngineeringFlowInput",
  "Engineering Handoff": "工程交接",
  "Engineering Handoff Center": "工程交接中心",
  "Engineering Handoff Export": "工程交接匯出",
  "Engineering Readiness": "工程準備度",
  "Engineering Readiness Center": "工程準備度中心",
  "EngineeringHandoffPackage Export": "EngineeringHandoffPackage 匯出",
  "EngineeringHandoffPackage JSON copied.": "EngineeringHandoffPackage JSON 已複製。",
  "EngineeringHandoffPackage Markdown copied.": "EngineeringHandoffPackage Markdown 已複製。",
  "Error": "錯誤",
  "Errors": "錯誤",
  "Executable": "可執行",
  "Exported at: {value}": "匯出時間：{value}",
  "Export App State": "匯出 App State",
  "Failed": "失敗",
  "Forbidden actions": "禁止動作",
  "Expected changes": "預期變更",
  "Freeform": "自由對話",
  "Global Search": "全域搜尋",
  "Global Search Center": "全域搜尋中心",
  "Goal": "目標",
  "Handoff limitations": "交接限制",
  "Handoff readiness summary": "交接 readiness 摘要",
  "Hard constraints": "硬性限制",
  "Idea Inbox": "想法收件匣",
  "Import and overwrite current data": "匯入並覆蓋目前資料",
  "Import App State JSON": "匯入 App State JSON",
  "Import failed: {error}": "匯入失敗：{error}",
  "Import warning details": "匯入 warning 詳細資料",
  "Import completed with {count} invariant warning(s).": "匯入完成，發現 {count} 個 invariant warning。",
  "Import completed with no invariant warnings.": "匯入完成，未發現 invariant warning。",
  "Import/export support": "匯入 / 匯出支援",
  "Imported commands are not trusted. Validate and Dry Run are read-only. Apply requires confirmation and uses the domain command layer. Failed batches are atomic and will not partially apply.": "匯入的 commands 不是可信輸入。Validate 與 Dry Run 都是唯讀。Apply 需要確認，並會透過 domain command layer。失敗批次是 atomic，不會部分套用。",
  "Inbox": "Inbox",
  "Initial state": "初始狀態",
  "Keep API key for this tab session": "在此分頁 session 記住 API key",
  "Language": "語言",
  "Latest assistant response copied ({count} characters).": "最新助理回覆已複製（{count} 字元）。",
  "Lifecycle status: {value}": "Lifecycle status：{value}",
  "Loaded in UI state": "已載入 UI state",
  "Local AI workspace ready. Messages stay in this UI-only session.": "本機 AI workspace 已就緒。訊息只保存在這個 UI-only session。",
  "Local-first assumption": "Local-first 假設",
  "Memory-only by default": "預設只存在 memory",
  "Model": "模型",
  "Model ID is required before sending to the model.": "送出模型請求前必須填寫 Model ID。",
  "Model selector": "模型選擇器",
  "Model settings": "模型設定",
  "Model test cancelled.": "模型測試已取消。",
  "Model test failed.": "模型測試失敗。",
  "Model test succeeded.": "模型測試成功。",
  "Model test succeeded for {model}.": "{model} 模型測試成功。",
  "Mode": "模式",
  "Mutation failed.": "Mutation 失敗。",
  "Next action": "下一步",
  "Next Actions": "下一步行動",
  "Next Action Center": "下一步行動中心",
  "Next milestones": "下一個里程碑",
  "No assistant response to copy yet.": "還沒有可複製的助理回覆。",
  "No blockers or warnings reported.": "沒有 blockers 或 warnings。",
  "No backend endpoint candidates.": "尚無 backend endpoint candidates。",
  "No Codex tasks listed.": "尚無 Codex tasks。",
  "No hard constraints listed.": "尚無 hard constraints。",
  "No handoff limitations listed.": "尚無 handoff limitations。",
  "No milestones listed.": "尚無 milestones。",
  "No projects are available for EngineeringHandoffPackage export.": "目前沒有可匯出的 EngineeringHandoffPackage 專案。",
  "No target entity declared.": "未宣告 target entity。",
  "No tests listed.": "尚無 tests。",
  "No implementation sequence listed.": "尚無 implementation sequence。",
  "No required software modules.": "尚無 required software modules。",
  "No available next action.": "沒有可用的下一步。",
  "No next action set yet.": "尚未設定下一步。",
  "No pending review items.": "沒有待 review 項目。",
  "No thoughts.": "沒有想法。",
  "None": "無",
  "No forbidden actions listed.": "尚無 forbidden actions。",
  "No AI limitations listed.": "尚無 AI limitations。",
  "Not set": "未設定",
  "Nothing to copy.": "沒有可複製的內容。",
  "Open AI Panel": "開啟 AI 面板",
  "Open AI workspace": "開啟 AI 工作區",
  "Open Global Search": "開啟全域搜尋",
  "Open Next Action Center": "開啟下一步行動中心",
  "Open any thought, project, universe, decision, blocker, relationship, action, or command.": "開啟任何想法、專案、宇宙、決策、阻塞問題、關係、行動或 command。",
  "Open Review Queue": "開啟 Review Queue",
  "Output": "輸出",
  "Package builder error: {error}": "Package builder 錯誤：{error}",
  "Paste todo-thought-universe app state JSON here. Required collections are validated and migrations/defaults are applied before import.": "貼上 todo-thought-universe app state JSON。匯入前會驗證必要 collections 並套用 migration/defaults。",
  "Preflight passed: {value}": "Preflight passed：{value}",
  "Preview and export a read-only engineering draft package.": "預覽並匯出唯讀工程草稿 package。",
  "Preview and export the selected project as a read-only engineering draft.": "將選取專案預覽並匯出為唯讀工程草稿。",
  "Project identity": "專案識別",
  "Project Detail": "專案詳情",
  "Project: {name} ({id})": "專案：{name}（{id}）",
  "Project selector": "專案選擇器",
  "Projects": "專案",
  "Production Readiness Summary": "Production Readiness 摘要",
  "Prompt input": "Prompt 輸入",
  "Prompt is empty.": "Prompt 是空的。",
  "Prompt mode": "Prompt 模式",
  "Prompt settings": "Prompt 設定",
  "Prompt Settings": "Prompt 設定",
  "Quick Capture": "快速捕捉",
  "Readiness": "Readiness",
  "Ready checks": "Ready checks",
  "Relationship Explorer": "關係探索器",
  "Relationship Map": "關係圖",
  "Relationships": "關係",
  "Remove {name}": "移除 {name}",
  "Request cancelled before completion.": "請求在完成前已取消。",
  "Request cancelled; prompt preserved.": "請求已取消；prompt 已保留。",
  "Reset demo": "重置 Demo",
  "Reset Demo": "重置 Demo",
  "Retained Production Data": "保留的 Production Data",
  "Review items": "Review 項目",
  "Review Queue": "Review Queue",
  "Review Queue Center": "Review Queue 中心",
  "Search": "搜尋",
  "Search thoughts": "搜尋想法",
  "Save to Inbox": "儲存到 Inbox",
  "Selected project": "選取專案",
  "Selected thought": "選取想法",
  "Send": "送出",
  "Sending": "送出中",
  "Sending to {model}...": "正在送到 {model}...",
  "Session start": "Session 開始",
  "Storage": "儲存",
  "Storage mode": "儲存模式",
  "Sort": "排序",
  "Status": "狀態",
  "Stored readiness": "已儲存 readiness",
  "Suggested implementation sequence": "建議實作順序",
  "Supported": "支援格式",
  "Test model": "測試模型",
  "Testing model": "測試中",
  "Testing {model}...": "正在測試 {model}...",
  "This handoff package is a read-only engineering draft export. Generating or exporting it does not mutate AppState. It does not mark the project as handoff_ready. handoff_ready requires explicit user confirmation through the command layer.": "這個 handoff package 是唯讀工程草稿匯出。產生或匯出它不會修改 AppState，也不會把專案標成 handoff_ready。handoff_ready 必須透過 command layer 明確由使用者確認。",
  "This project is already marked handoff_ready, but current draft signals may need review before reuse.": "此專案已標成 handoff_ready，但目前草稿訊號在重用前仍可能需要 review。",
  "Thought Detail": "想法詳情",
  "Thought management system": "思想管理系統",
  "Thought Triage": "想法分流",
  "Thought Triage Center": "想法分流中心",
  "Thought Universe": "思想宇宙",
  "Thought Universe dashboard": "思想宇宙儀表板",
  "Thoughts → universes → tasks/projects → next actions → engineering handoff": "想法 → 宇宙 → 任務/專案 → 下一步 → 工程交接",
  "Todo Thought Universe is configured as a local-first production Vite app.": "Todo Thought Universe 已設定為 local-first production Vite app。",
  "Traditional Chinese": "繁體中文",
  "Transfer": "轉移",
  "Title": "標題",
  "Title A-Z": "標題 A-Z",
  "Title Z-A": "標題 Z-A",
  "Type": "類型",
  "UI language": "UI 語言",
  "Unable to build EngineeringHandoffPackage export.": "無法建立 EngineeringHandoffPackage 匯出。",
  "Universes": "宇宙",
  "Universe": "宇宙",
  "Universe action failed.": "Universe 操作失敗。",
  "Universe Dashboard": "宇宙儀表板",
  "Universe Detail Center": "宇宙詳情中心",
  "Universe Management": "宇宙管理",
  "Unknown API error.": "未知 API 錯誤。",
  "Upload file": "上傳檔案",
  "Updated newest": "最新更新",
  "Updated oldest": "最舊更新",
  "Validation / Dry Run / Apply for external command JSON.": "外部 command JSON 的 Validation / Dry Run / Apply。",
  "Validate": "驗證",
  "Validation": "驗證",
  "Version": "版本",
  "What do I want to do now?": "我現在想做什麼？",
  "What came to mind...": "我現在想到...",
  "Prioritize active thoughts, project readiness, and next actions.": "優先看 active thoughts、project readiness 與 next actions。",
  "You": "你",
  "(empty)": "（空白）",
  "all": "全部",
  "active": "進行中",
  "archived": "封存",
  "blocked": "blocked",
  "done": "完成",
  "draftable": "可產生工程草稿",
  "error": "錯誤",
  "goal": "目標",
  "inbox": "Inbox",
  "inspiration": "靈感",
  "local-first": "local-first",
  "needs_clarification": "需要釐清",
  "needs review": "需要 review",
  "not_ready": "尚未準備",
  "no": "否",
  "note": "筆記",
  "ok": "ok",
  "paused": "暫停",
  "production ready": "production ready",
  "project": "專案",
  "question": "問題",
  "ready_for_engineering": "可工程交接",
  "read-only": "唯讀",
  "ready": "ready",
  "remote": "remote",
  "review": "review",
  "task": "任務",
  "true": "true",
  "false": "false",
  "failed": "failed",
  "format": "format",
  "guarded apply": "guarded apply",
  "completed": "completed",
  "applied {count} commands": "已套用 {count} 個 commands",
  "unavailable": "unavailable",
  "Warnings": "警告",
  "would run": "would run",
  "yes": "是",
  "{count} available actions": "{count} 個可用行動",
  "{count} drafts, decisions, blockers, or handoffs need review": "{count} 個草稿、決策、阻塞問題或交接項目需要 review",
  "{count} thoughts": "{count} 個想法",
  "{count} file(s) in UI memory only": "{count} 個檔案只存在 UI memory",
  "{name} attached locally. {status}.": "{name} 已附加到本機。{status}。",
  "{name} could not be attached.": "{name} 無法附加。",
  "text extracted": "文字已擷取",
  "image attached for vision": "影像已附加供 vision 使用",
  "unsupported file type": "不支援的檔案類型",
  "PDF content not readable yet": "PDF 內容目前無法讀取",
  "extraction failed": "擷取失敗",
  "content truncated due to size limit": "內容因大小限制已截斷",
  "metadata only": "僅 metadata"
};

function isUiLanguage(value: string | null): value is UiLanguage {
  return value === "en" || value === "zh-TW";
}

function readStoredLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";

  try {
    const value = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    return isUiLanguage(value) ? value : "en";
  } catch {
    return "en";
  }
}

function writeStoredLanguage(language: UiLanguage) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language preference is UI-only; the app remains usable if storage is blocked.
  }
}

export function translateText(language: UiLanguage, key: string, values: TranslationValues = {}) {
  const template = language === "zh-TW" ? zhTW[key] ?? key : key;

  return Object.entries(values).reduce(
    (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
    template
  );
}

export function missingRequiredUiTranslations(keys: readonly string[] = Object.keys(zhTW)) {
  return keys.filter((key) => !zhTW[key]?.trim());
}

interface I18nContextValue {
  language: UiLanguage;
  languageOptions: typeof languageOptions;
  setLanguage: (language: UiLanguage) => void;
  t: (key: string, values?: TranslationValues) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>(readStoredLanguage);

  useEffect(() => {
    writeStoredLanguage(language);

    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "zh-TW" ? "zh-Hant" : "en";
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      languageOptions,
      setLanguage,
      t: (key, values) => translateText(language, key, values)
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    return {
      language: "en" as const,
      languageOptions,
      setLanguage: () => undefined,
      t: (key: string, values?: TranslationValues) => translateText("en", key, values)
    };
  }

  return value;
}
