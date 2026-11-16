import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Import,
  Infinity as InfinityIcon,
  Plus,
  Sparkles,
} from 'lucide-react';
import { ReadableEquation } from '../types';
import {
  formatMatrixNumberPlain,
  solveLinearSystem,
} from '../utils/matrixSolver';
import { KatexSpan } from './KatexSpan';
import { WavyDivider } from './WavyAccent';

interface MatrixSolverPanelProps {
  equations: ReadableEquation[];
  importedSeed?: { key: number; lines: string[] } | null;
  onSaveResultEquation?: (plain: string, latex: string, title?: string) => void;
}

const PRESETS: Array<{ label: string; text: string }> = [
  {
    label: 'Unique (2×2)',
    text: '2*x + y = 5\nx - y = 1',
  },
  {
    label: 'KCL Circuit',
    text: 'Vs = 12\nR1 = 1k\nR2 = 2k\nR3 = 2k\n(V1 - Vs)/R1 + (V1 - V2)/R2 = 0\n(V2 - V1)/R2 + V2/R3 = 0',
  },
  {
    label: 'Many Solutions',
    text: 'x + y + z = 6\n2*x - y + z = 3',
  },
  {
    label: 'No Solution',
    text: 'x + y = 4\n2*x + 2*y = 10',
  },
];

