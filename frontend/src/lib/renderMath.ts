import katex from "katex";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renders a string that may contain $...$ (inline) and $$...$$ (block) LaTeX
 * into safe HTML, escaping everything else. Used for card fronts/backs, which
 * the generation prompt (backend/src/lib/claude.ts) instructs Claude to
 * produce in this format.
 */
export function renderMath(input: string): string {
  const blockSplit = input.split(/\$\$([^$]+)\$\$/g);
  return blockSplit
    .map((chunk, i) => {
      if (i % 2 === 1) {
        return safeKatex(chunk, true);
      }
      return renderInline(chunk);
    })
    .join("");
}

function renderInline(text: string): string {
  const parts = text.split(/\$([^$]+)\$/g);
  return parts
    .map((chunk, i) => (i % 2 === 1 ? safeKatex(chunk, false) : escapeHtml(chunk).replace(/\n/g, "<br>")))
    .join("");
}

function safeKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(latex);
  }
}
