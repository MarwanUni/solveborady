import katex from 'katex';
import { CopyFormat, ReadableEquation } from '../types';

const IGNORED_KEYWORDS = new Set([
  'sqrt',
  'frac',
  'sin',
  'cos',
  'tan',
  'log',
  'ln',
  'exp',
  'abs',
  'begin',
  'end',
  'aligned',
  'text',
  'mathrm',
  'left',
  'right',
]);

/**
 * Extracts recurring variable / symbol names from existing equations
 * so handwriting recognition stays consistent with prior notation (e.g. V_1 vs V_i).
 */
export function extractContextSymbols(equations: ReadableEquation[]): string[] {
  const counts = new Map<string, number>();

  for (const eq of equations) {
    const plainMatches =
      eq.plain.match(/\b[A-Za-zωθφαβγδλστμεΩ][A-Za-z0-9_]*\b/g) ?? [];
    for (const token of plainMatches) {
      if (token.length <= 8 && !IGNORED_KEYWORDS.has(token.toLowerCase())) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    const latexSubMatches =
      eq.latex.match(/[A-Za-z]+_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9])/g) ?? [];
    for (const token of latexSubMatches) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([sym]) => sym);
}

/**
 * Formats a LaTeX equation string for pasting into Overleaf (latex),
 * Notion/Obsidian (markdown), or Microsoft Word (mathml).
 */
export function formatEquationForCopy(latex: string, format: CopyFormat): string {
  const clean = latex.trim();
  if (!clean) return '';

  if (format === 'latex') {
    return clean;
  }

  if (format === 'markdown') {
    return `$$\n${clean}\n$$`;
  }

  // format === 'mathml' -> KaTeX native MathML output works directly in Microsoft Word
  try {
    const html = katex.renderToString(clean, {
      displayMode: true,
      output: 'mathml',
      throwOnError: false,
      strict: false,
    });
    const match = html.match(/<math[\s\S]*<\/math>/);
    return match ? match[0] : html;
  } catch {
    return clean;
  }
}

export function formatAllEquationsForCopy(
  equations: ReadableEquation[],
  format: CopyFormat
): string {
  return equations
    .map((eq) => formatEquationForCopy(eq.latex, format))
    .filter(Boolean)
    .join('\n\n');
}

export interface DownloadPayload {
  filename: string;
  mimeType: string;
  content: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds a self-contained local file payload (.tex, .md, or offline .html with MathML)
 * matching the active CopyFormat.
 */
export function buildDownloadPayload(
  equations: ReadableEquation[],
  format: CopyFormat
): DownloadPayload {
  if (format === 'latex') {
    const body = equations
      .map((eq) => {
        const heading = eq.title ? `% ${eq.title}\n` : '';
        return `${heading}\\[ ${eq.latex.trim()} \\]`;
      })
      .join('\n\n');

    return {
      filename: 'lecture-equations.tex',
      mimeType: 'text/plain;charset=utf-8',
      content: [
        '\\documentclass{article}',
        '\\usepackage{amsmath,amssymb}',
        '\\begin{document}',
        '',
        body,
        '',
        '\\end{document}',
        '',
      ].join('\n'),
    };
  }

  if (format === 'markdown') {
    const body = equations
      .map((eq, idx) => {
        const heading = eq.title ? `## ${eq.title}` : `## Equation ${idx + 1}`;
        return `${heading}\n\n$$\n${eq.latex.trim()}\n$$\n\n\`${eq.plain}\``;
      })
      .join('\n\n---\n\n');

    return {
      filename: 'lecture-equations.md',
      mimeType: 'text/markdown;charset=utf-8',
      content: `# Lecture Scratchpad Equations\n\n${body}\n`,
    };
  }

  // Self-contained offline HTML + MathML (opens in any browser or Microsoft Word)
  const itemsHtml = equations
    .map((eq, idx) => {
      const title = escapeHtml(eq.title || `Equation ${idx + 1}`);
      const mathml = formatEquationForCopy(eq.latex, 'mathml');
      const plain = escapeHtml(eq.plain);
      return `<article class="eq-card">
  <h2>${title}</h2>
  <div class="math">${mathml}</div>
  <pre class="plain">${plain}</pre>
</article>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lecture Scratchpad Equations</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 22px; margin-bottom: 20px; }
    .eq-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin-bottom: 14px; }
    .eq-card h2 { font-size: 13px; color: #475569; margin: 0 0 10px 0; font-weight: 600; }
    .math { font-size: 20px; overflow-x: auto; padding: 6px 0; }
    .plain { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; color: #64748b; margin: 8px 0 0 0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Lecture Scratchpad Equations</h1>
  ${itemsHtml}
</body>
</html>
`;

  return {
    filename: 'lecture-equations.html',
    mimeType: 'text/html;charset=utf-8',
    content: html,
  };
}
