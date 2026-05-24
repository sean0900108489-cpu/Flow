export type AiChatRole = "assistant" | "user";

export type AiChatAttachmentStatus =
  | "metadata-only"
  | "text-extracted"
  | "image-vision"
  | "unsupported"
  | "pdf-unreadable"
  | "extraction-failed"
  | "content-truncated";

export type AttachmentPromptMode = "api" | "history" | "preview";

export interface AiChatAttachment {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  status: AiChatAttachmentStatus;
  statusMessage: string;
  textContent?: string;
  imageDataUrl?: string;
}

export interface AiChatStoredMessage {
  role: AiChatRole;
  content: string;
}

export type ChatCompletionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "auto" } };

export interface AiProviderRequestMessage {
  role: AiChatRole;
  content: string | ChatCompletionContentPart[];
}

export type AiProviderMode = "chat-completions" | "responses";

export interface AiProviderRequestConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  providerMode: AiProviderMode;
}

export interface CreateAiChatAttachmentResult {
  attachment?: AiChatAttachment;
  error?: string;
}

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_PROMPT_CHARACTERS = 12_000;

const SUPPORTED_ATTACHMENT_EXTENSIONS = ["json", "txt", "md", "pdf", "png", "jpg", "jpeg"] as const;
const TEXT_ATTACHMENT_EXTENSIONS = new Set(["json", "txt", "md"]);
const IMAGE_ATTACHMENT_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);
const TEXT_ATTACHMENT_MIME_TYPES = new Set(["application/json", "text/plain", "text/markdown"]);
const IMAGE_ATTACHMENT_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
const PDF_ATTACHMENT_MIME_TYPES = new Set(["application/pdf"]);
const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
  "application/json",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

export const ATTACHMENT_ACCEPT = [
  ".json",
  ".txt",
  ".md",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  "application/json",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "image/png",
  "image/jpeg"
].join(",");

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCount(count: number) {
  return count.toLocaleString();
}

export function attachmentStatusLabel(status: AiChatAttachmentStatus) {
  if (status === "text-extracted") return "text extracted";
  if (status === "image-vision") return "image attached for vision";
  if (status === "unsupported") return "unsupported file type";
  if (status === "pdf-unreadable") return "PDF content not readable yet";
  if (status === "extraction-failed") return "extraction failed";
  if (status === "content-truncated") return "content truncated due to size limit";

  return "metadata only";
}

export function isSupportedAttachment(file: Pick<File, "name" | "type">) {
  const extension = getFileExtension(file.name);

  return (
    SUPPORTED_ATTACHMENT_EXTENSIONS.some((supported) => supported === extension) ||
    SUPPORTED_ATTACHMENT_MIME_TYPES.has(file.type)
  );
}

function isTextAttachment(extension: string, mimeType: string) {
  return TEXT_ATTACHMENT_EXTENSIONS.has(extension) || TEXT_ATTACHMENT_MIME_TYPES.has(mimeType);
}

function isImageAttachment(extension: string, mimeType: string) {
  return IMAGE_ATTACHMENT_EXTENSIONS.has(extension) || IMAGE_ATTACHMENT_MIME_TYPES.has(mimeType);
}

function isPdfAttachment(extension: string, mimeType: string) {
  return extension === "pdf" || PDF_ATTACHMENT_MIME_TYPES.has(mimeType);
}

function imageMimeType(extension: string, mimeType: string) {
  if (IMAGE_ATTACHMENT_MIME_TYPES.has(mimeType)) return mimeType;
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "image/png";
}

function normalizeAttachmentText(content: string) {
  return content.replace(/\r\n/g, "\n");
}

function formatAttachmentTextForPrompt(content: string) {
  const normalizedContent = normalizeAttachmentText(content);

  if (normalizedContent.length <= MAX_ATTACHMENT_PROMPT_CHARACTERS) return normalizedContent;

  return [
    normalizedContent.slice(0, MAX_ATTACHMENT_PROMPT_CHARACTERS),
    "",
    `[Attachment text truncated to ${MAX_ATTACHMENT_PROMPT_CHARACTERS.toLocaleString()} characters for this prompt.]`
  ].join("\n");
}

