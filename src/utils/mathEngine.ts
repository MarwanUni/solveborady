import { create, all, Complex, MathJsInstance } from 'mathjs';
import { EvaluatedLineResult, LineKind } from '../types';

export const math: MathJsInstance = create(all, {});

// Add EE helper functions to math instance
math.import(
  {
    phasor: (mag: number, deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return math.complex(mag * Math.cos(rad), mag * Math.sin(rad));
    },
    polar: (mag: number, deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return math.complex(mag * Math.cos(rad), mag * Math.sin(rad));
    },
    par: (a: number | Complex, b: number | Complex) => {
      const num = math.multiply(a, b);
      const den = math.add(a, b);
      return math.divide(num, den);
    },
    rad2deg: (r: number) => (r * 180) / Math.PI,
    deg2rad: (d: number) => (d * Math.PI) / 180,
    mag: (v: number | Complex) => Number(math.abs(v as never)),
    ang: (v: number | Complex) => {
      if (typeof v === 'number') return v >= 0 ? 0 : 180;
      const c = math.complex(v);
      return (Math.atan2(c.im, c.re) * 180) / Math.PI;
    },
  },
  { override: true }
);

const ENG_FACTORS: Record<string, string> = {
  f: 'e-15',
  p: 'e-12',
  n: 'e-9',
  u: 'e-6',
  μ: 'e-6',
  m: 'e-3',
  k: 'e3',
  K: 'e3',
  M: 'e6',
  G: 'e9',
  T: 'e12',
};

const GREEK_IDENTIFIER_MAP: Record<string, string> = {
  ω: 'omega',
  θ: 'theta',
  φ: 'phi',
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  λ: 'lambda',
  σ: 'sigma',
  τ: 'tau',
  ε: 'epsilon',
  μ: 'mu_sym',
  Ω: 'Omega_sym',
};

const GREEK_LATEX_MAP: Record<string, string> = {
  ω: '\\omega',
  θ: '\\theta',
  Ω: '\\Omega',
  μ: '\\mu',
  π: '\\pi',
  φ: '\\phi',
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  λ: '\\lambda',
  σ: '\\sigma',
  τ: '\\tau',
  ε: '\\varepsilon',
  '∞': '\\infty',
};

/**
 * Strips inline // comments and @[MM:SS] timestamp tags from a line
 * before math evaluation or rendering.
 */
export function stripMetadataFromLine(raw: string): string {
  let out = raw.replace(/@\[(?:\d+:)?\d{1,2}:\d{2}\]/g, ' ');
  // Strip trailing // comment (when not part of http:// or https://)
  const commentMatch = out.match(/(^|[^:])\/\/.*$/);
  if (commentMatch && commentMatch.index !== undefined) {
    const cutIndex = commentMatch.index + commentMatch[1].length;
    out = out.slice(0, cutIndex);
  }
  return out.trim();
}

/**
 * Preprocesses EE syntax (engineering notation, j imaginary unit, phasors, parallel operator, Greek symbols)
 * into valid math.js expression syntax.
 */
