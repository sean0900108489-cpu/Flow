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

type AiChatRole = "assistant" | "user";

type AiChatMessageVariant = "default" | "error";

type AiPromptMode = "freeform" | "context-summary" | "engineering-handoff";

type AiModelOption = "gpt-5.5-2026-04-23" | "gpt-5.1" | "custom";

type ApiRequestMode = "send" | "test";

type AiChatAttachmentStatus = "text-included" | "metadata-only" | "read-error";

type AttachmentPromptMode = "api" | "history" | "preview";

interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string;
  variant?: AiChatMessageVariant;
}

interface AiChatAttachment {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  status: AiChatAttachmentStatus;
  statusMessage: string;
  textContent?: string;
}

interface ChatCompletionRequestMessage {
  role: AiChatRole;
  content: string;
}

interface ChatCompletionConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

type MarkdownLikeBlock =
  | { id: string; type: "paragraph"; lines: string[] }
  | { id: string; type: "list"; items: string[] }
  | { id: string; type: "code"; language: string; content: string };

const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENT_PROMPT_CHARACTERS = 12_000;
const SUPPORTED_ATTACHMENT_EXTENSIONS = ["json", "txt", "md", "pdf", "png"] as const;
const TEXT_ATTACHMENT_EXTENSIONS = new Set(["json", "txt", "md"]);
const TEXT_ATTACHMENT_MIME_TYPES = new Set(["application/json", "text/plain", "text/markdown"]);
const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  "application/json",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "image/png"
]);
const ATTACHMENT_ACCEPT = ".json,.txt,.md,.pdf,.png,application/json,text/plain,text/markdown,application/pdf,image/png";

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

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedAttachment(file: File) {
  const extension = getFileExtension(file.name);

  return SUPPORTED_ATTACHMENT_EXTENSIONS.some((supported) => supported === extension) || SUPPORTED_ATTACHMENT_MIME_TYPES.has(file.type);
}

