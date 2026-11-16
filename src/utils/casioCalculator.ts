import { ReadableEquation } from '../types';
import {
  formatEngineeringNumber,
  isValidIdentifier,
  math,
  normalizeIdentifier,
  preprocessMathExpression,
} from './mathEngine';

const BUILTIN_CONSTANTS = new Set([
  'pi',
  'e',
  'i',
  'j',
  'true',
  'false',
  'Infinity',
  'NaN',
  'inf',
]);

const REVERSE_GREEK_MAP: Record<string, string> = {
  omega: 'ω',
  theta: 'θ',
  phi: 'φ',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  lambda: 'λ',
  sigma: 'σ',
  tau: 'τ',
  epsilon: 'ε',
  mu_sym: 'μ',
  Omega_sym: 'Ω',
};

export interface CasioCalcResult {
  status: 'empty' | 'needs_vars' | 'evaluated' | 'solved' | 'checked' | 'error';
  targetVar?: string;
  value?: string;
  detail?: string;
  variables: string[];
  missingVars: string[];
  errorMessage?: string;
}

function collectSymbolsFromExpr(rawExpr: string): string[] {
  const pre = preprocessMathExpression(rawExpr);
  if (!pre) return [];
  const found: string[] = [];
  const seen = new Set<string>();

  try {
    const node = math.parse(pre);
    node.traverse((child: unknown, _path: string, parent: unknown) => {
      const c = child as { isSymbolNode?: boolean; name?: string };
      const p = parent as { isFunctionNode?: boolean; fn?: unknown } | undefined;
      if (c && c.isSymbolNode && typeof c.name === 'string') {
        // Ignore the function name itself when calling f(...)
        if (p && p.isFunctionNode && p.fn === child) return;
        if (BUILTIN_CONSTANTS.has(c.name)) return;
        const displayName = REVERSE_GREEK_MAP[c.name] ?? c.name;
        if (!seen.has(displayName)) {
          seen.add(displayName);
          found.push(displayName);
        }
      }
    });
  } catch {
    return [];
  }

  return found;
}

export function extractCalculatorVariables(plain: string): {
  mode: 'expression' | 'assignment' | 'equation';
  targetVar?: string;
  variables: string[];
  lhs: string;
  rhs: string;
} {
  const clean = plain.trim();
  if (!clean) {
    return { mode: 'expression', variables: [], lhs: '', rhs: '' };
  }

  const eqParts = clean.split('=');
  if (eqParts.length === 2) {
    const lhs = eqParts[0].trim();
    const rhs = eqParts[1].trim();
    if (lhs && rhs) {
      if (isValidIdentifier(lhs)) {
        const rhsVars = collectSymbolsFromExpr(rhs);
        const normTarget = normalizeIdentifier(lhs);
        const selfReferential = rhsVars.some(
          (v) => normalizeIdentifier(v) === normTarget
        );
        if (!selfReferential) {
          return {
            mode: 'assignment',
            targetVar: lhs,
            variables: rhsVars,
            lhs,
            rhs,
          };
        }
      }
      const allVars = Array.from(
        new Set([...collectSymbolsFromExpr(lhs), ...collectSymbolsFromExpr(rhs)])
      );
      return { mode: 'equation', variables: allVars, lhs, rhs };
    }
  }

  return {
    mode: 'expression',
    variables: collectSymbolsFromExpr(clean),
    lhs: clean,
    rhs: '',
  };
}

function formatComputedValue(val: unknown): string {
  if (typeof val === 'number') {
    return formatEngineeringNumber(val);
  }
  if (val && typeof val === 'object' && 're' in val && 'im' in val) {
    const c = val as { re: number; im: number };
    if (Math.abs(c.im) < 1e-12) return formatEngineeringNumber(c.re);
    const reStr = formatEngineeringNumber(c.re);
    const imStr = formatEngineeringNumber(Math.abs(c.im));
    return `${reStr} ${c.im >= 0 ? '+' : '-'} ${imStr}j`;
  }
  return String(val);
}

function buildScopeFromSheet(
  sheetEquations: ReadableEquation[]
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const eq of sheetEquations) {
    const parts = eq.plain.split('=');
    if (parts.length !== 2) continue;
    const lhs = parts[0].trim();
    const rhs = parts[1].trim();
    if (!lhs || !rhs || !isValidIdentifier(lhs)) continue;
    try {
      const pre = preprocessMathExpression(rhs);
      const val = math.evaluate(pre, { ...scope });
      if (typeof val === 'number' && Number.isFinite(val)) {
        scope[normalizeIdentifier(lhs)] = val;
      }
    } catch {
      // ignore non-numeric formulas in sheet
    }
  }
  return scope;
}

