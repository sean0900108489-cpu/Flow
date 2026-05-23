import {
  ClipboardCheck,
  Copy,
  FlaskConical,
  KeyRound,
  MessageCircle,
  Paperclip,
  PanelRightClose,
  Send,
  Trash2,
  Wand2,
  XCircle
} from "lucide-react";
import { Fragment, type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  ATTACHMENT_ACCEPT,
  attachmentStatusLabel,
  buildAiRequestMessages,
  buildComposedPrompt as composeAiChatPrompt,
  buildComposedPromptPreview as composeAiChatPromptPreview,
  createAiChatAttachment,
  formatBytes,
  formatCount,
  postAiChatRequest,
  resolveAiProviderEndpoint,
  type AiChatAttachment,
  type AiChatRole,
  type AiProviderRequestConfig
} from "./aiChatDockRequest";
import { useI18n } from "../../i18n";

type AiChatMessageVariant = "default" | "error";

type AiPromptMode = "freeform" | "context-summary" | "engineering-handoff";

type AiModelOption = "gpt-5.5-2026-04-23" | "gpt-5.1" | "custom";

type ApiRequestMode = "send" | "test";

interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  variant?: AiChatMessageVariant;
}

type MarkdownLikeBlock =
  | { id: string; type: "paragraph"; lines: string[] }
  | { id: string; type: "list"; items: string[] }
  | { id: string; type: "code"; language: string; content: string };

const LOCAL_STORAGE_KEYS = {
  apiBaseUrl: "eflow.aiChat.apiBaseUrl",
  customModelId: "eflow.aiChat.customModelId",
  dockOpen: "eflow.ui.aiChatDockOpen",
  messages: "eflow.aiChat.messages",
  promptDraft: "eflow.aiChat.promptDraft",
  promptMode: "eflow.aiChat.promptMode",
  selectedModel: "eflow.aiChat.selectedModel"
} as const;

const SESSION_STORAGE_KEYS = {
  apiKey: "eflow.aiChat.apiKey",
  persistApiKey: "eflow.aiChat.persistApiKey"
} as const;

const MODEL_OPTIONS: Array<{ value: AiModelOption; label: string }> = [
  { value: "gpt-5.5-2026-04-23", label: "GPT-5.5" },
  { value: "gpt-5.1", label: "GPT-5.1" },
  { value: "custom", label: "Custom" }
];

const PROMPT_MODE_OPTIONS: Array<{ value: AiPromptMode; label: string }> = [
  { value: "freeform", label: "Freeform" },
  { value: "context-summary", label: "Context summary" },
  { value: "engineering-handoff", label: "Engineering handoff" }
];

const DEFAULT_MESSAGES: AiChatMessage[] = [
  {
    id: "ai-session-seed",
    role: "assistant",
    content: "Local AI workspace ready. Messages stay in this UI-only session.",
    createdAt: "Session start"
  }
];

function createMessage(role: AiChatRole, content: string, variant: AiChatMessageVariant = "default"): AiChatMessage {
  const fallbackId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const id =
    typeof window !== "undefined" && window.crypto && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : fallbackId;

  return {
    id,
    role,
    content,
    createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    variant
  };
}