export const MatrixSolverPanel: React.FC<MatrixSolverPanelProps> = ({
  equations,
  importedSeed = null,
  onSaveResultEquation,
}) => {
  const [systemText, setSystemText] = useState<string>(PRESETS[0].text);
  const [lastSeedKey, setLastSeedKey] = useState<number>(0);

  useEffect(() => {
    if (!importedSeed || importedSeed.key <= 0 || importedSeed.key === lastSeedKey) {
      return;
    }
    setLastSeedKey(importedSeed.key);
    if (importedSeed.lines.length > 0) {
      setSystemText(importedSeed.lines.join('\n'));
    }
  }, [importedSeed, lastSeedKey]);

  const importFromEquationsBar = () => {
    const validLines = equations
      .map((eq) => eq.plain.trim())
      .filter((p) => p.includes('='));
    if (validLines.length > 0) {
      setSystemText(validLines.join('\n'));
    }
  };

  const result = useMemo(() => {
    const lines = systemText.split(/\r?\n/);
    return solveLinearSystem(lines);
  }, [systemText]);

  const canImportFromBar = equations.some((eq) => eq.plain.includes('='));

  const saveAnswerToBar = () => {
    if (!onSaveResultEquation || !result.latexSolution) return;
    if (result.status === 'unique' && result.uniqueSolution) {
      const plainSummary = Object.entries(result.uniqueSolution)
        .map(([k, v]) => `${k} = ${formatMatrixNumberPlain(v)}`)
        .join(', ');
      onSaveResultEquation(
        plainSummary,
        result.latexSolution,
        'Matrix Solution'
      );
    } else if (result.status === 'infinite') {
      onSaveResultEquation(
        `Parametric (${result.freeCols.length} free)`,
        result.latexSolution,
        'Matrix Family of Solutions'
      );
    }
  };

  return (
    <section
      aria-label="Matrix Equation System Solver"
      data-testid="matrix-solver-panel"
      className="flex flex-col h-full bg-[#faf8ff] dark:bg-[#100b1d] min-h-0 overflow-y-auto"
    >
      {/* Toolbar Header */}
      <div className="px-4 py-3 border-b border-violet-200/80 dark:border-violet-900/60 bg-white dark:bg-[#171128] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-violet-50">
            Matrix &amp; System Solver
          </h2>
          <p className="text-xs text-slate-500 dark:text-violet-300/70">
            Solves systems in matrix form Ax = b (unique, many solutions, or none)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canImportFromBar && (
            <button
              type="button"
              onClick={importFromEquationsBar}
              data-testid="import-from-bar-btn"
              className="min-h-[34px] px-2.5 py-1 rounded-md border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-xs font-medium text-violet-800 dark:text-violet-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Import className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Use Equations Bar</span>
            </button>
          )}

          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSystemText(preset.text)}
              className="min-h-[34px] px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800/80 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 text-xs font-medium text-slate-700 dark:text-violet-200 whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Solver Body */}
      <div className="p-4 sm:p-5 space-y-4 flex-1">
        {/* Equations Input */}
        <div className="rounded-xl border border-violet-200/90 dark:border-violet-800/70 bg-white dark:bg-[#171128] p-3.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="matrix-equations-textarea"
              className="text-xs font-semibold text-slate-700 dark:text-violet-200"
            >
              Equations (one per line — supports 1k, 4.7k, 10u, fractions, constants)
            </label>
            <span className="text-[11px] text-slate-500 dark:text-violet-300/70 tabular-nums">
              {result.equationsUsed.length} eqs · {result.variables.length} vars
            </span>
          </div>

          <textarea
            id="matrix-equations-textarea"
            data-testid="matrix-equations-input"
            rows={5}
            value={systemText}
            onChange={(e) => setSystemText(e.target.value)}
            spellCheck={false}
            placeholder={'2*x + y = 5\nx - y = 1'}
            className="w-full rounded-lg border border-violet-200 dark:border-violet-800 bg-[#fbf9ff] dark:bg-[#0e0919] px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />

          {result.substitutedConstants.length > 0 && (
            <div className="text-xs text-violet-700 dark:text-violet-300">
              Substituted constants:{' '}
              {result.substitutedConstants
                .map((c) => `${c.name} = ${formatMatrixNumberPlain(c.value)}`)
                .join(' · ')}
            </div>
          )}
        </div>

        <WavyDivider />

        {/* Empty / Error states */}
        {result.status === 'empty' && (
          <div className="rounded-xl border border-violet-200 dark:border-violet-800/70 bg-white dark:bg-[#171128] p-6 text-center text-sm text-slate-500 dark:text-violet-300/70">
            Enter one or more equations above (e.g. <code>2*x + y = 5</code> and{' '}
            <code>x - y = 1</code>) to see the matrix form and solution.
          </div>
        )}

        {result.status === 'error' && (
          <div
            role="alert"
            data-testid="matrix-error-box"
            className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-4 text-xs font-medium text-amber-800 dark:text-amber-200"
          >
            {result.errorMessage}
          </div>
        )}

        {/* Matrix Form & Solution Output */}
        {(result.status === 'unique' ||
          result.status === 'infinite' ||
          result.status === 'none') && (
          <div className="space-y-4">
            {/* Answer Summary Card */}
            <div
              data-testid="matrix-answer-card"
              data-status={result.status}
              className={`rounded-xl border p-4 space-y-3 ${
                result.status === 'unique'
                  ? 'border-violet-400 dark:border-violet-600 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/60 dark:from-violet-950/60 dark:via-[#171128] dark:to-fuchsia-950/30'
                  : result.status === 'infinite'
                  ? 'border-fuchsia-300 dark:border-fuchsia-700 bg-gradient-to-br from-fuchsia-50/70 via-white to-violet-50/60 dark:from-fuchsia-950/40 dark:via-[#171128] dark:to-violet-950/40'
                  : 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {result.status === 'unique' && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                        Unique Solution
                      </h3>
                    </>
                  )}
                  {result.status === 'infinite' && (
                    <>
                      <InfinityIcon className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-fuchsia-950 dark:text-fuchsia-100">
                        Many Solutions ({result.freeCols.length} free{' '}
                        {result.freeCols.length === 1 ? 'variable' : 'variables'})
                      </h3>
                    </>
                  )}
                  {result.status === 'none' && (
                    <>
                      <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                        No Solution (Nothing satisfies all equations)
                      </h3>
                    </>
                  )}
                </div>

                {onSaveResultEquation && result.status !== 'none' && (
                  <button
                    type="button"
                    onClick={saveAnswerToBar}
                    className="min-h-[32px] px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Save to Equations</span>
                  </button>
                )}
              </div>

              {/* Solution Matrix Vector / Empty Set */}
              {result.latexSolution && (
                <div className="overflow-x-auto py-1 text-base sm:text-lg text-slate-900 dark:text-violet-50">
                  <KatexSpan latex={result.latexSolution} displayMode />
                </div>
              )}

              {/* Unique numeric values */}
              {result.status === 'unique' && result.uniqueSolution && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(result.uniqueSolution).map(([varName, val]) => (
                    <div
                      key={varName}
                      className="px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-700/80 bg-white dark:bg-[#1e1635] font-mono tabular-nums text-sm text-slate-900 dark:text-violet-50"
                    >
                      <span className="font-serif italic text-violet-700 dark:text-violet-300">
                        {varName}
                      </span>{' '}
                      = <span className="font-semibold">{formatMatrixNumberPlain(val)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Infinite: multiple concrete satisfying solutions */}
              {result.status === 'infinite' && result.sampleSolutions && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-medium text-fuchsia-800 dark:text-fuchsia-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sample satisfying solutions (pick any t):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {result.sampleSolutions.map((sample) => (
                      <div
                        key={sample.label}
                        className="rounded-lg border border-fuchsia-200/90 dark:border-fuchsia-800/60 bg-white dark:bg-[#1d1431] px-3 py-2 text-xs font-mono tabular-nums space-y-0.5"
                      >
                        <div className="text-[11px] font-sans font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                          {sample.label}
                        </div>
                        <div className="text-slate-900 dark:text-violet-100">
                          {Object.entries(sample.values)
                            .map(([k, v]) => `${k}=${formatMatrixNumberPlain(v)}`)
                            .join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* None */}
              {result.status === 'none' && (
                <p className="text-xs text-rose-800 dark:text-rose-200">
                  Rank(A) = {result.rankA} &lt; Rank([A | b]) = {result.rankAug}. At least one row reduces to <code>0 = nonzero</code>, so no values satisfy this system.
                </p>
              )}
            </div>

            {/* Matrix Form Ax = b and RREF */}
            {result.latexMatrixEq && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <div className="rounded-xl border border-violet-200/90 dark:border-violet-800/70 bg-white dark:bg-[#171128] p-3.5">
                  <div className="text-xs font-semibold text-slate-600 dark:text-violet-300 mb-2">
                    Matrix Form (Ax = b)
                  </div>
                  <div className="overflow-x-auto py-1 text-slate-900 dark:text-violet-50">
                    <KatexSpan latex={result.latexMatrixEq} displayMode />
                  </div>
                </div>

                {result.latexRref && (
                  <div className="rounded-xl border border-violet-200/90 dark:border-violet-800/70 bg-white dark:bg-[#171128] p-3.5">
                    <div className="text-xs font-semibold text-slate-600 dark:text-violet-300 mb-2">
                      Reduced Row Echelon Form (RREF [A | b])
                    </div>
                    <div className="overflow-x-auto py-1 text-slate-900 dark:text-violet-50">
                      <KatexSpan latex={result.latexRref} displayMode />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