function attachmentTextSummary(content: string) {
  const normalizedLength = normalizeAttachmentText(content).length;

  if (normalizedLength <= MAX_ATTACHMENT_PROMPT_CHARACTERS) {
    return `${formatCount(normalizedLength)} characters included in API sends from UI memory only`;
  }

  return `first ${formatCount(MAX_ATTACHMENT_PROMPT_CHARACTERS)} of ${formatCount(
    normalizedLength
  )} characters included in API sends from UI memory only`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  if (typeof btoa === "function") return btoa(binary);

  const globalWithBuffer = globalThis as typeof globalThis & {
    Buffer?: { from: (input: string, encoding: "binary") => { toString: (encoding: "base64") => string } };
  };

  return globalWithBuffer.Buffer?.from(binary, "binary").toString("base64") ?? "";
}

async function readImageDataUrl(file: File, mimeType: string) {
  const base64 = arrayBufferToBase64(await file.arrayBuffer());

  if (!base64) throw new Error("Image bytes could not be encoded.");

  return `data:${mimeType};base64,${base64}`;
}

export async function createAiChatAttachment(
  file: File,
  createId: () => string
): Promise<CreateAiChatAttachmentResult> {
  const extension = getFileExtension(file.name);
  const mimeType = file.type || "unknown";
  const baseAttachment = {
    id: createId(),
    name: file.name,
    extension,
    mimeType,
    size: file.size
  };

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { error: `${file.name} is larger than 20MB.` };
  }

  if (!isSupportedAttachment(file)) {
    return {
      attachment: {
        ...baseAttachment,
        status: "unsupported",
        statusMessage: "Only txt, md, json, png, jpg, jpeg, and PDF metadata are supported."
      },
      error: `${file.name} is an unsupported file type; only metadata was retained.`
    };
  }

  if (isTextAttachment(extension, file.type)) {
    try {
      const textContent = await file.text();
      const normalizedLength = normalizeAttachmentText(textContent).length;
      const isTruncated = normalizedLength > MAX_ATTACHMENT_PROMPT_CHARACTERS;

      return {
        attachment: {
          ...baseAttachment,
          status: isTruncated ? "content-truncated" : "text-extracted",
          statusMessage: isTruncated
            ? `Text extracted; first ${formatCount(MAX_ATTACHMENT_PROMPT_CHARACTERS)} of ${formatCount(
                normalizedLength
              )} characters are sent to the model.`
            : "Text extracted and included in API requests from UI memory.",
          textContent
        }
      };
    } catch {
      return {
        attachment: {
          ...baseAttachment,
          status: "extraction-failed",
          statusMessage: "Text could not be read with the browser File API; metadata only."
        },
        error: `${file.name} could not be read as text, so only metadata was retained.`
      };
    }
  }

  if (isImageAttachment(extension, file.type)) {
    const resolvedMimeType = imageMimeType(extension, file.type);

    try {
      return {
        attachment: {
          ...baseAttachment,
          mimeType: resolvedMimeType,
          status: "image-vision",
          statusMessage: "Image content is attached to API requests for vision models from UI memory.",
          imageDataUrl: await readImageDataUrl(file, resolvedMimeType)
        }
      };
    } catch {
      return {
        attachment: {
          ...baseAttachment,
          mimeType: resolvedMimeType,
          status: "extraction-failed",
          statusMessage: "Image bytes could not be read; metadata only."
        },
        error: `${file.name} could not be read as an image, so only metadata was retained.`
      };
    }
  }

  if (isPdfAttachment(extension, file.type)) {
    return {
      attachment: {
        ...baseAttachment,
        status: "pdf-unreadable",
        statusMessage: "PDF text extraction is not implemented yet; PDF content is not readable in this dock."
      }
    };
  }

  return {
    attachment: {
      ...baseAttachment,
      status: "metadata-only",
      statusMessage: "Only filename, MIME type, extension, and size are sent."
    }
  };
}