function createAttachmentId() {
  return `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readLocalString(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;

  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalString(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function removeLocalValue(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Local persistence is optional and UI-only.
  }
}

function readLocalJson<T>(key: string, fallback: T): T {
  const raw = readLocalString(key);

  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown) {
  writeLocalString(key, JSON.stringify(value));
}

function readSessionString(key: string, fallback = "") {
  if (typeof window === "undefined") return fallback;

  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSessionString(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage is optional; the key stays memory-only if blocked.
  }
}

function removeSessionValue(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else to do when storage is blocked.
  }
}

function isAiModelOption(value: string): value is AiModelOption {
  return MODEL_OPTIONS.some((option) => option.value === value);
}

function isPromptMode(value: string): value is AiPromptMode {
  return PROMPT_MODE_OPTIONS.some((option) => option.value === value);
}

function readStoredMessages() {
  const messages = readLocalJson<AiChatMessage[]>(LOCAL_STORAGE_KEYS.messages, DEFAULT_MESSAGES);

  return Array.isArray(messages) ? messages : DEFAULT_MESSAGES;
}

function readStoredModelOption() {
  const value = readLocalString(LOCAL_STORAGE_KEYS.selectedModel, "gpt-5.5-2026-04-23");

  return isAiModelOption(value) ? value : "gpt-5.5-2026-04-23";
}

function readStoredPromptMode() {
  const value = readLocalString(LOCAL_STORAGE_KEYS.promptMode, "freeform");

  return isPromptMode(value) ? value : "freeform";
}

function copyTextWithHiddenTextarea(text: string) {
  if (typeof document === "undefined" || !document.body) return false;

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function parseMarkdownLike(content: string): MarkdownLikeBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownLikeBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let codeLanguage = "";
  let isInsideCodeBlock = false;

  const nextBlockId = (type: MarkdownLikeBlock["type"]) => `${type}-${blocks.length}`;
  const flushParagraph = () => {
    if (!paragraphLines.length) return;

    blocks.push({ id: nextBlockId("paragraph"), type: "paragraph", lines: paragraphLines });
    paragraphLines = [];
  };
  const flushList = () => {
    if (!listItems.length) return;

    blocks.push({ id: nextBlockId("list"), type: "list", items: listItems });
    listItems = [];
  };
  const flushCode = () => {
    blocks.push({
      id: nextBlockId("code"),
      type: "code",
      language: codeLanguage,
      content: codeLines.join("\n")
    });
    codeLines = [];
    codeLanguage = "";
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (isInsideCodeBlock) {
      if (trimmedLine.startsWith("```")) {
        flushCode();
        isInsideCodeBlock = false;
        return;
      }

      codeLines.push(line);
      return;
    }

    if (trimmedLine.startsWith("```")) {
      flushParagraph();
      flushList();
      codeLanguage = trimmedLine.slice(3).trim().split(/\s+/)[0] ?? "";
      isInsideCodeBlock = true;
      return;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const listMatch = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);

    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  if (isInsideCodeBlock) flushCode();
  flushParagraph();
  flushList();

  return blocks;
}

function renderInlineCode(text: string, keyPrefix: string): ReactNode[] {
  const segments: ReactNode[] = [];
  const inlineCodePattern = /`([^`\n]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentIndex = 0;

  while ((match = inlineCodePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }

    segments.push(
      <code key={`${keyPrefix}-code-${segmentIndex}`} className="ai-chat-dock__inline-code">
        {match[1]}
      </code>
    );
    segmentIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments.length ? segments : [text];
}