export function evaluateCasioCalculation(
  plain: string,
  varValues: Record<string, string>,
  sheetEquations: ReadableEquation[] = []
): CasioCalcResult {
  const parsed = extractCalculatorVariables(plain);
  if (!plain.trim()) {
    return { status: 'empty', variables: [], missingVars: [] };
  }

  const scope = buildScopeFromSheet(sheetEquations);
  const missingVars: string[] = [];

  for (const v of parsed.variables) {
    const norm = normalizeIdentifier(v);
    const overrideRaw = varValues[v]?.trim();
    if (overrideRaw) {
      try {
        const val = math.evaluate(preprocessMathExpression(overrideRaw), {
          ...scope,
        });
        if (typeof val === 'number' && !Number.isFinite(val)) {
          return {
            status: 'error',
            variables: parsed.variables,
            missingVars: [],
            errorMessage: `Invalid value for ${v}`,
          };
        }
        scope[norm] = val;
      } catch {
        return {
          status: 'error',
          variables: parsed.variables,
          missingVars: [],
          errorMessage: `Check value for ${v}`,
        };
      }
    } else if (!(norm in scope)) {
      missingVars.push(v);
    }
  }

  if (parsed.mode === 'expression') {
    if (missingVars.length > 0) {
      return {
        status: 'needs_vars',
        variables: parsed.variables,
        missingVars,
      };
    }
    try {
      const val = math.evaluate(preprocessMathExpression(parsed.lhs), scope);
      return {
        status: 'evaluated',
        value: formatComputedValue(val),
        variables: parsed.variables,
        missingVars: [],
      };
    } catch {
      return {
        status: 'error',
        variables: parsed.variables,
        missingVars: [],
        errorMessage: 'Incomplete expression',
      };
    }
  }

  if (parsed.mode === 'assignment') {
    if (missingVars.length > 0) {
      return {
        status: 'needs_vars',
        targetVar: parsed.targetVar,
        variables: parsed.variables,
        missingVars,
      };
    }
    try {
      const val = math.evaluate(preprocessMathExpression(parsed.rhs), scope);
      return {
        status: 'evaluated',
        targetVar: parsed.targetVar,
        value: formatComputedValue(val),
        variables: parsed.variables,
        missingVars: [],
      };
    } catch {
      return {
        status: 'error',
        targetVar: parsed.targetVar,
        variables: parsed.variables,
        missingVars: [],
        errorMessage: 'Could not evaluate formula',
      };
    }
  }

  // General equation: LHS = RHS
  if (missingVars.length === 1) {
    const unknown = missingVars[0];
    const normUnknown = normalizeIdentifier(unknown);
    try {
      const lhsPre = preprocessMathExpression(parsed.lhs);
      const rhsPre = preprocessMathExpression(parsed.rhs);
      const evalDiff = (x: number) => {
        const s = { ...scope, [normUnknown]: x };
        const l = Number(math.evaluate(lhsPre, s));
        const r = Number(math.evaluate(rhsPre, s));
        return l - r;
      };
      const f0 = evalDiff(0);
      const f1 = evalDiff(1);
      const f2 = evalDiff(2);
      const d1 = f1 - f0;
      const d2 = f2 - f1;
      if (
        Number.isFinite(f0) &&
        Number.isFinite(f1) &&
        Math.abs(d1) > 1e-15 &&
        Math.abs(d2 - d1) <= 1e-6 * Math.max(1, Math.abs(d1))
      ) {
        const solution = -f0 / d1;
        return {
          status: 'solved',
          targetVar: unknown,
          value: formatComputedValue(solution),
          variables: parsed.variables,
          missingVars,
        };
      }
    } catch {
      // fall through to needs_vars
    }
    return {
      status: 'needs_vars',
      variables: parsed.variables,
      missingVars,
    };
  }

  if (missingVars.length > 1) {
    return {
      status: 'needs_vars',
      variables: parsed.variables,
      missingVars,
    };
  }

  // All variables provided -> check LHS vs RHS
  try {
    const l = Number(math.evaluate(preprocessMathExpression(parsed.lhs), scope));
    const r = Number(math.evaluate(preprocessMathExpression(parsed.rhs), scope));
    const diff = l - r;
    return {
      status: 'checked',
      targetVar: 'LHS − RHS',
      value: Math.abs(diff) < 1e-9 ? '0 (Balanced)' : formatComputedValue(diff),
      detail: `${formatComputedValue(l)} = ${formatComputedValue(r)}`,
      variables: parsed.variables,
      missingVars: [],
    };
  } catch {
    return {
      status: 'error',
      variables: parsed.variables,
      missingVars: [],
      errorMessage: 'Could not evaluate equation',
    };
  }
}