function isTextAttachment(extension: string, mimeType: string) {
  return TEXT_ATTACHMENT_EXTENSIONS.has(extension) || TEXT_ATTACHMENT_MIME_TYPES.has(mimeType);
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCount(count: number) {
  return count.toLocaleString();
}

function attachmentStatusLabel(status: AiChatAttachmentStatus) {
  if (status === "text-included") return "text included in prompt";
  if (status === "read-error") return "text read failed; metadata only";

  return "metadata only; content not extracted";
}

function formatAttachmentTextForPrompt(content: string) {
  const normalizedContent = content.replace(/\r\n/g, "\n");

  if (normalizedContent.length <= MAX_ATTACHMENT_PROMPT_CHARACTERS) return normalizedContent;

  return [
    normalizedContent.slice(0, MAX_ATTACHMENT_PROMPT_CHARACTERS),
    "",
    `[Attachment text truncated to ${MAX_ATTACHMENT_PROMPT_CHARACTERS.toLocaleString()} characters for this prompt.]`
  ].join("\n");
}

function attachmentTextSummary(content: string) {
  const normalizedLength = content.replace(/\r\n/g, "\n").length;

  if (normalizedLength <= MAX_ATTACHMENT_PROMPT_CHARACTERS) {
    return `${formatCount(normalizedLength)} characters included in API sends from UI memory only`;
  }

  return `first ${formatCount(MAX_ATTACHMENT_PROMPT_CHARACTERS)} of ${formatCount(
    normalizedLength
  )} characters included in API sends from UI memory only`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function contentToText(value: unknown): string {
  if (typeof value === "string") return value.trim();

  if (!Array.isArray(value)) return "";

  return value
    .map((part) => {
      if (typeof part === "string") return part;

      const record = asRecord(part);

      return contentToText(record?.text ?? record?.content);
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractAssistantContent(payload: unknown) {
  const record = asRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = asRecord(choices[0]);
  const message = asRecord(firstChoice?.message);
  const delta = asRecord(firstChoice?.delta);

  return (
    contentToText(message?.content) ||
    contentToText(firstChoice?.text) ||
    contentToText(delta?.content) ||
    contentToText(record?.output_text) ||
    contentToText(record?.content) ||
    contentToText(record?.message) ||
    contentToText(asRecord(record?.message)?.content)
  );
}

function extractApiErrorMessage(payload: unknown) {
  if (typeof payload === "string") return payload.trim();

  const record = asRecord(payload);
  const error = asRecord(record?.error);

  return (
    contentToText(error?.message) ||
    contentToText(error?.code) ||
    contentToText(record?.message) ||
    contentToText(record?.error)
  );
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    const text = await response.text();

    if (!text.trim()) return undefined;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
}

function buildChatCompletionsEndpoint(apiBaseUrl: string) {
  return `${apiBaseUrl.replace(/\/+$/, "")}/chat/completions`;
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
  const blocks = parseMarkdownLike(content);

  if (!blocks.length) {
    return <p className="ai-chat-dock__message-paragraph">(empty)</p>;
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
                  Copy code
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

function toApiMessages(messages: AiChatMessage[]): ChatCompletionRequestMessage[] {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  return "Unknown API error.";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function postChatCompletion(
  config: ChatCompletionConfig,
  messages: ChatCompletionRequestMessage[],
  signal: AbortSignal
) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages
    }),
    signal
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const detail = extractApiErrorMessage(payload);

    throw new Error(detail || `Request failed with ${response.status} ${response.statusText}.`);
  }

  const assistantContent = extractAssistantContent(payload);

  if (!assistantContent) {
    throw new Error("API response did not include choices[0].message.content.");
  }

  return assistantContent;
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
  const launcherLabel = "Open AI workspace";
  const hiddenPanelTabIndex = isOpen ? undefined : -1;
  const activeModelLabel = selectedModel === "custom" ? customModelId || "Custom model" : selectedModel;

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

  const attachmentPromptBlock = (mode: AttachmentPromptMode) => {
    if (mode === "history" && attachments.length) {
      return "Attachment context was included from UI memory for this request. Attachment details and text content are not stored in chat history.";
    }

    const attachmentPreview = attachments.length
      ? attachments
          .map((attachment) => {
            const metadata = `- ${attachment.name} (${attachment.extension || "unknown"}, ${formatBytes(attachment.size)}, ${
              attachment.mimeType || "unknown MIME"
            })\n  Status: ${attachmentStatusLabel(attachment.status)}. ${attachment.statusMessage}`;

            if (!attachment.textContent) return metadata;

            if (mode === "preview") {
              return `${metadata}\n  Text content: ${attachmentTextSummary(
                attachment.textContent
              )}. Raw attachment text is omitted from copied previews.`;
            }

            return [
              metadata,
              "",
              "Text content:",
              `<<<BEGIN_ATTACHMENT_TEXT:${attachment.name}>>>`,
              formatAttachmentTextForPrompt(attachment.textContent),
              "<<<END_ATTACHMENT_TEXT>>>"
            ].join("\n");
          })
          .join("\n\n")
      : "none";

    return attachmentPreview;
  };

  const buildComposedPrompt = (mode: AttachmentPromptMode = "api") => {
    return [
      `Prompt mode: ${promptMode}`,
      `Prompt:\n${promptDraft.trim() || "(empty)"}`,
      `Attachments:\n${attachmentPromptBlock(mode)}`
    ].join("\n\n");
  };

  const buildComposedPromptPreview = () => {
    const attachmentPreview = attachmentPromptBlock("preview");

    return [
      `Prompt mode: ${promptMode}`,
      `Model: ${activeModelLabel}`,
      `API base URL: ${apiBaseUrl || "(not set)"}`,
      `Prompt:\n${promptDraft.trim() || "(empty)"}`,
      `Attachments:\n${attachmentPreview}`
    ].join("\n\n");
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    if (!text.trim()) {
      setStatusMessage("Nothing to copy.");
      return;
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setStatusMessage(successMessage);
        return;
      }

      if (copyTextWithHiddenTextarea(text)) {
        setStatusMessage(`${successMessage} Clipboard fallback used.`);
        return;
      }

      setStatusMessage("Clipboard is unavailable in this browser context.");
    } catch {
      if (copyTextWithHiddenTextarea(text)) {
        setStatusMessage(`${successMessage} Clipboard fallback used.`);
        return;
      }

      setStatusMessage("Clipboard copy failed.");
    }
  };

  const appendAssistantError = (message: string) => {
    setMessages((currentMessages) => [...currentMessages, createMessage("assistant", message, "error")]);
  };

  const resolveChatCompletionConfig = (): { config: ChatCompletionConfig } | { error: string } => {
    const trimmedApiKey = apiKey.trim();
    const trimmedBaseUrl = apiBaseUrl.trim();
    const resolvedModel = selectedModel === "custom" ? customModelId.trim() : selectedModel;

    if (!trimmedApiKey) return { error: "API key is required before sending to the model." };
    if (!trimmedBaseUrl) return { error: "API base URL is required before sending to the model." };
    if (!resolvedModel) return { error: "Model ID is required before sending to the model." };

    return {
      config: {
        apiKey: trimmedApiKey,
        endpoint: buildChatCompletionsEndpoint(trimmedBaseUrl),
        model: resolvedModel
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
      setStatusMessage("A model request is already in flight.");
      return;
    }

    const submittedPromptDraft = promptDraft;
    const content = submittedPromptDraft.trim();

    if (!content) {
      setStatusMessage("Prompt is empty.");
      return;
    }

    const configResult = resolveChatCompletionConfig();

    if ("error" in configResult) {
      appendAssistantError(`API setup error: ${configResult.error}`);
      setStatusMessage("API setup is incomplete; prompt preserved.");
      return;
    }

    const requestUserMessage = createMessage("user", buildComposedPrompt("api"));
    const displayUserMessage = createMessage("user", buildComposedPrompt("history"));
    const requestMessages = toApiMessages([...messages, requestUserMessage]);
    const { controller, requestId } = beginApiRequest("send");

    setMessages((currentMessages) => [...currentMessages, displayUserMessage]);
    setStatusMessage(`Sending to ${configResult.config.model}...`);

    try {
      const assistantContent = await postChatCompletion(configResult.config, requestMessages, controller.signal);

      if (requestIdRef.current !== requestId) return;

      setMessages((currentMessages) => [...currentMessages, createMessage("assistant", assistantContent)]);
      setPromptDraft((currentDraft) => (currentDraft === submittedPromptDraft ? "" : currentDraft));
      setStatusMessage("Assistant response received.");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      const message = isAbortError(error) ? "Request cancelled before completion." : errorMessageFromUnknown(error);

      appendAssistantError(`API error: ${message}`);
      setStatusMessage(isAbortError(error) ? "Request cancelled; prompt preserved." : "API request failed; prompt preserved.");
    } finally {
      finishApiRequest(requestId);
    }
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const extension = getFileExtension(file.name);

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachmentError(`${file.name} is larger than 20MB.`);
      return;
    }

    if (!isSupportedAttachment(file)) {
      setAttachmentError(`${file.name} must be json, txt, md, pdf, or png.`);
      return;
    }

    let textContent: string | undefined;
    let status: AiChatAttachmentStatus = "metadata-only";
    let statusMessage = "PDF/image content is not extracted in this step.";

    if (isTextAttachment(extension, file.type)) {
      try {
        textContent = await file.text();
        status = "text-included";
        statusMessage = "Text content is included in prompt preview and API sends, with prompt truncation if needed.";
      } catch {
        status = "read-error";
        statusMessage = "Text could not be read with the browser File API; metadata only.";
        setAttachmentError(`${file.name} could not be read as text, so only metadata was retained.`);
      }
    }

    setAttachments((currentAttachments) => [
      ...currentAttachments,
      {
        id: createAttachmentId(),
        name: file.name,
        extension,
        mimeType: file.type || "unknown",
        size: file.size,
        status,
        statusMessage,
        textContent
      }
    ]);

    if (status !== "read-error") setAttachmentError("");

    setStatusMessage(`${file.name} attached locally. ${attachmentStatusLabel(status)}.`);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((currentAttachment) => currentAttachment.id !== attachmentId)
    );
    setStatusMessage("Attachment removed from UI memory.");
  };

  const handleClearAttachments = () => {
    setAttachments([]);
    setAttachmentError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatusMessage("All attachments cleared from UI memory.");
  };

  const handleTestModel = async () => {
    if (isRequestInFlight) {
      setStatusMessage("A model request is already in flight.");
      return;
    }

    const configResult = resolveChatCompletionConfig();

    if ("error" in configResult) {
      appendAssistantError(`API setup error: ${configResult.error}`);
      setStatusMessage("API setup is incomplete; model test was not sent.");
      return;
    }

    const { controller, requestId } = beginApiRequest("test");

    setStatusMessage(`Testing ${configResult.config.model}...`);

    try {
      const assistantContent = await postChatCompletion(
        configResult.config,
        [
          {
            role: "user",
            content: "Reply with one short sentence confirming this OpenAI-compatible chat completions endpoint works."
          }
        ],
        controller.signal
      );

      if (requestIdRef.current !== requestId) return;

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("assistant", `Model test succeeded for ${configResult.config.model}.\n\n${assistantContent}`)
      ]);
      setStatusMessage("Model test succeeded.");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      const message = isAbortError(error) ? "Request cancelled before completion." : errorMessageFromUnknown(error);

      appendAssistantError(`API test error: ${message}`);
      setStatusMessage(isAbortError(error) ? "Model test cancelled." : "Model test failed.");
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
    setStatusMessage("API key cleared from UI state and sessionStorage.");
  };

  const handleClearConversation = () => {
    const isDefaultMessageList =
      messages.length === DEFAULT_MESSAGES.length &&
      messages.every((message, index) => message.id === DEFAULT_MESSAGES[index]?.id);

    if (!isDefaultMessageList) {
      const shouldClear =
        typeof window === "undefined" ||
        window.confirm(
          "Clear the local AI conversation history? This removes UI-only chat history from localStorage. API key and current attachments stay in this tab's UI state."
        );

      if (!shouldClear) {
        setStatusMessage("Clear conversation cancelled.");
        return;
      }

      skipNextMessagePersistenceRef.current = true;
    }

    removeLocalValue(LOCAL_STORAGE_KEYS.messages);
    setMessages(DEFAULT_MESSAGES);
    setStatusMessage("Conversation cleared locally and removed from localStorage.");
  };

  const handleCopyPromptPreview = () => {
    const preview = buildComposedPromptPreview();
    const attachmentNote = attachments.some((attachment) => attachment.textContent)
      ? "; raw attachment text omitted from preview"
      : "";

    void copyToClipboard(
      preview,
      `Composed prompt preview copied (${formatCount(preview.length)} characters${attachmentNote}).`
    );
  };

  const handleCopyLatestResponse = () => {
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.id !== "ai-session-seed");

    if (!latestAssistantMessage) {
      setStatusMessage("No assistant response to copy yet.");
      return;
    }

    void copyToClipboard(
      latestAssistantMessage.content,
      `Latest assistant response copied (${formatCount(latestAssistantMessage.content.length)} characters).`
    );
  };

  const handleCopyCodeBlock = (code: string) => {
    void copyToClipboard(code, `Code block copied (${formatCount(code.length)} characters).`);
  };

  return (
    <aside className={`ai-chat-dock ${statusClass}`} aria-label="AI chat dock">
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
            <h2 id="ai-chat-dock-title">AI Workspace</h2>
            <p>Draft-only context surface. Actions stay in the existing review screens.</p>
          </div>
          <button
            type="button"
            className="ghost ai-chat-dock__close"
            aria-label="Collapse AI workspace"
            tabIndex={hiddenPanelTabIndex}
            onClick={() => onOpenChange(false)}
          >
            <PanelRightClose size={17} aria-hidden="true" />
            <span>Collapse</span>
          </button>
        </div>

        <div className="ai-chat-dock__body">
          <section className="ai-chat-dock__section" aria-label="Model settings">
            <h3>Model</h3>
            <div className="ai-chat-dock__setup">
              <label>
                Model selector
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
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                API base URL
                <input
                  value={apiBaseUrl}
                  placeholder="/api/ai-chat"
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => setApiBaseUrl(event.target.value)}
                />
              </label>

              <label className="ai-chat-dock__field--wide">
                Custom model ID
                <input
                  value={customModelId}
                  placeholder="gpt-5.5"
                  tabIndex={hiddenPanelTabIndex}
                  onChange={(event) => setCustomModelId(event.target.value)}
                />
              </label>

              <label className="ai-chat-dock__field--wide">
                API key
                <span className="ai-chat-dock__input-icon">
                  <KeyRound size={15} aria-hidden="true" />
                  <input
                    type="password"
                    value={apiKey}
                    placeholder="Memory-only by default"
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
                Keep API key for this tab session
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
                {requestMode === "test" ? "Testing model" : "Test model"}
              </button>
              <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearApiKey}>
                <XCircle size={16} />
                Clear API key
              </button>
            </div>
          </section>

          <section className="ai-chat-dock__section" aria-label="Prompt settings">
            <h3>Prompt Settings</h3>
            <label className="ai-chat-dock__field-label">
              Prompt mode
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
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <dl className="ai-chat-dock__context">
            <div>
              <dt>Current screen</dt>
              <dd>{currentScreenLabel}</dd>
            </div>
            {selectedThoughtTitle && (
              <div>
                <dt>Selected thought</dt>
                <dd>{selectedThoughtTitle}</dd>
              </div>
            )}
            {selectedProjectTitle && (
              <div>
                <dt>Selected project</dt>
                <dd>{selectedProjectTitle}</dd>
              </div>
            )}
            <div>
              <dt>Active model</dt>
              <dd>{activeModelLabel}</dd>
            </div>
            <div>
              <dt>API key</dt>
              <dd>{apiKey ? "Loaded in UI state" : "Not set"}</dd>
            </div>
          </dl>

          <div className="ai-chat-dock__summary" aria-label="AI review summary">
            <div>
              <span>AI drafts</span>
              <strong>{aiDraftCount}</strong>
            </div>
            <div>
              <span>Review items</span>
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
              Open AI Panel
            </button>
            <button
              type="button"
              className="ai-chat-dock__action ai-chat-dock__action--secondary ghost"
              tabIndex={hiddenPanelTabIndex}
              onClick={onOpenReviewQueue}
            >
              <ClipboardCheck size={16} />
              Open Review Queue
            </button>
          </div>

          <section className="ai-chat-dock__section ai-chat-dock__section--output" aria-label="AI output and response">
            <h3>Output</h3>
            <div
              className="ai-chat-dock__messages"
              aria-label="AI session conversation"
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
                    {message.variant === "error" ? "Assistant error" : message.role === "assistant" ? "Assistant" : "You"} ·{" "}
                    {message.createdAt}
                  </span>
                  <MarkdownLikeMessage
                    content={message.content}
                    copyButtonTabIndex={hiddenPanelTabIndex}
                    onCopyCode={handleCopyCodeBlock}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="ai-chat-dock__section ai-chat-dock__attachments" aria-label="Attachment upload">
            <h3>Attachments</h3>
            <label className="ai-chat-dock__field-label">
              Upload file
              <input
                type="file"
                accept={ATTACHMENT_ACCEPT}
                ref={fileInputRef}
                tabIndex={hiddenPanelTabIndex}
                onChange={handleAttachmentChange}
              />
            </label>
            <div className="ai-chat-dock__attachment-meta">
              <span>Supported</span>
              <strong>json, txt, md, pdf, png · 20MB max</strong>
            </div>
            {attachments.length > 0 && (
              <div className="ai-chat-dock__attachment-controls">
                <span>{attachments.length} file{attachments.length === 1 ? "" : "s"} in UI memory only</span>
                <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearAttachments}>
                  <Trash2 size={15} />
                  Clear attachments
                </button>
              </div>
            )}
            {attachmentError && <p className="ai-chat-dock__status ai-chat-dock__status--error">{attachmentError}</p>}
            {attachments.length > 0 && (
              <ul className="ai-chat-dock__attachment-list">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className={attachment.status === "read-error" ? "ai-chat-dock__attachment--error" : ""}
                  >
                    <span>{attachment.name}</span>
                    <small>
                      {attachment.extension || "unknown"} · {attachment.mimeType || "unknown MIME"} ·{" "}
                      {formatBytes(attachment.size)}
                    </small>
                    <small>
                      {attachmentStatusLabel(attachment.status)} · {attachment.statusMessage}
                    </small>
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`Remove ${attachment.name}`}
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
            Prompt input
            <textarea
              value={promptDraft}
              placeholder="請求 Codex prompt、貼上報告，或討論架構決策。"
              aria-label="AI chat draft input"
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
              {requestMode === "send" ? "Sending" : "Send"}
            </button>
            {isRequestInFlight && (
              <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCancelRequest}>
                <XCircle size={16} />
                Cancel request
              </button>
            )}
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCopyPromptPreview}>
              <Copy size={16} />
              Copy composed prompt preview
            </button>
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleCopyLatestResponse}>
              <Copy size={16} />
              Copy latest response
            </button>
            <button type="button" className="ghost" tabIndex={hiddenPanelTabIndex} onClick={handleClearConversation}>
              <Trash2 size={16} />
              Clear conversation
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
