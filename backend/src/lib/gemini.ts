import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";

const genai = new GoogleGenAI({ apiKey: env.geminiApiKey });

const OCR_PROMPT = `You are an OCR/transcription engine for lecture-slide PDFs.

Transcribe every slide's text content in order, verbatim where possible (headings, bullet points, labels, captions, formulae). For formulae, transcribe using LaTeX wrapped in $...$ (inline) or $$...$$ (block).

Before each slide's content, emit a marker line on its own: "=== Slide N ===" (N = 1-indexed slide/page number). Do not add commentary, summaries, or content that isn't on the slides. Skip purely decorative elements (logos, page borders) but keep any text they contain.`;

/**
 * Extracts slide-by-slide text from a PDF using Gemini 2.5 Flash Lite —
 * cheap/high-free-tier OCR, kept separate from the Claude call that drafts
 * cards so the expensive grounded-generation step runs on plain text instead
 * of raw PDF bytes.
 */
export async function extractPdfText(params: { pdfBase64: string; filename: string }): Promise<string> {
  const response = await genai.models.generateContent({
    model: env.geminiModelOcr,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: params.pdfBase64 } },
          { text: `${OCR_PROMPT}\n\nFile: ${params.filename}` },
        ],
      },
    ],
  });

  const text = response.text;
  if (!text?.trim()) {
    throw new Error("Gemini OCR returned no text for this PDF.");
  }
  return text;
}
