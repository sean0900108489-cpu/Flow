import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_PROMPT_CHARACTERS,
  attachmentStatusLabel,
  buildAiRequestMessages,
  buildChatCompletionsRequestBody,
  buildComposedPrompt,
  buildComposedPromptPreview,
  buildOpenAIResponsesRequestBody,
  createAiChatAttachment,
  type AiChatAttachment
} from "./aiChatDockRequest";

const nextId = () => "attachment-test-id";

async function readAttachment(file: File) {
  const result = await createAiChatAttachment(file, nextId);

  expect(result.attachment).toBeDefined();

  return result.attachment as AiChatAttachment;
}

describe("AI chat dock attachment request composition", () => {
  it("composes PNG attachments as chat-completions image_url content parts", async () => {
    const attachment = await readAttachment(new File(["png-bytes"], "screenshot.png", { type: "image/png" }));
    const messages = buildAiRequestMessages({
      historyMessages: [],
      promptMode: "freeform",
      promptDraft: "這張圖裡有什麼？",
      attachments: [attachment]
    });
    const body = buildChatCompletionsRequestBody("gpt-5.1", messages);
    const content = body.messages[0].content;

    expect(attachment.status).toBe("image-vision");
    expect(Array.isArray(content)).toBe(true);
    expect(content).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Status: image attached for vision")
      }),
      {
        type: "image_url",
        image_url: {
          url: expect.stringMatching(/^data:image\/png;base64,/),
          detail: "auto"
        }
      }
    ]);
  });

  it("composes JPEG attachments as Responses API input_image content parts", async () => {
    const attachment = await readAttachment(new File(["jpeg-bytes"], "photo.jpg", { type: "image/jpeg" }));
    const messages = buildAiRequestMessages({
      historyMessages: [],
      promptMode: "freeform",
      promptDraft: "Describe this photo.",
      attachments: [attachment]
    });
    const body = buildOpenAIResponsesRequestBody("gpt-5.1", messages);
    const content = body.input[0].content;

    expect(attachment.status).toBe("image-vision");
    expect(body.store).toBe(false);
    expect(Array.isArray(content)).toBe(true);
    expect(content).toEqual([
      expect.objectContaining({
        type: "input_text",
        text: expect.stringContaining("Status: image attached for vision")
      }),
      {
        type: "input_image",
        image_url: expect.stringMatching(/^data:image\/jpeg;base64,/),
        detail: "auto"
      }
    ]);
  });

  it.each([
    ["txt", "notes.txt", "text/plain", "plain text attachment"],
    ["md", "notes.md", "text/markdown", "# Markdown attachment"],
    ["json", "data.json", "application/json", "{\"ok\":true}"]
  ])("extracts %s attachment text into request context", async (_label, name, mimeType, content) => {
    const attachment = await readAttachment(new File([content], name, { type: mimeType }));
    const messages = buildAiRequestMessages({
      historyMessages: [],
      promptMode: "freeform",
      promptDraft: "Summarize the file.",
      attachments: [attachment]
    });
    const body = buildChatCompletionsRequestBody("gpt-5.1", messages);
    const requestContent = body.messages[0].content;

    expect(attachment.status).toBe("text-extracted");
    expect(requestContent).toContain(content);
    expect(requestContent).toContain("<<<BEGIN_ATTACHMENT_TEXT");
  });

  it("marks long text as truncated and excludes text beyond the request limit", async () => {
    const omittedTail = "TAIL_SHOULD_NOT_BE_SENT";
    const longContent = `${"a".repeat(MAX_ATTACHMENT_PROMPT_CHARACTERS)}${omittedTail}`;
    const attachment = await readAttachment(new File([longContent], "long.txt", { type: "text/plain" }));
    const prompt = buildComposedPrompt({
      promptMode: "freeform",
      promptDraft: "Summarize the file.",
      attachments: [attachment],
      mode: "api"
    });

    expect(attachment.status).toBe("content-truncated");
    expect(attachmentStatusLabel(attachment.status)).toBe("content truncated due to size limit");
    expect(prompt).toContain("Attachment text truncated");
    expect(prompt).not.toContain(omittedTail);
  });

  it("marks PDFs as unreadable instead of pretending content is included", async () => {
    const pdfBytes = "%PDF-1.7 raw pdf body";
    const attachment = await readAttachment(new File([pdfBytes], "report.pdf", { type: "application/pdf" }));
    const prompt = buildComposedPrompt({
      promptMode: "freeform",
      promptDraft: "Summarize this PDF.",
      attachments: [attachment],
      mode: "api"
    });

    expect(attachment.status).toBe("pdf-unreadable");
    expect(attachmentStatusLabel(attachment.status)).toBe("PDF content not readable yet");
    expect(attachment.statusMessage).toContain("PDF text extraction is not implemented");
    expect(prompt).toContain("PDF content is not readable");
    expect(prompt).not.toContain(pdfBytes);
    expect(prompt).not.toContain("<<<BEGIN_ATTACHMENT_TEXT");
  });

  it("keeps unsupported file types visible with a clear status", async () => {
    const result = await createAiChatAttachment(new File(["zip"], "archive.zip", { type: "application/zip" }), nextId);

    expect(result.attachment?.status).toBe("unsupported");
    expect(attachmentStatusLabel(result.attachment?.status ?? "metadata-only")).toBe("unsupported file type");
    expect(result.error).toContain("unsupported file type");
  });

  it("keeps extraction failures visible with a clear status", async () => {
    const file = new File(["secret"], "broken.txt", { type: "text/plain" });

    Object.defineProperty(file, "text", {
      value: () => Promise.reject(new Error("read failed"))
    });

    const result = await createAiChatAttachment(file, nextId);

    expect(result.attachment?.status).toBe("extraction-failed");
    expect(attachmentStatusLabel(result.attachment?.status ?? "metadata-only")).toBe("extraction failed");
    expect(result.error).toContain("could not be read as text");
  });

  it("keeps raw attachment contents out of history-safe prompt text used for persistence", () => {
    const rawText = "VERY_SECRET_EXTRACTED_TEXT";
    const rawImage = "data:image/png;base64,VERY_SECRET_IMAGE_BYTES";
    const attachments: AiChatAttachment[] = [
      {
        id: "text",
        name: "secret.txt",
        extension: "txt",
        mimeType: "text/plain",
        size: rawText.length,
        status: "text-extracted",
        statusMessage: "Text extracted.",
        textContent: rawText
      },
      {
        id: "image",
        name: "secret.png",
        extension: "png",
        mimeType: "image/png",
        size: rawImage.length,
        status: "image-vision",
        statusMessage: "Image attached for vision.",
        imageDataUrl: rawImage
      }
    ];
    const historyPrompt = buildComposedPrompt({
      promptMode: "freeform",
      promptDraft: "Use these attachments.",
      attachments,
      mode: "history"
    });
    const previewPrompt = buildComposedPromptPreview({
      promptMode: "freeform",
      activeModelLabel: "gpt-5.1",
      apiBaseUrl: "/api/ai-chat",
      promptDraft: "Use these attachments.",
      attachments
    });
    const persistedChatHistory = JSON.stringify([{ role: "user", content: historyPrompt }]);

    expect(historyPrompt).not.toContain(rawText);
    expect(historyPrompt).not.toContain(rawImage);
    expect(previewPrompt).not.toContain(rawText);
    expect(previewPrompt).not.toContain(rawImage);
    expect(persistedChatHistory).not.toContain(rawText);
    expect(persistedChatHistory).not.toContain(rawImage);
  });
});