export function buildAttachmentPromptBlock(attachments: readonly AiChatAttachment[], mode: AttachmentPromptMode) {
  if (mode === "history" && attachments.length) {
    return "Attachment context was included from UI memory for this request. Attachment contents are not stored in chat history.";
  }

  if (!attachments.length) return "none";

  return attachments
    .map((attachment) => {
      const metadata = `- ${attachment.name} (${attachment.extension || "unknown"}, ${formatBytes(attachment.size)}, ${
        attachment.mimeType || "unknown MIME"
      })\n  Status: ${attachmentStatusLabel(attachment.status)}. ${attachment.statusMessage}`;

      if (attachment.textContent === undefined) return metadata;

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
    .join("\n\n");
}

export function buildComposedPrompt({
  promptMode,
  promptDraft,
  attachments,
  mode = "api"
}: {
  promptMode: string;
  promptDraft: string;
  attachments: readonly AiChatAttachment[];
  mode?: AttachmentPromptMode;
}) {
  return [
    `Prompt mode: ${promptMode}`,
    `Prompt:\n${promptDraft.trim() || "(empty)"}`,
    `Attachments:\n${buildAttachmentPromptBlock(attachments, mode)}`
  ].join("\n\n");
}

export function buildComposedPromptPreview({
  promptMode,
  activeModelLabel,
  apiBaseUrl,
  promptDraft,
  attachments
}: {
  promptMode: string;
  activeModelLabel: string;
  apiBaseUrl: string;
  promptDraft: string;
  attachments: readonly AiChatAttachment[];
}) {
  return [
    `Prompt mode: ${promptMode}`,
    `Model: ${activeModelLabel}`,
    `API base URL: ${apiBaseUrl || "(not set)"}`,
    `Prompt:\n${promptDraft.trim() || "(empty)"}`,
    `Attachments:\n${buildAttachmentPromptBlock(attachments, "preview")}`
  ].join("\n\n");
}

function toApiHistoryMessages(messages: readonly AiChatStoredMessage[]): AiProviderRequestMessage[] {
  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function imageContentParts(attachments: readonly AiChatAttachment[]): ChatCompletionContentPart[] {
  return attachments
    .filter((attachment) => attachment.status === "image-vision" && attachment.imageDataUrl)
    .map((attachment) => ({
      type: "image_url",
      image_url: {
        url: attachment.imageDataUrl as string,
        detail: "auto"
      }
    }));
}

export function buildAiRequestMessages({
  historyMessages,
  promptMode,
  promptDraft,
  attachments
}: {
  historyMessages: readonly AiChatStoredMessage[];
  promptMode: string;
  promptDraft: string;
  attachments: readonly AiChatAttachment[];
}): AiProviderRequestMessage[] {
  const currentPrompt = buildComposedPrompt({ promptMode, promptDraft, attachments, mode: "api" });
  const images = imageContentParts(attachments);
  const currentUserMessage: AiProviderRequestMessage = {
    role: "user",
    content: images.length ? [{ type: "text", text: currentPrompt }, ...images] : currentPrompt
  };

  return [...toApiHistoryMessages(historyMessages), currentUserMessage];
}

export function resolveAiProviderEndpoint(apiBaseUrl: string): { endpoint: string; providerMode: AiProviderMode } {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, "");

  if (/\/responses$/i.test(normalizedBaseUrl)) {
    return { endpoint: normalizedBaseUrl, providerMode: "responses" };
  }

  if (/\/chat\/completions$/i.test(normalizedBaseUrl)) {
    return { endpoint: normalizedBaseUrl, providerMode: "chat-completions" };
  }

  return {
    endpoint: `${normalizedBaseUrl}/chat/completions`,
    providerMode: "chat-completions"
  };
}

export function buildChatCompletionsRequestBody(model: string, messages: readonly AiProviderRequestMessage[]) {
  return {
    model,
    messages
  };
}

export function buildOpenAIResponsesRequestBody(model: string, messages: readonly AiProviderRequestMessage[]) {
  return {
    model,
    store: false,
    input: messages.map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : message.content.map((part) =>
              part.type === "text"
                ? { type: "input_text", text: part.text }
                : { type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail }
            )
    }))
  };
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

      return contentToText(record?.text ?? record?.content ?? record?.output_text);
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
    contentToText(record?.output) ||
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

export async function postAiChatRequest(
  config: AiProviderRequestConfig,
  messages: readonly AiProviderRequestMessage[],
  signal: AbortSignal
) {
  const requestBody =
    config.providerMode === "responses"
      ? buildOpenAIResponsesRequestBody(config.model, messages)
      : buildChatCompletionsRequestBody(config.model, messages);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody),
    signal
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const detail = extractApiErrorMessage(payload);

    throw new Error(detail || `Request failed with ${response.status} ${response.statusText}.`);
  }

  const assistantContent = extractAssistantContent(payload);

  if (!assistantContent) {
    throw new Error("API response did not include assistant text content.");
  }

  return assistantContent;
}