export function preprocessMathExpression(input: string): string {
  let expr = input.trim();

  // Replace unicode multiplication/minus/division if pasted
  expr = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

  // Replace π with pi
  expr = expr.replace(/π/g, 'pi');

  // Replace Greek variable characters with valid ASCII identifiers for mathjs
  for (const [greek, ascii] of Object.entries(GREEK_IDENTIFIER_MAP)) {
    expr = expr.split(greek).join(ascii);
  }

  // Replace engineering notation numbers: 4.7k, 10u, 2.2m, 100n, 47p, 1.5M, 2.4G, optionally followed by Ω
  expr = expr.replace(
    /(?<![A-Za-z0-9_])(\d+(?:\.\d+)?)\s*(f|p|n|u|μ|m|k|K|M|G|T)Ω?(?![A-Za-z0-9_])/g,
    (_m, num: string, suffix: string) => {
      const exp = ENG_FACTORS[suffix];
      return exp ? `(${num}${exp})` : num;
    }
  );

  // Strip stray Ω unit attached to pure numbers like 100Ω
  expr = expr.replace(/(?<![A-Za-z0-9_])(\d+(?:\.\d+)?)Ω(?![A-Za-z0-9_])/g, '$1');

  // Replace polar phasors: 10∠30°, 10∠-45, 10 @ 30deg, (V1)∠30°
  expr = expr.replace(
    /(\([^()]+\)|[A-Za-z0-9_.]+)\s*(?:∠|@)\s*([+-]?(?:\([^()]+\)|\d+(?:\.\d+)?))\s*(?:°|deg)?/g,
    (_m, mag: string, ang: string) => `phasor(${mag}, ${ang})`
  );

  // Replace parallel operator: A ∥ B -> par(A, B)
  // Handle chained or single binary ∥ between simple terms/parentheses
  let prev = '';
  while (prev !== expr && expr.includes('∥')) {
    prev = expr;
    expr = expr.replace(
      /(\([^()]+\)|[A-Za-z0-9_.]+)\s*∥\s*(\([^()]+\)|[A-Za-z0-9_.]+)/,
      'par($1, $2)'
    );
  }

  // Convert EE imaginary unit `j`:
  // 1) 4j or 3.5j -> (4*i)
  expr = expr.replace(
    /(?<![A-Za-z0-9_])(\d+(?:\.\d+)?)j(?![A-Za-z0-9_])/g,
    '($1*i)'
  );
  // 2) j4 or j3.5 -> (4*i)
  expr = expr.replace(
    /(?<![A-Za-z0-9_])j(\d+(?:\.\d+)?)(?![A-Za-z0-9_])/g,
    '($1*i)'
  );
  // 3) standalone `j` -> `i`
  expr = expr.replace(/(?<![A-Za-z0-9_])j(?![A-Za-z0-9_])/g, 'i');

  return expr;
}

/**
 * Normalizes a variable identifier (e.g., ω -> omega) so scope lookups match preprocessed expressions.
 */
export function normalizeIdentifier(name: string): string {
  let out = name.trim();
  for (const [greek, ascii] of Object.entries(GREEK_IDENTIFIER_MAP)) {
    out = out.split(greek).join(ascii);
  }
  return out;
}

const VALID_IDENTIFIER_REGEX = /^[A-Za-zωθφαβγδλστμεΩ_][A-Za-z0-9ωθφαβγδλστμεΩ_]*$/;

export function isValidIdentifier(name: string): boolean {
  return VALID_IDENTIFIER_REGEX.test(name.trim());
}

/**
 * Heuristic to detect whether a non-empty line is plain prose text vs math.
 */
export function classifyLine(
  raw: string,
  scope: Record<string, unknown>
): { kind: LineKind; clean: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'blank', clean: '' };
  if (trimmed.startsWith('#')) return { kind: 'heading', clean: trimmed.replace(/^#+\s*/, '') };

  const clean = stripMetadataFromLine(raw);
  if (!clean) return { kind: 'text', clean: '' };

  if (clean.startsWith('//') || clean.startsWith('"')) {
    return { kind: 'text', clean };
  }

  // Check if it contains `=` (assignment or equation)
  const eqParts = clean.split('=');
  if (eqParts.length === 2) {
    const lhs = eqParts[0].trim();
    const rhs = eqParts[1].trim();
    if (lhs && rhs) {
      if (isValidIdentifier(lhs)) {
        return { kind: 'assignment', clean };
      }
      return { kind: 'equation', clean };
    }
  } else if (eqParts.length > 2) {
    return { kind: 'text', clean };
  }

  // No '=': decide if expression or plain text
  const hasMathOperators = /[+\-*/^∠∥()]/.test(clean);
  const hasNumber = /\d/.test(clean);
  const isKnownVar = isValidIdentifier(clean) && normalizeIdentifier(clean) in scope;
  const isEngLiteral = /^\d+(?:\.\d+)?[fpnuμmkKMGT]Ω?$/.test(clean);

  // Prose heuristic: multiple space-separated words with no math operators and not a single function call
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && !hasMathOperators && !isEngLiteral) {
    return { kind: 'text', clean };
  }

  if (hasMathOperators || hasNumber || isKnownVar || isEngLiteral) {
    return { kind: 'expression', clean };
  }

  return { kind: 'text', clean };
}

