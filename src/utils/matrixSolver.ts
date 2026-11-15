import {
  formatEngineeringNumber,
  isValidIdentifier,
  math,
  normalizeIdentifier,
  preprocessMathExpression,
} from './mathEngine';

export type MatrixSolutionStatus =
  | 'empty'
  | 'unique'
  | 'infinite'
  | 'none'
  | 'error';

export interface MatrixSampleSolution {
  label: string;
  values: Record<string, number>;
}

export interface MatrixSystemResult {
  status: MatrixSolutionStatus;
  equationsUsed: string[];
  substitutedConstants: Array<{ name: string; value: number }>;
  variables: string[];
  A: number[][];
  b: number[];
  rref: number[][];
  rankA: number;
  rankAug: number;
  pivotCols: number[];
  freeCols: number[];
  uniqueSolution?: Record<string, number>;
  particular?: number[];
  nullBasis?: number[][];
  sampleSolutions?: MatrixSampleSolution[];
  latexMatrixEq?: string;
  latexRref?: string;
  latexSolution?: string;
  errorMessage?: string;
}

const EPS = 1e-9;

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

const REVERSE_GREEK: Record<string, string> = {
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

function cleanZero(val: number): number {
  return Math.abs(val) < 1e-10 ? 0 : val;
}

export function formatMatrixNumberPlain(val: number): string {
  const c = cleanZero(val);
  if (c === 0) return '0';
  if (Math.abs(c - Math.round(c)) < 1e-9) return String(Math.round(c));
  const abs = Math.abs(c);
  if (abs >= 1e4 || abs < 1e-3) {
    return formatEngineeringNumber(c);
  }
  return Number(c.toPrecision(5)).toString();
}

export function formatMatrixNumberLatex(val: number): string {
  const c = cleanZero(val);
  if (c === 0) return '0';
  if (Math.abs(c - Math.round(c)) < 1e-9) return String(Math.round(c));

  // Try exact clean small fraction p/q for textbook matrix readability
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  for (let q = 2; q <= 24; q++) {
    const p = Math.round(abs * q);
    if (Math.abs(abs - p / q) < 1e-8) {
      return `${sign}\\frac{${p}}{${q}}`;
    }
  }
  return Number(c.toPrecision(4)).toString();
}

function formatVarLatex(name: string): string {
  const greekMap: Record<string, string> = {
    ω: '\\omega',
    θ: '\\theta',
    φ: '\\phi',
    α: '\\alpha',
    β: '\\beta',
    γ: '\\gamma',
    δ: '\\delta',
    λ: '\\lambda',
    σ: '\\sigma',
    τ: '\\tau',
    ε: '\\varepsilon',
    μ: '\\mu',
    Ω: '\\Omega',
  };
  if (name in greekMap) return greekMap[name];
  const m = name.match(/^([A-Za-z]+)_?(\d+|[A-Za-z]+)$/);
  if (m && name.includes('_')) {
    return `${m[1]}_{${m[2]}}`;
  }
  const alnum = name.match(/^([A-Za-z])(\d+)$/);
  if (alnum) {
    return `${alnum[1]}_{${alnum[2]}}`;
  }
  return name;
}

function collectExpressionSymbols(rawExpr: string): string[] {
  const pre = preprocessMathExpression(rawExpr);
  if (!pre) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const node = math.parse(pre);
  node.traverse((child: unknown, _path: string, parent: unknown) => {
    const c = child as { isSymbolNode?: boolean; name?: string };
    const p = parent as { isFunctionNode?: boolean; fn?: unknown } | undefined;
    if (c && c.isSymbolNode && typeof c.name === 'string') {
      if (p && p.isFunctionNode && p.fn === child) return;
      if (BUILTIN_CONSTANTS.has(c.name)) return;
      const disp = REVERSE_GREEK[c.name] ?? c.name;
      if (!seen.has(disp)) {
        seen.add(disp);
        out.push(disp);
      }
    }
  });
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function substituteConstantInEquation(
  eq: string,
  name: string,
  value: number
): string {
  const regex = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(name)}(?![A-Za-z0-9_])`, 'g');
  return eq.replace(regex, `(${value})`);
}

function isUsedNonlinearlyInOthers(name: string, equations: string[]): boolean {
  const escaped = escapeRegExp(name);
  const divByRegex = new RegExp(`/\\s*\\(?\\s*${escaped}\\b`);
  for (const eq of equations) {
    if (divByRegex.test(eq)) return true;
  }
  return false;
}

function rrefAugmented(matrix: number[][]): {
  rref: number[][];
  pivotCols: number[];
  rankA: number;
  rankAug: number;
} {
  const m = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const n = Math.max(0, cols - 1);
  const rref = matrix.map((row) => row.map((v) => v));

  let maxNorm = 1;
  for (const row of rref) {
    for (const v of row) {
      if (Math.abs(v) > maxNorm) maxNorm = Math.abs(v);
    }
  }
  const tol = EPS * maxNorm;

  const pivotCols: number[] = [];
  let r = 0;

  for (let c = 0; c < n && r < m; c++) {
    let pivotRow = r;
    let best = Math.abs(rref[r][c]);
    for (let i = r + 1; i < m; i++) {
      const val = Math.abs(rref[i][c]);
      if (val > best) {
        best = val;
        pivotRow = i;
      }
    }

    if (best <= tol) {
      rref[r][c] = 0;
      continue;
    }

    if (pivotRow !== r) {
      const tmp = rref[r];
      rref[r] = rref[pivotRow];
      rref[pivotRow] = tmp;
    }

    const pivotVal = rref[r][c];
    for (let j = c; j < cols; j++) {
      rref[r][j] = cleanZero(rref[r][j] / pivotVal);
    }

    for (let i = 0; i < m; i++) {
      if (i === r) continue;
      const factor = rref[i][c];
      if (Math.abs(factor) <= tol) {
        rref[i][c] = 0;
        continue;
      }
      for (let j = c; j < cols; j++) {
        rref[i][j] = cleanZero(rref[i][j] - factor * rref[r][j]);
      }
    }

    pivotCols.push(c);
    r++;
  }

  let rankA = pivotCols.length;
  let rankAug = rankA;
  for (let i = rankA; i < m; i++) {
    const rhsVal = Math.abs(rref[i][n]);
    if (rhsVal > tol) {
      rankAug++;
    } else {
      rref[i][n] = 0;
    }
  }

  // Clean tiny residuals
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < cols; j++) {
      if (Math.abs(rref[i][j]) <= tol) rref[i][j] = 0;
    }
  }

  return { rref, pivotCols, rankA, rankAug };
}

function buildBmatrixLatex(rows: string[][]): string {
  const body = rows.map((r) => r.join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
}

function buildAugmentedLatex(mat: number[][]): string {
  if (mat.length === 0) return '';
  const cols = mat[0].length;
  const colSpec = 'r'.repeat(Math.max(1, cols - 1)) + '|r';
  const body = mat
    .map((row) => row.map((v) => formatMatrixNumberLatex(v)).join(' & '))
    .join(' \\\\ ');
  return `\\left[\\begin{array}{${colSpec}} ${body} \\end{array}\\right]`;
}

export function solveLinearSystem(rawEquations: string[]): MatrixSystemResult {
  const cleanedLines = rawEquations
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (cleanedLines.length === 0) {
    return {
      status: 'empty',
      equationsUsed: [],
      substitutedConstants: [],
      variables: [],
      A: [],
      b: [],
      rref: [],
      rankA: 0,
      rankAug: 0,
      pivotCols: [],
      freeCols: [],
    };
  }

  // Validate each line contains exactly one '='
  for (const line of cleanedLines) {
    const parts = line.split('=');
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      return {
        status: 'error',
        equationsUsed: cleanedLines,
        substitutedConstants: [],
        variables: [],
        A: [],
        b: [],
        rref: [],
        rankA: 0,
        rankAug: 0,
        pivotCols: [],
        freeCols: [],
        errorMessage: `Each line must be an equation with '=' (check: "${line}")`,
      };
    }
  }

  // Detect optional constant parameter definitions (e.g., Vs = 12, R1 = 1k) when unique & needed as denominator/parameter
  const candidateCounts = new Map<string, number>();
  const rawConstDefs: Array<{ index: number; name: string; rhs: string }> = [];

  cleanedLines.forEach((line, index) => {
    const [lhsRaw, rhsRaw] = line.split('=');
    const lhs = lhsRaw.trim();
    const rhs = rhsRaw.trim();
    if (isValidIdentifier(lhs)) {
      candidateCounts.set(lhs, (candidateCounts.get(lhs) ?? 0) + 1);
      rawConstDefs.push({ index, name: lhs, rhs });
    }
  });

  const substitutedConstants: Array<{ name: string; value: number }> = [];
  const constScope: Record<string, number> = {};
  const droppedLineIndices = new Set<number>();

  for (const def of rawConstDefs) {
    if ((candidateCounts.get(def.name) ?? 0) > 1) continue;
    const otherLines = cleanedLines.filter((_, idx) => idx !== def.index);
    if (!isUsedNonlinearlyInOthers(def.name, otherLines)) continue;

    try {
      const val = math.evaluate(preprocessMathExpression(def.rhs), { ...constScope });
      if (typeof val === 'number' && Number.isFinite(val)) {
        constScope[normalizeIdentifier(def.name)] = val;
        substitutedConstants.push({ name: def.name, value: val });
        droppedLineIndices.add(def.index);
      }
    } catch {
      // ignore if RHS depends on unsolved unknowns
    }
  }

  let activeEquations = cleanedLines.filter((_, idx) => !droppedLineIndices.has(idx));
  for (const sub of substitutedConstants) {
    activeEquations = activeEquations.map((eq) =>
      substituteConstantInEquation(eq, sub.name, sub.value)
    );
  }

  if (activeEquations.length === 0) {
    return {
      status: 'error',
      equationsUsed: cleanedLines,
      substitutedConstants,
      variables: [],
      A: [],
      b: [],
      rref: [],
      rankA: 0,
      rankAug: 0,
      pivotCols: [],
      freeCols: [],
      errorMessage: 'Add at least one equation with unknowns to solve.',
    };
  }

  // Collect all variables across active equations in order of appearance
  const variables: string[] = [];
  const seenVars = new Set<string>();
  const parsedPairs: Array<{ lhsPre: string; rhsPre: string; raw: string }> = [];

  for (const eq of activeEquations) {
    const [lhsRaw, rhsRaw] = eq.split('=');
    try {
      const syms = [
        ...collectExpressionSymbols(lhsRaw),
        ...collectExpressionSymbols(rhsRaw),
      ];
      for (const s of syms) {
        if (!seenVars.has(s)) {
          seenVars.add(s);
          variables.push(s);
        }
      }
      parsedPairs.push({
        lhsPre: preprocessMathExpression(lhsRaw),
        rhsPre: preprocessMathExpression(rhsRaw),
        raw: eq,
      });
    } catch {
      return {
        status: 'error',
        equationsUsed: activeEquations,
        substitutedConstants,
        variables: [],
        A: [],
        b: [],
        rref: [],
        rankA: 0,
        rankAug: 0,
        pivotCols: [],
        freeCols: [],
        errorMessage: `Could not parse equation: "${eq}"`,
      };
    }
  }

  if (variables.length === 0) {
    // Pure numeric identity or contradiction (e.g. 2 + 2 = 4 vs 2 + 2 = 5)
    for (const pair of parsedPairs) {
      const l = Number(math.evaluate(pair.lhsPre));
      const r = Number(math.evaluate(pair.rhsPre));
      if (Math.abs(l - r) > 1e-9) {
        return {
          status: 'none',
          equationsUsed: activeEquations,
          substitutedConstants,
          variables: [],
          A: [],
          b: [],
          rref: [],
          rankA: 0,
          rankAug: 1,
          pivotCols: [],
          freeCols: [],
        };
      }
    }
    return {
      status: 'error',
      equationsUsed: activeEquations,
      substitutedConstants,
      variables: [],
      A: [],
      b: [],
      rref: [],
      rankA: 0,
      rankAug: 0,
      pivotCols: [],
      freeCols: [],
      errorMessage: 'No unknown variables found in equations.',
    };
  }

  const normVars = variables.map((v) => normalizeIdentifier(v));
  const A: number[][] = [];
  const b: number[] = [];

  const evalDiffAt = (
    pair: { lhsPre: string; rhsPre: string },
    vec: number[]
  ): number => {
    const scope: Record<string, number> = {};
    for (let i = 0; i < normVars.length; i++) {
      scope[normVars[i]] = vec[i];
    }
    const l = math.evaluate(pair.lhsPre, scope);
    const r = math.evaluate(pair.rhsPre, scope);
    if (typeof l !== 'number' || typeof r !== 'number' || !Number.isFinite(l) || !Number.isFinite(r)) {
      throw new Error('Non-numeric or undefined value');
    }
    return l - r;
  };

  for (const pair of parsedPairs) {
    try {
      const zeros = new Array(variables.length).fill(0);
      const c0 = evalDiffAt(pair, zeros);
      const row = new Array(variables.length).fill(0);

      for (let j = 0; j < variables.length; j++) {
        const unit = new Array(variables.length).fill(0);
        unit[j] = 1;
        row[j] = cleanZero(evalDiffAt(pair, unit) - c0);
      }

      // Verify exact linearity at two independent test points
      const p1 = variables.map((_, idx) => 1.37 + idx * 0.41);
      const p2 = variables.map((_, idx) => -0.83 + idx * 0.67);
      for (const p of [p1, p2]) {
        const actual = evalDiffAt(pair, p);
        let expected = c0;
        let scale = 1 + Math.abs(c0);
        for (let j = 0; j < variables.length; j++) {
          expected += row[j] * p[j];
          scale += Math.abs(row[j] * p[j]);
        }
        if (Math.abs(actual - expected) > 1e-6 * scale) {
          return {
            status: 'error',
            equationsUsed: activeEquations,
            substitutedConstants,
            variables,
            A: [],
            b: [],
            rref: [],
            rankA: 0,
            rankAug: 0,
            pivotCols: [],
            freeCols: [],
            errorMessage: `Equation "${pair.raw}" is nonlinear in (${variables.join(', ')}). Matrix solver handles linear equations.`,
          };
        }
      }

      A.push(row);
      b.push(cleanZero(-c0));
    } catch {
      return {
        status: 'error',
        equationsUsed: activeEquations,
        substitutedConstants,
        variables,
        A: [],
        b: [],
        rref: [],
        rankA: 0,
        rankAug: 0,
        pivotCols: [],
        freeCols: [],
        errorMessage: `Equation "${pair.raw}" could not be converted into linear matrix form.`,
      };
    }
  }

  const augmented = A.map((row, i) => [...row, b[i]]);
  const { rref, pivotCols, rankA, rankAug } = rrefAugmented(augmented);
  const n = variables.length;
  const pivotSet = new Set(pivotCols);
  const freeCols: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!pivotSet.has(c)) freeCols.push(c);
  }

  const aLatex = buildBmatrixLatex(
    A.map((row) => row.map((v) => formatMatrixNumberLatex(v)))
  );
  const xLatex = buildBmatrixLatex(variables.map((v) => [formatVarLatex(v)]));
  const bLatex = buildBmatrixLatex(b.map((v) => [formatMatrixNumberLatex(v)]));
  const latexMatrixEq = `${aLatex} ${xLatex} = ${bLatex}`;
  const latexRref = buildAugmentedLatex(rref);

  // Case 1: Inconsistent (No solution / Nothing)
  if (rankAug > rankA) {
    return {
      status: 'none',
      equationsUsed: activeEquations,
      substitutedConstants,
      variables,
      A,
      b,
      rref,
      rankA,
      rankAug,
      pivotCols,
      freeCols,
      latexMatrixEq,
      latexRref,
      latexSolution: `${xLatex} \\in \\emptyset`,
    };
  }

  // Build particular solution (setting all free variables = 0)
  const particular = new Array(n).fill(0);
  for (let rIdx = 0; rIdx < pivotCols.length; rIdx++) {
    const pCol = pivotCols[rIdx];
    particular[pCol] = cleanZero(rref[rIdx][n]);
  }

  // Case 2: Unique solution
  if (freeCols.length === 0) {
    const uniqueSolution: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      uniqueSolution[variables[i]] = particular[i];
    }
    const solLatex = buildBmatrixLatex(
      particular.map((v) => [formatMatrixNumberLatex(v)])
    );
    return {
      status: 'unique',
      equationsUsed: activeEquations,
      substitutedConstants,
      variables,
      A,
      b,
      rref,
      rankA,
      rankAug,
      pivotCols,
      freeCols,
      uniqueSolution,
      particular,
      latexMatrixEq,
      latexRref,
      latexSolution: `${xLatex} = ${solLatex}`,
    };
  }

  // Case 3: Infinitely many solutions (parametric form + sample solutions)
  const nullBasis: number[][] = [];
  for (const fCol of freeCols) {
    const basisVec = new Array(n).fill(0);
    basisVec[fCol] = 1;
    for (let rIdx = 0; rIdx < pivotCols.length; rIdx++) {
      const pCol = pivotCols[rIdx];
      basisVec[pCol] = cleanZero(-rref[rIdx][fCol]);
    }
    nullBasis.push(basisVec);
  }

  const pLatex = buildBmatrixLatex(
    particular.map((v) => [formatMatrixNumberLatex(v)])
  );
  const basisTerms = nullBasis.map((vec, idx) => {
    const param = nullBasis.length === 1 ? 't' : `t_${idx + 1}`;
    const vecLatex = buildBmatrixLatex(
      vec.map((v) => [formatMatrixNumberLatex(v)])
    );
    return `${param} ${vecLatex}`;
  });
  const latexSolution = `${xLatex} = ${pLatex} + ${basisTerms.join(' + ')}`;

  const sampleConfigs: Array<{ label: string; params: number[] }> = [
    {
      label: nullBasis.length === 1 ? 't = 0' : 'all tᵢ = 0',
      params: new Array(nullBasis.length).fill(0),
    },
    {
      label: nullBasis.length === 1 ? 't = 1' : 'all tᵢ = 1',
      params: new Array(nullBasis.length).fill(1),
    },
    {
      label: nullBasis.length === 1 ? 't = −1' : 't₁ = 2, others = 0',
      params:
        nullBasis.length === 1
          ? [-1]
          : nullBasis.map((_, i) => (i === 0 ? 2 : 0)),
    },
  ];

  const sampleSolutions: MatrixSampleSolution[] = sampleConfigs.map((cfg) => {
    const values: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      let val = particular[i];
      for (let k = 0; k < nullBasis.length; k++) {
        val += cfg.params[k] * nullBasis[k][i];
      }
      values[variables[i]] = cleanZero(val);
    }
    return { label: cfg.label, values };
  });

  return {
    status: 'infinite',
    equationsUsed: activeEquations,
    substitutedConstants,
    variables,
    A,
    b,
    rref,
    rankA,
    rankAug,
    pivotCols,
    freeCols,
    particular,
    nullBasis,
    sampleSolutions,
    latexMatrixEq,
    latexRref,
    latexSolution,
  };
}
