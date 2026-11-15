import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Grid2x2,
  PanelLeft,
  PanelRight,
  Printer,
  Trash2,
} from 'lucide-react';
import { CopyFormat, ReadableEquation } from '../types';
import {
  formatAllEquationsForCopy,
  formatEquationForCopy,
} from '../utils/mathContext';
import { evaluateNotebookLines, expressionToLatex } from '../utils/mathEngine';
import { CasioMathInput } from './CasioMathInput';
import { KatexSpan } from './KatexSpan';

interface ReadableSheetProps {
  equations: ReadableEquation[];
  copyFormat: CopyFormat;
  sidebarSide: 'left' | 'right';
  activeAppliedId?: string | null;
  onToggleSidebarSide: () => void;
  onApplyEquation: (eq: ReadableEquation) => void;
  onSolveInMatrix: () => void;
  onChangeCopyFormat: (format: CopyFormat) => void;
  onUpdateEquation: (id: string, nextPlain: string, nextLatex: string) => void;
  onDeleteEquation: (id: string) => void;
  onClearAll: () => void;
}

const FORMAT_LABELS: Record<CopyFormat, string> = {
  latex: 'LaTeX',
  markdown: '$$ Markdown',
  mathml: 'Word',
};

export const ReadableSheet: React.FC<ReadableSheetProps> = ({
  equations,
  copyFormat,
  sidebarSide,
  activeAppliedId = null,
  onToggleSidebarSide,
  onApplyEquation,
  onSolveInMatrix,
  onChangeCopyFormat,
  onUpdateEquation,
  onDeleteEquation,
  onClearAll,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLatex, setEditLatex] = useState('');
  const [editPlain, setEditPlain] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const evaluations = useMemo(() => {
    const lines = equations.map((eq) => ({ id: eq.id, text: eq.plain }));
    return evaluateNotebookLines(lines).results;
  }, [equations]);

  const startEdit = (eq: ReadableEquation) => {
    setEditingId(eq.id);
    setEditPlain(eq.plain);
    setEditLatex(eq.latex);
  };

  const saveEdit = (id: string) => {
    const cleanLatex = editLatex.trim() || expressionToLatex(editPlain);
    const cleanPlain = editPlain.trim() || cleanLatex;
    onUpdateEquation(id, cleanPlain, cleanLatex);
    setEditingId(null);
  };

  const copySingle = async (id: string, latex: string) => {
    const formatted = formatEquationForCopy(latex, copyFormat);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1400);
    } catch {
      // ignore clipboard errors
    }
  };

  const copyAll = async () => {
    const formatted = formatAllEquationsForCopy(equations, copyFormat);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <section
      aria-label="Equations Bar"
      className="flex flex-col h-full bg-[#f7f5fc] dark:bg-[#100b1d] min-h-0 print-only-notebook"
    >
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-violet-200/80 dark:border-violet-900/60 bg-white dark:bg-[#171128] space-y-2 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-violet-50">
              Equations
            </h2>
            <span className="text-xs text-slate-500 dark:text-violet-300/70 tabular-nums">
              ({equations.length})
            </span>
            <button
              type="button"
              onClick={onToggleSidebarSide}
              data-testid="toggle-sidebar-side"
              aria-label={
                sidebarSide === 'right'
                  ? 'Move equations bar to left side'
                  : 'Move equations bar to right side'
              }
              title={`Move equations bar to ${sidebarSide === 'right' ? 'left' : 'right'} side (Alt+B)`}
              className="hidden lg:inline-flex min-h-[32px] px-2 py-1 rounded border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-[#1d1533] hover:bg-violet-100 dark:hover:bg-violet-900/50 text-[11px] font-medium text-violet-900 dark:text-violet-200 items-center gap-1 whitespace-nowrap"
            >
              {sidebarSide === 'right' ? (
                <PanelLeft className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <PanelRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{sidebarSide === 'right' ? 'Dock Left' : 'Dock Right'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSolveInMatrix}
              disabled={equations.length === 0}
              data-testid="sidebar-matrix-solve-btn"
              title="Solve saved equations in matrix form"
              className="min-h-[32px] px-2.5 py-1 rounded-md border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-40 text-xs font-medium text-violet-800 dark:text-violet-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={equations.length === 0}
              title="Print / Save as PDF (Alt+P)"
              className="min-h-[32px] px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClearAll}
              disabled={equations.length === 0}
              className="min-h-[32px] px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Smart Copy Format Selector */}
          <div
            role="group"
            aria-label="Copy format"
            className="flex items-center p-0.5 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-[#100b1d]"
          >
            {(['latex', 'markdown', 'mathml'] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onChangeCopyFormat(fmt)}
                aria-pressed={copyFormat === fmt}
                className={`min-h-[28px] px-2.5 py-0.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  copyFormat === fmt
                    ? 'bg-white dark:bg-[#23193e] text-violet-900 dark:text-violet-100 shadow-xs'
                    : 'text-slate-600 dark:text-violet-300/70 hover:text-violet-900 dark:hover:text-violet-100'
                }`}
              >
                {FORMAT_LABELS[fmt]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void copyAll()}
            disabled={equations.length === 0}
            className="min-h-[32px] px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {copiedAll ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
          </button>
        </div>
      </div>

      {/* Equations List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-2.5"
        data-testid="readable-equations-list"
      >
        {equations.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-medium text-slate-700 dark:text-violet-100 mb-1">
              Your equations will appear here
            </p>
            <p className="text-xs text-slate-500 dark:text-violet-300/70 max-w-sm">
              Write on the pad, paste a screenshot, or type in the Casio calculator. Click Apply on any equation here to solve or calculate with it.
            </p>
          </div>
        ) : (
          equations.map((eq, idx) => {
            const ev = evaluations[idx];
            const isEditing = editingId === eq.id;
            const isApplied = activeAppliedId === eq.id;
            const showEval =
              ev &&
              !ev.isError &&
              ev.displayValue &&
              ev.kind !== 'equation' &&
              ev.displayValue !== eq.plain;

            return (
              <article
                key={eq.id}
                data-testid={`readable-equation-${idx}`}
                className={`rounded-xl border bg-white dark:bg-[#171128] p-3.5 transition-colors ${
                  isApplied
                    ? 'border-violet-500 ring-1 ring-violet-500/35'
                    : 'border-violet-200/80 dark:border-violet-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-xs font-medium text-slate-500 dark:text-violet-300/75 truncate">
                    {eq.title || `Equation ${idx + 1}`}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0 no-print">
                      <button
                        type="button"
                        onClick={() => onApplyEquation(eq)}
                        data-testid={`apply-equation-${idx}`}
                        aria-label={`Apply equation ${idx + 1} to calculator`}
                        title="Load this equation into the Casio calculator"
                        className={`min-h-[30px] px-2.5 py-1 rounded border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                          isApplied
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                            : 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-[#1d1533] hover:border-violet-400 hover:bg-violet-100/70 dark:hover:bg-violet-900/50 text-slate-700 dark:text-violet-200'
                        }`}
                      >
                        <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Apply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void copySingle(eq.id, eq.latex)}
                        aria-label={`Copy ${FORMAT_LABELS[copyFormat]} for equation ${idx + 1}`}
                        title={`Copy as ${FORMAT_LABELS[copyFormat]}`}
                        className="min-h-[30px] min-w-[30px] rounded text-slate-500 hover:text-violet-900 dark:text-violet-300/70 dark:hover:text-violet-100 hover:bg-violet-50 dark:hover:bg-violet-900/40 inline-flex items-center justify-center"
                      >
                        {copiedId === eq.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteEquation(eq.id)}
                        aria-label={`Delete equation ${idx + 1}`}
                        title="Delete"
                        className="min-h-[30px] min-w-[30px] rounded text-slate-500 hover:text-rose-600 dark:text-violet-300/70 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <CasioMathInput
                      id={`edit-casio-${eq.id}`}
                      ariaLabel={`Edit equation ${idx + 1} in Casio math view`}
                      initialPlain={eq.plain}
                      autoFocus
                      compact
                      submitLabel="Save"
                      onSubmit={(nextPlain, nextLatex) => {
                        onUpdateEquation(
                          eq.id,
                          nextPlain,
                          nextLatex || expressionToLatex(nextPlain)
                        );
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                    <details className="text-xs text-slate-500 dark:text-slate-400">
                      <summary className="cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200">
                        Edit raw LaTeX
                      </summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEdit(eq.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                        className="mt-2 flex items-center gap-2"
                      >
                        <label htmlFor={`edit-latex-${eq.id}`} className="sr-only">
                          LaTeX
                        </label>
                        <input
                          id={`edit-latex-${eq.id}`}
                          type="text"
                          value={editLatex}
                          onChange={(e) => setEditLatex(e.target.value)}
                          className="flex-1 min-h-[36px] px-3 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="submit"
                          className="min-h-[36px] px-3 py-1 rounded-md bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium"
                        >
                          Save LaTeX
                        </button>
                      </form>
                    </details>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    {/* Click anywhere on the equation to edit inline */}
                    <button
                      type="button"
                      onClick={() => startEdit(eq)}
                      aria-label={`Edit equation ${idx + 1}`}
                      title="Click to edit equation"
                      className="min-w-0 flex-1 text-left rounded-md px-2 py-1.5 -mx-2 -my-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors overflow-x-auto"
                    >
                      <div className="text-base sm:text-lg text-slate-900 dark:text-slate-50">
                        <KatexSpan latex={eq.latex} />
                      </div>
                    </button>

                    {showEval && (
                      <div className="text-right font-mono tabular-nums shrink-0 pl-2">
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          = {ev.displayValue}
                        </div>
                        {ev.secondaryValue && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {ev.secondaryValue}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