export function formatEngineeringNumber(val: number): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return '0';
  const abs = Math.abs(val);

  if (abs >= 1 && abs < 1e3) {
    return Number(val.toPrecision(6)).toString();
  }

  const prefixes: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'μ'],
    [1e-9, 'n'],
    [1e-12, 'p'],
    [1e-15, 'f'],
  ];

  for (const [scale, prefix] of prefixes) {
    if (abs >= scale) {
      const scaled = val / scale;
      return `${Number(scaled.toPrecision(5))}${prefix ? ' ' + prefix : ''}`;
    }
  }

  return val.toExponential(4);
}

export function formatMathResult(value: unknown): {
  display: string;
  secondary?: string;
  isComplex: boolean;
} {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { display: String(value), isComplex: false };
    }
    const plain = Number(value.toPrecision(6)).toString();
    const eng = formatEngineeringNumber(value);
    const secondary = eng !== plain ? eng : undefined;
    return { display: plain, secondary, isComplex: false };
  }

  if (typeof value === 'boolean') {
    return { display: String(value), isComplex: false };
  }

  if (value && typeof value === 'object' && 're' in value && 'im' in value) {
    const c = value as { re: number; im: number };
    const re = Math.abs(c.re) < 1e-12 ? 0 : c.re;
    const im = Math.abs(c.im) < 1e-12 ? 0 : c.im;

    if (im === 0) {
      return formatMathResult(re);
    }

    const reStr = Number(re.toPrecision(5)).toString();
    const imAbsStr = Number(Math.abs(im).toPrecision(5)).toString();
    const sign = im >= 0 ? '+' : '-';
    const rect =
      re === 0
        ? `${im < 0 ? '-' : ''}${imAbsStr}j`
        : `${reStr} ${sign} ${imAbsStr}j`;

    const mag = Math.hypot(re, im);
    const angleDeg = (Math.atan2(im, re) * 180) / Math.PI;
    const polar = `${Number(mag.toPrecision(5))} ∠ ${Number(angleDeg.toPrecision(4))}°`;

    return { display: rect, secondary: polar, isComplex: true };
  }

  if (value && typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
    return { display: String(value), isComplex: false };
  }

  return { display: String(value ?? ''), isComplex: false };
}

/**
 * Evaluates all notebook lines top-to-bottom like Soulver, accumulating variables.
 */