function MarkdownLikeMessage({
  content,
  copyButtonTabIndex,
  onCopyCode
}: {
  content: string;
  copyButtonTabIndex?: number;
  onCopyCode: (code: string) => void;
}) {
  const { t } = useI18n();
  const blocks = parseMarkdownLike(content);

  if (!blocks.length) {
    return <p className="ai-chat-dock__message-paragraph">{t("(empty)")}</p>;
  }

  return (
    <div className="ai-chat-dock__rendered-message">
      {blocks.map((block) => {
        if (block.type === "code") {
          return (
            <figure className="ai-chat-dock__code-block" key={block.id}>
              <figcaption className="ai-chat-dock__code-header">
                <span>{block.language || "text"}</span>
                <button
                  type="button"
                  className="ghost ai-chat-dock__code-copy"
                  tabIndex={copyButtonTabIndex}
                  onClick={() => onCopyCode(block.content)}
                >
                  <Copy size={14} />
                  {t("Copy code")}
                </button>
              </figcaption>
              <pre>
                <code>{block.content}</code>
              </pre>
            </figure>
          );
        }

        if (block.type === "list") {
          return (
            <ul className="ai-chat-dock__message-list" key={block.id}>
              {block.items.map((item, index) => (
                <li key={`${block.id}-${index}`}>{renderInlineCode(item, `${block.id}-${index}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p className="ai-chat-dock__message-paragraph" key={block.id}>
            {block.lines.map((line, index) => (
              <Fragment key={`${block.id}-${index}`}>
                {index > 0 && <br />}
                {renderInlineCode(line, `${block.id}-${index}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  return "Unknown API error.";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export interface AiChatDockProps {
  isOpen: boolean;
  currentScreenLabel: string;
  selectedProjectTitle?: string;
  selectedThoughtTitle?: string;
  aiDraftCount: number;
  reviewQueueCount: number;
  onOpenChange: (isOpen: boolean) => void;
  onOpenAiPanel: () => void;
  onOpenReviewQueue: () => void;
}

export function AiChatDock({
  isOpen,
  currentScreenLabel,
  selectedProjectTitle,
  selectedThoughtTitle,
  aiDraftCount,
  reviewQueueCount,
  onOpenChange,
  onOpenAiPanel,
  onOpenReviewQueue
}: AiChatDockProps) {
  const { t } = useI18n();
  const [hasLoadedDockPreference, setHasLoadedDockPreference] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>(readStoredMessages);
  const [promptDraft, setPromptDraft] = useState(() => readLocalString(LOCAL_STORAGE_KEYS.promptDraft));
  const [selectedModel, setSelectedModel] = useState<AiModelOption>(readStoredModelOption);
  const [customModelId, setCustomModelId] = useState(() => readLocalString(LOCAL_STORAGE_KEYS.customModelId));
  const [apiBaseUrl, setApiBaseUrl] = useState(() => readLocalString(LOCAL_STORAGE_KEYS.apiBaseUrl, "/api/ai-chat"));
  const [promptMode, setPromptMode] = useState<AiPromptMode>(readStoredPromptMode);
  const [attachments, setAttachments] = useState<AiChatAttachment[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [requestMode, setRequestMode] = useState<ApiRequestMode | null>(null);
  const [shouldPersistApiKeyInSession, setShouldPersistApiKeyInSession] = useState(
    () => readSessionString(SESSION_STORAGE_KEYS.persistApiKey) === "true"
  );
  const [apiKey, setApiKey] = useState(() =>
    readSessionString(SESSION_STORAGE_KEYS.persistApiKey) === "true"
      ? readSessionString(SESSION_STORAGE_KEYS.apiKey)
      : ""
  );
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  const skipNextMessagePersistenceRef = useRef(false);
  const requestIdRef = useRef(0);
  const isRequestInFlight = requestMode !== null;
  const statusClass = isOpen ? "ai-chat-dock--open" : "ai-chat-dock--collapsed";
  const launcherLabel = t("Open AI workspace");
  const hiddenPanelTabIndex = isOpen ? undefined : -1;
  const activeModelLabel = selectedModel === "custom" ? customModelId || t("Custom model") : selectedModel;

  useEffect(() => {
    const storedPreference = readLocalJson<boolean | null>(LOCAL_STORAGE_KEYS.dockOpen, null);

    if (typeof storedPreference === "boolean" && storedPreference !== isOpen) {
      onOpenChange(storedPreference);
    }

    setHasLoadedDockPreference(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedDockPreference) return;

    writeLocalJson(LOCAL_STORAGE_KEYS.dockOpen, isOpen);
  }, [hasLoadedDockPreference, isOpen]);

  useEffect(() => {
    if (skipNextMessagePersistenceRef.current) {
      skipNextMessagePersistenceRef.current = false;
      removeLocalValue(LOCAL_STORAGE_KEYS.messages);
      return;
    }

    writeLocalJson(LOCAL_STORAGE_KEYS.messages, messages);
  }, [messages]);

  useEffect(() => {
    writeLocalString(LOCAL_STORAGE_KEYS.promptDraft, promptDraft);
  }, [promptDraft]);

  useEffect(() => {
    writeLocalString(LOCAL_STORAGE_KEYS.selectedModel, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    writeLocalString(LOCAL_STORAGE_KEYS.customModelId, customModelId);
  }, [customModelId]);

  useEffect(() => {
    writeLocalString(LOCAL_STORAGE_KEYS.apiBaseUrl, apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    writeLocalString(LOCAL_STORAGE_KEYS.promptMode, promptMode);
  }, [promptMode]);

  useEffect(() => {
    if (!shouldPersistApiKeyInSession) {
      removeSessionValue(SESSION_STORAGE_KEYS.persistApiKey);
      removeSessionValue(SESSION_STORAGE_KEYS.apiKey);
      return;
    }

    writeSessionString(SESSION_STORAGE_KEYS.persistApiKey, "true");

    if (apiKey) {
      writeSessionString(SESSION_STORAGE_KEYS.apiKey, apiKey);
      return;
    }

    removeSessionValue(SESSION_STORAGE_KEYS.apiKey);
  }, [apiKey, shouldPersistApiKeyInSession]);

  useEffect(() => {
    return () => {
      activeRequestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const messagesPanel = messagesPanelRef.current;

    if (!messagesPanel) return;

    messagesPanel.scrollTo({
      top: messagesPanel.scrollHeight,
      behavior: "smooth"
    });
  }, [isOpen, messages]);

  const buildDisplayPrompt = (draft: string) =>
    composeAiChatPrompt({
      promptMode,
      promptDraft: draft,
      attachments,
      mode: "history"
    });

  const buildPreviewPrompt = () =>
    composeAiChatPromptPreview({
      promptMode,
      activeModelLabel,
      apiBaseUrl,
      promptDraft,
      attachments
    });

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text.trim()) {
      setStatusMessage(t("Nothing to copy."));
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatusMessage(successMessage);
        return;
      }

      if (copyTextWithHiddenTextarea(text)) {
        setStatusMessage(`${successMessage} ${t("Clipboard fallback used.")}`);
        return;
      }

      setStatusMessage(t("Clipboard is unavailable in this browser context."));
    } catch {
      if (copyTextWithHiddenTextarea(text)) {
        setStatusMessage(`${successMessage} ${t("Clipboard fallback used.")}`);
        return;
      }

      setStatusMessage(t("Clipboard copy failed."));
    }
  };

  const appendAssistantError = (message: string) => {
    setMessages((currentMessages) => [...currentMessages, createMessage("assistant", message, "error")]);
  };

  const resolveAiRequestConfig = (): { config: AiProviderRequestConfig } | { error: string } => {
    const trimmedApiKey = apiKey.trim();
    const trimmedBaseUrl = apiBaseUrl.trim();
    const resolvedModel = selectedModel === "custom" ? customModelId.trim() : selectedModel;

    if (!trimmedApiKey) return { error: t("API key is required before sending to the model.") };
    if (!trimmedBaseUrl) return { error: t("API base URL is required before sending to the model.") };
    if (!resolvedModel) return { error: t("Model ID is required before sending to the model.") };

    const endpoint = resolveAiProviderEndpoint(trimmedBaseUrl);

    return {
      config: {
        apiKey: trimmedApiKey,
        endpoint: endpoint.endpoint,
        model: resolvedModel,
        providerMode: endpoint.providerMode
      }
    };
  };

  const beginApiRequest = (mode: ApiRequestMode) => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    activeRequestControllerRef.current = controller;
    setRequestMode(mode);

    return { controller, requestId };
  };

  const finishApiRequest = (requestId: number) => {
    if (requestIdRef.current !== requestId) return;

    activeRequestControllerRef.current = null;
    setRequestMode(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isRequestInFlight) {
      setStatusMessage(t("A model request is already in flight."));
      return;
    }

    const submittedPromptDraft = promptDraft;
    const content = submittedPromptDraft.trim();

    if (!content) {
      setStatusMessage(t("Prompt is empty."));
      return;
    }

    const configResult = resolveAiRequestConfig();

    if ("error" in configResult) {
      appendAssistantError(t("API setup error: {error}", { error: configResult.error }));
      setStatusMessage(t("API setup is incomplete; prompt preserved."));
      return;
    }

    const displayUserMessage = createMessage("user", buildDisplayPrompt(submittedPromptDraft));
    const requestMessages = buildAiRequestMessages({
      historyMessages: messages,
      promptMode,
      promptDraft: submittedPromptDraft,
      attachments
    });
    const { controller, requestId } = beginApiRequest("send");

    setMessages((currentMessages) => [...currentMessages, displayUserMessage]);
    setStatusMessage(t("Sending to {model}...", { model: configResult.config.model }));

    try {
      const assistantContent = await postAiChatRequest(configResult.config, requestMessages, controller.signal);

      if (requestIdRef.current !== requestId) return;

      setMessages((currentMessages) => [...currentMessages, createMessage("assistant", assistantContent)]);
      setPromptDraft((currentDraft) => (currentDraft === submittedPromptDraft ? "" : currentDraft));
      setStatusMessage(t("Assistant response received."));
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      const message = isAbortError(error) ? t("Request cancelled before completion.") : errorMessageFromUnknown(error);

      appendAssistantError(t("API error: {message}", { message }));
      setStatusMessage(isAbortError(error) ? t("Request cancelled; prompt preserved.") : t("API request failed; prompt preserved."));
    } finally {
      finishApiRequest(requestId);
    }
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const result = await createAiChatAttachment(file, createAttachmentId);

    if (!result.attachment) {
      setAttachmentError(result.error ?? t("{name} could not be attached.", { name: file.name }));
      return;
    }

    const attachment = result.attachment;

    setAttachments((currentAttachments) => [...currentAttachments, attachment]);
    setAttachmentError(result.error ?? "");
    setStatusMessage(t("{name} attached locally. {status}.", {
      name: file.name,
      status: t(attachmentStatusLabel(attachment.status))
    }));
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((currentAttachment) => currentAttachment.id !== attachmentId)
    );
    setStatusMessage(t("Attachment removed from UI memory."));
  };

  const handleClearAttachments = () => {
    setAttachments([]);
    setAttachmentError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatusMessage(t("All attachments cleared from UI memory."));
  };

  const handleTestModel = async () => {
    if (isRequestInFlight) {
      setStatusMessage(t("A model request is already in flight."));
      return;
    }

    const configResult = resolveAiRequestConfig();

    if ("error" in configResult) {
      appendAssistantError(t("API setup error: {error}", { error: configResult.error }));
      setStatusMessage(t("API setup is incomplete; model test was not sent."));
      return;
    }

    const { controller, requestId } = beginApiRequest("test");

    setStatusMessage(t("Testing {model}...", { model: configResult.config.model }));

    try {
      const assistantContent = await postAiChatRequest(
        configResult.config,
        [
          {
            role: "user",
            content: "Reply with one short sentence confirming this configured AI endpoint works."
          }
        ],
        controller.signal
      );

      if (requestIdRef.current !== requestId) return;

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", `${t("Model test succeeded for {model}.", { model: configResult.config.model })}\n\n${assistantContent}`)
      ]);
      setStatusMessage(t("Model test succeeded."));
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      const message = isAbortError(error) ? t("Request cancelled before completion.") : errorMessageFromUnknown(error);

      appendAssistantError(t("AI test error: {error}", { error: message }));
      setStatusMessage(isAbortError(error) ? t("Model test cancelled.") : t("Model test failed."));
    } finally {
      finishApiRequest(requestId);
    }
  };

  const handleCancelRequest = () => {
    if (!activeRequestControllerRef.current) return;

    activeRequestControllerRef.current.abort();
  };

  const handleClearApiKey = () => {
    setApiKey("");
    removeSessionValue(SESSION_STORAGE_KEYS.apiKey);
    setStatusMessage(t("API key cleared from UI state and sessionStorage."));
  };

  const handleClearConversation = () => {
    const isDefaultMessageList =
      messages.length === DEFAULT_MESSAGES.length &&
      messages.every((message, index) => message.id === DEFAULT_MESSAGES[index]?.id);

    if (!isDefaultMessageList) {
      const shouldClear =
        typeof window === "undefined" ||
        window.confirm(
          t("Clear the local AI conversation history? This removes UI-only chat history from localStorage. API key and current attachments stay in this tab's UI state.")
        );

      if (!shouldClear) {
        setStatusMessage(t("Clear conversation cancelled."));
        return;
      }

      skipNextMessagePersistenceRef.current = true;
    }

    removeLocalValue(LOCAL_STORAGE_KEYS.messages);
    setMessages(DEFAULT_MESSAGES);
    setStatusMessage(t("Conversation cleared locally and removed from localStorage."));
  };

  const handleCopyPromptPreview = () => {
    const preview = buildPreviewPrompt();
    const attachmentNote = attachments.some((attachment) => attachment.textContent || attachment.imageDataUrl)
      ? t("Copy prompt preview omitted attachment contents")
      : "";

    void copyToClipboard(
      preview,
      t("Composed prompt preview copied ({count} characters{note}).", {
        count: formatCount(preview.length),
        note: attachmentNote
      })
    );
  };

  const handleCopyLatestResponse = () => {
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.id !== "ai-session-seed");

    if (!latestAssistantMessage) {
      setStatusMessage(t("No assistant response to copy yet."));
      return;
    }

    void copyToClipboard(
      latestAssistantMessage.content,
      t("Latest assistant response copied ({count} characters).", {
        count: formatCount(latestAssistantMessage.content.length)
      })
    );
  };

  const handleCopyCodeBlock = (code: string) => {
    void copyToClipboard(code, t("Code block copied ({count} characters).", { count: formatCount(code.length) }));
  };

  return (
    <aside className={`ai-chat-dock ${statusClass}`} aria-label={t("AI chat dock")}>
      <button
        type="button"
        className="ai-chat-dock__launcher"
        aria-controls="ai-chat-dock-panel"
        aria-expanded={isOpen}
        aria-label={launcherLabel}
        tabIndex={isOpen ? -1 : undefined}
        onClick={() => onOpenChange(true)}
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span>AI</span>
      </button>

      <section
        id="ai-chat-dock-panel"
        className="ai-chat-dock__panel"
        aria-hidden={!isOpen}
        aria-labelledby="ai-chat-dock-title"
      >
        <div className="ai-chat-dock__header">
          <div className="ai-chat-dock__header-copy">
            <h2 id="ai-chat-dock-title">{t("AI Workspace")}</h2>
            <p>{t("Draft-only context surface. Actions stay in the existing review screens.")}</p>
          </div>
          <button
            type="button"
            className="ghost ai-chat-dock__close"
            aria-label={t("Collapse AI workspace")}
            tabIndex={hiddenPanelTabIndex}
            onClick={() => onOpenChange(false)}
          >
            <PanelRightClose size={17} aria-hidden="true" />
            <span>{t("Collapse")}</span>
          </button>
        </div>

        <div className="ai-chat-dock__body">
          <section className="ai-chat-dock__section" aria-label={t("Model settings")}>
            <h3>{t("Model")}</h3>
            <div className="ai-chat-dock__setup">
              <label>
                {t("Model selector")}
                <select
                  value={selectedModel}
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (isAiModelOption(value)) setSelectedModel(value);
                  }}
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.label)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("API base URL")}
                <input
                  value={apiBaseUrl}
                  placeholder="/api/ai-chat"
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => setApiBaseUrl(event.target.value)}
                />
              </label>

              <label className="ai-chat-dock__field--wide">
                {t("Custom model ID")}
                <input
                  value={customModelId}
                  placeholder="gpt-5.5"
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => setCustomModelId(event.target.value)}
                />
              </label>

              <label className="ai-chat-dock__field--wide">
                {t("API key")}
                <span className="ai-chat-dock__input-icon">
                  <KeyRound size={15} aria-hidden="true" />
                  <input
                    type="password"
                    value={apiKey}
                    placeholder={t("Memory-only by default")}
                    tabIndex={hiddenPanelTabIndex}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </span>
              </label>

              <label className="ai-chat-dock__checkbox ai-chat-dock__field--wide">
                <input
                  type="checkbox"
                  checked={shouldPersistApiKeyInSession}
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => setShouldPersistApiKeyInSession(event.target.checked)}
                />
                {t("Keep API key for this tab session")}
              </label>
            </div>

            <div className="ai-chat-dock__button-row">
              <button
                type="button"
                className="ghost"
                disabled={isRequestInFlight}
                tabIndex={hiddenPanelTabIndex}
                onClick={handleTestModel}
              >
                <FlaskConical size={16} />
                {requestMode === "test" ? t("Testing model") : t("Test model")}
              </button>
              <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearApiKey}>
                <XCircle size={16} />
                {t("Clear API key")}
              </button>
            </div>
          </section>

          <section className="ai-chat-dock__section" aria-label={t("Prompt settings")}>
            <h3>{t("Prompt Settings")}</h3>
            <label className="ai-chat-dock__field-label">
              {t("Prompt mode")}
              <select
                value={promptMode}
                tabIndex={hiddenPanelTabIndex}
                onChange={(event) => {
                  const value = event.target.value;

                  if (isPromptMode(value)) setPromptMode(value);
                }}
              >
                {PROMPT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <dl className="ai-chat-dock__context">
            <div>
              <dt>{t("Current screen")}</dt>
              <dd>{currentScreenLabel}</dd>
            </div>
            {selectedThoughtTitle && (
              <div>
                <dt>{t("Selected thought")}</dt>
                <dd>{selectedThoughtTitle}</dd>
              </div>
            )}
            {selectedProjectTitle && (
              <div>
                <dt>{t("Selected project")}</dt>
                <dd>{selectedProjectTitle}</dd>
              </div>
            )}
            <div>
              <dt>{t("Active model")}</dt>
              <dd>{activeModelLabel}</dd>
            </div>
            <div>
              <dt>{t("API key")}</dt>
              <dd>{apiKey ? t("Loaded in UI state") : t("Not set")}</dd>
            </div>
          </dl>

          <div className="ai-chat-dock__summary" aria-label={t("AI review summary")}>
            <div>
              <span>{t("AI drafts")}</span>
              <strong>{aiDraftCount}</strong>
            </div>
            <div>
              <span>{t("Review items")}</span>
              <strong>{reviewQueueCount}</strong>
            </div>
          </div>

          <div className="ai-chat-dock__actions">
            <button
              type="button"
              className="ai-chat-dock__action ai-chat-dock__action--primary"
              tabIndex={hiddenPanelTabIndex}
              onClick={onOpenAiPanel}
            >
              <Wand2 size={16} />
              {t("Open AI Panel")}
            </button>
            <button
              type="button"
              className="ai-chat-dock__action ai-chat-dock__action--secondary ghost"
              tabIndex={hiddenPanelTabIndex}
              onClick={onOpenReviewQueue}
            >
              <ClipboardCheck size={16} />
              {t("Open Review Queue")}
            </button>
          </div>

          <section className="ai-chat-dock__section ai-chat-dock__section--output" aria-label={t("AI output and response")}>
            <h3>{t("Output")}</h3>
            <div
              className="ai-chat-dock__messages"
              aria-label={t("AI session conversation")}
              aria-live="polite"
              ref={messagesPanelRef}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={[
                    "ai-chat-dock__message",
                    `ai-chat-dock__message--${message.role}`,
                    message.variant === "error" ? "ai-chat-dock__message--error" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span>
                    {message.variant === "error" ? t("Assistant error") : message.role === "assistant" ? t("Assistant") : t("You")} ·{" "}
                    {message.createdAt}
                  </span>
                  <MarkdownLikeMessage
                    content={message.id === "ai-session-seed" ? t(message.content) : message.content}
                    copyButtonTabIndex={hiddenPanelTabIndex}
                    onCopyCode={handleCopyCodeBlock}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="ai-chat-dock__section ai-chat-dock__attachments" aria-label={t("Attachment upload")}>
            <h3>{t("Attachments")}</h3>
            <label className="ai-chat-dock__field-label">
              {t("Upload file")}
              <input
                type="file"
                accept={ATTACHMENT_ACCEPT}
                ref={fileInputRef}
                tabIndex={hiddenPanelTabIndex}
                onChange={handleAttachmentChange}
              />
            </label>
            <div className="ai-chat-dock__attachment-meta">
              <span>{t("Supported")}</span>
              <strong>json, txt, md, pdf, png, jpg, jpeg · 20MB max</strong>
            </div>
            {attachments.length > 0 && (
              <div className="ai-chat-dock__attachment-controls">
                <span>{t("{count} file(s) in UI memory only", { count: attachments.length })}</span>
                <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearAttachments}>
                  <Trash2 size={15} />
                  {t("Clear attachments")}
                </button>
              </div>
            )}
            {attachmentError && <p className="ai-chat-dock__status ai-chat-dock__status--error">{attachmentError}</p>}
            {attachments.length > 0 && (
              <ul className="ai-chat-dock__attachment-list">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className={
                      attachment.status === "extraction-failed" ||
                      attachment.status === "unsupported" ||
                      attachment.status === "pdf-unreadable"
                        ? "ai-chat-dock__attachment--error"
                        : ""
                    }
                  >
                    <span>{attachment.name}</span>
                    <small>
                      {attachment.extension || "unknown"} · {attachment.mimeType || "unknown MIME"} ·{" "}
                      {formatBytes(attachment.size)}
                    </small>
                    <small>
                      {t(attachmentStatusLabel(attachment.status))} · {attachment.statusMessage}
                    </small>
                    <button
                      type="button"
                      className="ghost"
                      aria-label={t("Remove {name}", { name: attachment.name })}
                      tabIndex={hiddenPanelTabIndex}
                      onClick={() => handleRemoveAttachment(attachment.id)}
                    >
                      <XCircle size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <form className="ai-chat-dock__composer" onSubmit={handleSubmit}>
          <label>
            {t("Prompt input")}
            <textarea
              value={promptDraft}
              placeholder={t("Ask for a Codex prompt, paste a report, or discuss an architecture decision.")}
              aria-label={t("AI chat draft input")}
              aria-busy={requestMode === "send"}
              tabIndex={hiddenPanelTabIndex}
              onChange={(event) => setPromptDraft(event.target.value)}
            />
          </label>
          <div className="ai-chat-dock__composer-actions">
            <button
              type="submit"
              className="ai-chat-dock__action ai-chat-dock__action--primary"
              disabled={isRequestInFlight || !promptDraft.trim()}
              tabIndex={hiddenPanelTabIndex}
            >
              <Send size={16} />
              {requestMode === "send" ? t("Sending") : t("Send")}
            </button>
            {isRequestInFlight && (
              <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCancelRequest}>
                <XCircle size={16} />
                {t("Cancel request")}
              </button>
            )}
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCopyPromptPreview}>
              <Copy size={16} />
              {t("Copy composed prompt preview")}
            </button>
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCopyLatestResponse}>
              <Copy size={16} />
              {t("Copy latest response")}
            </button>
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearConversation}>
              <Trash2 size={16} />
              {t("Clear conversation")}
            </button>
          </div>
          {statusMessage && (
            <p className={`ai-chat-dock__status ${isRequestInFlight ? "ai-chat-dock__status--loading" : ""}`}>
              {statusMessage}
            </p>
          )}
        </form>
      </section>
    </aside>
  );
}