export function evaluateNotebookLines(
  lines: Array<{ id: string; text: string }>
): { results: EvaluatedLineResult[]; scopeSnapshots: Array<Record<string, unknown>> } {
  const scope: Record<string, unknown> = {
    j: math.complex(0, 1),
  };
  const results: EvaluatedLineResult[] = [];
  const scopeSnapshots: Array<Record<string, unknown>> = [];

  for (const line of lines) {
    // Capture scope before this line
    scopeSnapshots.push({ ...scope });

    const { kind, clean } = classifyLine(line.text, scope);
    if (kind === 'blank' || kind === 'heading' || kind === 'text') {
      results.push({
        lineId: line.id,
        kind,
        displayValue: '',
        latex: kind === 'heading' ? '' : '',
      });
      continue;
    }

    const latex = expressionToLatex(clean);

    if (kind === 'equation') {
      results.push({
        lineId: line.id,
        kind: 'equation',
        displayValue: 'Equation',
        secondaryValue: 'Ctrl+Enter to solve',
        latex,
      });
      continue;
    }

    if (kind === 'assignment') {
      const [lhsRaw, rhsRaw] = clean.split('=');
      const varName = lhsRaw.trim();
      const normVar = normalizeIdentifier(varName);
      const preprocessedRhs = preprocessMathExpression(rhsRaw);

      try {
        const val = math.evaluate(preprocessedRhs, { ...scope });
        if (typeof val === 'function') {
          results.push({
            lineId: line.id,
            kind: 'text',
            displayValue: '',
            latex: '',
          });
          continue;
        }
        scope[normVar] = val;
        const formatted = formatMathResult(val);
        results.push({
          lineId: line.id,
          kind: 'assignment',
          displayValue: formatted.display,
          secondaryValue: formatted.secondary,
          isComplex: formatted.isComplex,
          latex,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Syntax error';
        // If RHS contains undefined variable(s), it could be part of an equation system
        const isUndefinedSym = /Undefined symbol/i.test(msg);
        results.push({
          lineId: line.id,
          kind: isUndefinedSym ? 'equation' : 'assignment',
          displayValue: isUndefinedSym ? 'Equation / Symbolic' : 'Error',
          secondaryValue: isUndefinedSym ? msg : undefined,
          latex,
          isError: !isUndefinedSym,
          errorMessage: msg,
        });
      }
      continue;
    }

    // kind === 'expression'
    try {
      const preprocessed = preprocessMathExpression(clean);
      const val = math.evaluate(preprocessed, { ...scope });
      if (typeof val === 'function') {
        results.push({
          lineId: line.id,
          kind: 'text',
          displayValue: '',
          latex: '',
        });
        continue;
      }
      const formatted = formatMathResult(val);
      results.push({
        lineId: line.id,
        kind: 'expression',
        displayValue: formatted.display,
        secondaryValue: formatted.secondary,
        isComplex: formatted.isComplex,
        latex,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Evaluation error';
      results.push({
        lineId: line.id,
        kind: 'expression',
        displayValue: 'Error',
        latex,
        isError: true,
        errorMessage: msg,
      });
    }
  }

  return { results, scopeSnapshots };
}

/**
 * Converts plain EE math syntax into clean KaTeX LaTeX.
 * Example: V1/R1 + (V1-V2)/R2 = 0 -> \frac{V_1}{R_1} + \frac{V_1 - V_2}{R_2} = 0
 */
export function expressionToLatex(input: string): string {
  const clean = stripMetadataFromLine(input);
  if (!clean) return '';

  // Handle equations by formatting LHS and RHS separately
  const eqIndex = clean.indexOf('=');
  if (eqIndex !== -1) {
    const lhs = clean.slice(0, eqIndex).trim();
    const rhs = clean.slice(eqIndex + 1).trim();
    return `${formatExprLatex(lhs)} = ${formatExprLatex(rhs)}`;
  }

  return formatExprLatex(clean);
}

function formatExprLatex(expr: string): string {
  if (!expr.trim()) return '';
  let s = expr.trim();

  // Replace sqrt(...) recursively using balanced parens
  s = replaceFunctionLatex(s, 'sqrt', (arg) => `\\sqrt{${formatExprLatex(arg)}}`);
  s = replaceFunctionLatex(s, 'abs', (arg) => `\\left|${formatExprLatex(arg)}\\right|`);

  // Convert simple fractions A/B before general token replacement
  s = convertFractionsToLatex(s);

  // Convert exponents x^(a+b) or x^2
  s = replaceExponentsLatex(s);

  // Replace Greek unicode symbols with LaTeX commands
  for (const [sym, cmd] of Object.entries(GREEK_LATEX_MAP)) {
    s = s.split(sym).join(`${cmd} `);
  }

  // Replace phasor angle and degree and parallel
  s = s.replace(/∠/g, ' \\angle ');
  s = s.replace(/°/g, '^\\circ');
  s = s.replace(/∥/g, ' \\parallel ');

  // Format subscripts on identifiers: V_th -> V_{\text{th}}, V1 -> V_1
  s = s.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+)\b/g, (_m, base: string, sub: string) => {
    const subFmt = sub.length > 1 && /^[A-Za-z]+$/.test(sub) ? `\\text{${sub}}` : sub;
    return `${base}_{${subFmt}}`;
  });

  // Format alphanumeric EE identifiers like V1, R12, I2 (but avoid LaTeX commands starting with \)
  s = s.replace(/(^|[^\\A-Za-z0-9_])([A-Za-z])(\d+)\b/g, (_m, pre: string, letter: string, digits: string) => {
    const sub = digits.length > 1 ? `{${digits}}` : digits;
    return `${pre}${letter}_${sub}`;
  });

  // Format * nicely: between numbers keep \cdot, between coefficient & letter omit or thin space
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');

  // Collapse excess whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function findMatchingParen(str: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceFunctionLatex(
  input: string,
  fnName: string,
  formatter: (inner: string) => string
): string {
  let s = input;
  const regex = new RegExp(`\\b${fnName}\\(`, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(s)) !== null) {
    const start = match.index;
    const openIdx = start + fnName.length;
    const closeIdx = findMatchingParen(s, openIdx);
    if (closeIdx === -1) break;
    const inner = s.slice(openIdx + 1, closeIdx);
    const replacement = formatter(inner);
    s = s.slice(0, start) + replacement + s.slice(closeIdx + 1);
    regex.lastIndex = start + replacement.length;
  }
  return s;
}

function replaceExponentsLatex(input: string): string {
  let s = input;
  let idx = 0;
  while (idx < s.length) {
    const caret = s.indexOf('^', idx);
    if (caret === -1) break;
    const next = s[caret + 1];
    if (next === '(') {
      const closeIdx = findMatchingParen(s, caret + 1);
      if (closeIdx !== -1) {
        const inner = s.slice(caret + 2, closeIdx);
        const rep = `^{${inner}}`;
        s = s.slice(0, caret) + rep + s.slice(closeIdx + 1);
        idx = caret + rep.length;
        continue;
      }
    } else if (next && /[A-Za-z0-9-]/.test(next)) {
      const match = s.slice(caret + 1).match(/^-?[A-Za-z0-9.]+/);
      if (match) {
        const rep = `^{${match[0]}}`;
        s = s.slice(0, caret) + rep + s.slice(caret + 1 + match[0].length);
        idx = caret + rep.length;
        continue;
      }
    }
    idx = caret + 1;
  }
  return s;
}

function extractLeftOperand(str: string, slashIdx: number): { start: number; text: string } | null {
  let i = slashIdx - 1;
  while (i >= 0 && str[i] === ' ') i--;
  if (i < 0) return null;

  if (str[i] === ')') {
    let depth = 0;
    const end = i;
    while (i >= 0) {
      if (str[i] === ')') depth++;
      else if (str[i] === '(') {
        depth--;
        if (depth === 0) {
          // Include leading function name if any (e.g. sqrt(...))
          let fnStart = i;
          while (fnStart > 0 && /[A-Za-z0-9_\\]/.test(str[fnStart - 1])) fnStart--;
          const raw = str.slice(fnStart, end + 1);
          const inner = fnStart === i ? str.slice(i + 1, end) : raw;
          return { start: fnStart, text: inner };
        }
      }
      i--;
    }
    return null;
  }

  const end = i;
  while (i >= 0 && /[A-Za-z0-9_.ωθφαβγδλστμεΩμ^]/.test(str[i])) i--;
  const start = i + 1;
  if (start > end) return null;
  return { start, text: str.slice(start, end + 1) };
}

function extractRightOperand(str: string, slashIdx: number): { end: number; text: string } | null {
  let i = slashIdx + 1;
  while (i < str.length && str[i] === ' ') i++;
  if (i >= str.length) return null;

  if (str[i] === '(') {
    const closeIdx = findMatchingParen(str, i);
    if (closeIdx === -1) return null;
    return { end: closeIdx + 1, text: str.slice(i + 1, closeIdx) };
  }

  const start = i;
  while (i < str.length && /[A-Za-z0-9_.ωθφαβγδλστμεΩμ^]/.test(str[i])) i++;
  if (i === start) return null;
  return { end: i, text: str.slice(start, i) };
}

function convertFractionsToLatex(input: string): string {
  let s = input;
  let searchFrom = 0;
  let guard = 0;

  while (guard++ < 30) {
    const slashIdx = s.indexOf('/', searchFrom);
    if (slashIdx === -1) break;

    const left = extractLeftOperand(s, slashIdx);
    const right = extractRightOperand(s, slashIdx);

    if (!left || !right) {
      searchFrom = slashIdx + 1;
      continue;
    }

    const rep = `\\frac{${left.text}}{${right.text}}`;
    s = s.slice(0, left.start) + rep + s.slice(right.end);
    searchFrom = left.start + rep.length;
  }

  return s;
}
