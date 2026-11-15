import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  backspace,
  CasioEditorState,
  CasioNode,
  CasioPathSegment,
  createCasioStateFromNodes,
  createEmptyCasioState,
  insertChar,
  insertFraction,
  insertSqrt,
  insertSub,
  insertSup,
  moveLeft,
  moveRight,
  moveVertical,
  parseTextToCasioNodes,
  serializeToLatex,
  serializeToPlain,
} from '../utils/casioMathEditor';
import { evaluateCasioCalculation } from '../utils/casioCalculator';
import { ReadableEquation } from '../types';

export interface ExternalCasioLoad {
  key: number;
  plain: string;
  title?: string;
}

interface CasioMathInputProps {
  id?: string;
  ariaLabel?: string;
  initialPlain?: string;
  externalLoad?: ExternalCasioLoad | null;
  showCalculator?: boolean;
  sheetEquations?: ReadableEquation[];
  autoFocus?: boolean;
  submitLabel?: string;
  onSubmit: (plain: string, latex: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

function samePath(a: CasioPathSegment[], b: CasioPathSegment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].nodeId !== b[i].nodeId || a[i].slot !== b[i].slot) return false;
  }
  return true;
}

const DISPLAY_CHAR_MAP: Record<string, string> = {
  '*': '×',
  '-': '−',
};

export const CasioMathInput: React.FC<CasioMathInputProps> = ({
  id = 'casio-math-input',
  ariaLabel = 'Casio style math keyboard input',
  initialPlain = '',
  externalLoad = null,
  showCalculator = false,
  sheetEquations = [],
  autoFocus = false,
  submitLabel = 'Add',
  onSubmit,
  onCancel,
  compact = false,
}) => {
  const [state, setState] = useState<CasioEditorState>(() =>
    initialPlain
      ? createCasioStateFromNodes(parseTextToCasioNodes(initialPlain))
      : createEmptyCasioState()
  );
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastLoadKeyRef = useRef<number>(0);

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!externalLoad || externalLoad.key <= 0) return;
    if (externalLoad.key === lastLoadKeyRef.current) return;
    lastLoadKeyRef.current = externalLoad.key;

    const nodes = parseTextToCasioNodes(externalLoad.plain);
    setState(
      nodes.length > 0
        ? createCasioStateFromNodes(nodes)
        : createEmptyCasioState()
    );
    setVarValues({});
    setAppliedLabel(externalLoad.title ?? null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [externalLoad]);

  const plainValue = serializeToPlain(state.nodes);
  const latexValue = serializeToLatex(state.nodes);
  const hasContent = state.nodes.length > 0;

  const calcResult = useMemo(() => {
    if (!showCalculator) return null;
    return evaluateCasioCalculation(plainValue, varValues, sheetEquations);
  }, [showCalculator, plainValue, varValues, sheetEquations]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const clearCalculator = useCallback(() => {
    setState(createEmptyCasioState());
    setVarValues({});
    setAppliedLabel(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const submitCurrent = useCallback(() => {
    const cleanPlain = serializeToPlain(state.nodes);
    const cleanLatex = serializeToLatex(state.nodes);
    if (!cleanPlain && !cleanLatex) return;
    onSubmit(cleanPlain || cleanLatex, cleanLatex || cleanPlain);
    if (!initialPlain) {
      setState(createEmptyCasioState());
      setVarValues({});
      setAppliedLabel(null);
    }
  }, [state.nodes, onSubmit, initialPlain]);

  const applyAction = useCallback(
    (updater: (prev: CasioEditorState) => CasioEditorState) => {
      setState((prev) => updater(prev));
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCurrent();
      return;
    }

    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setState((prev) => moveLeft(prev));
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setState((prev) => moveRight(prev));
      return;
    }

    if (e.key === 'Tab' && !e.shiftKey && state.cursor.path.length > 0) {
      e.preventDefault();
      setState((prev) => moveRight(prev));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setState((prev) => moveVertical(prev, 'up'));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setState((prev) => moveVertical(prev, 'down'));
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      setState((prev) => backspace(prev));
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === '/') {
        e.preventDefault();
        setState((prev) => insertFraction(prev));
        return;
      }
      if (e.key === '^') {
        e.preventDefault();
        setState((prev) => insertSup(prev));
        return;
      }
      if (e.key === '_') {
        e.preventDefault();
        setState((prev) => insertSub(prev));
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        setState((prev) => insertChar(prev, e.key));
      }
    }
  };

  // Fallback for mobile IME / automated fill() that bypasses single-key keydown
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    e.target.value = '';
    setState((prev) => {
      if (val.length > 2) {
        const parsed = parseTextToCasioNodes(val);
        if (parsed.length > 0) {
          return createCasioStateFromNodes([...prev.nodes, ...parsed]);
        }
      }
      let next = prev;
      for (const ch of val) {
        if (ch === '/') next = insertFraction(next);
        else if (ch === '^') next = insertSup(next);
        else if (ch === '_') next = insertSub(next);
        else next = insertChar(next, ch);
      }
      return next;
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          // Let global clipboard image listener handle screenshot paste
          return;
        }
      }
    }
    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      const parsed = parseTextToCasioNodes(text);
      if (parsed.length > 0) {
        setState((prev) =>
          createCasioStateFromNodes([...prev.nodes, ...parsed])
        );
      }
    }
  };

  const setCursorAt = (
    e: React.MouseEvent,
    path: CasioPathSegment[],
    index: number
  ) => {
    e.stopPropagation();
    setState((prev) => ({ ...prev, cursor: { path, index } }));
    focusInput();
  };

  const renderCaret = (key: string) =>
    isFocused ? (
      <span
        key={key}
        aria-hidden="true"
        className="casio-caret inline-block w-[2px] h-[1.1em] bg-violet-600 dark:bg-violet-400 align-middle mx-[0.5px] rounded-full"
      />
    ) : null;

  const renderNodeList = (
    list: CasioNode[],
    path: CasioPathSegment[],
    isEmptyPlaceholder = false
  ): React.ReactNode => {
    const isActiveList = samePath(state.cursor.path, path);

    if (list.length === 0) {
      return (
        <span
          onClick={(e) => setCursorAt(e, path, 0)}
          className={`inline-flex items-center justify-center min-w-[14px] min-h-[18px] px-0.5 rounded-[2px] cursor-text ${
            isEmptyPlaceholder
              ? isActiveList && isFocused
                ? 'border border-violet-500 bg-violet-50/70 dark:bg-violet-950/60'
                : 'border border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/40 dark:bg-[#19122c]'
              : ''
          }`}
        >
          {isActiveList && renderCaret('caret-empty')}
        </span>
      );
    }

    const elements: React.ReactNode[] = [];
    for (let i = 0; i <= list.length; i++) {
      if (isActiveList && state.cursor.index === i) {
        elements.push(renderCaret(`caret-${i}`));
      }
      if (i === list.length) break;

      const node = list[i];
      if (node.type === 'char') {
        const display = DISPLAY_CHAR_MAP[node.value] ?? node.value;
        const isBinaryOp =
          node.value === '=' || node.value === '+' || node.value === '-';
        elements.push(
          <span
            key={node.id}
            onClick={(e) => setCursorAt(e, path, i + 1)}
            className={`cursor-text select-none ${
              isBinaryOp ? 'mx-0.5' : ''
            } ${/^[A-Za-z]$/.test(node.value) ? 'italic font-serif' : ''}`}
          >
            {display}
          </span>
        );
      } else if (node.type === 'frac') {
        const numPath: CasioPathSegment[] = [
          ...path,
          { nodeId: node.id, slot: 'num' },
        ];
        const denPath: CasioPathSegment[] = [
          ...path,
          { nodeId: node.id, slot: 'den' },
        ];
        elements.push(
          <span
            key={node.id}
            data-casio-frac="true"
            className="inline-flex flex-col items-center align-middle mx-1 leading-tight"
          >
            <span
              data-casio-slot="num"
              onClick={(e) => setCursorAt(e, numPath, node.num.length)}
              className="px-1.5 pb-0.5 border-b-[1.5px] border-slate-800 dark:border-slate-200 min-w-[20px] flex items-center justify-center"
            >
              {renderNodeList(node.num, numPath, true)}
            </span>
            <span
              data-casio-slot="den"
              onClick={(e) => setCursorAt(e, denPath, node.den.length)}
              className="px-1.5 pt-0.5 min-w-[20px] flex items-center justify-center"
            >
              {renderNodeList(node.den, denPath, true)}
            </span>
          </span>
        );
      } else if (node.type === 'sup') {
        const expPath: CasioPathSegment[] = [
          ...path,
          { nodeId: node.id, slot: 'exp' },
        ];
        elements.push(
          <span
            key={node.id}
            data-casio-slot="exp"
            onClick={(e) => setCursorAt(e, expPath, node.exp.length)}
            className="inline-flex items-center align-super text-[0.72em] leading-none -translate-y-1.5 ml-0.5"
          >
            {renderNodeList(node.exp, expPath, true)}
          </span>
        );
      } else if (node.type === 'sub') {
        const subPath: CasioPathSegment[] = [
          ...path,
          { nodeId: node.id, slot: 'sub' },
        ];
        elements.push(
          <span
            key={node.id}
            data-casio-slot="sub"
            onClick={(e) => setCursorAt(e, subPath, node.sub.length)}
            className="inline-flex items-center align-sub text-[0.72em] leading-none translate-y-1 ml-0.5"
          >
            {renderNodeList(node.sub, subPath, true)}
          </span>
        );
      } else if (node.type === 'sqrt') {
        const radPath: CasioPathSegment[] = [
          ...path,
          { nodeId: node.id, slot: 'radicand' },
        ];
        elements.push(
          <span
            key={node.id}
            data-casio-slot="radicand"
            onClick={(e) => setCursorAt(e, radPath, node.radicand.length)}
            className="inline-flex items-stretch align-middle mx-0.5"
          >
            <svg
              viewBox="0 0 12 24"
              className="w-3 h-[1.45em] text-slate-800 dark:text-slate-200 shrink-0 self-stretch"
              aria-hidden="true"
            >
              <path
                d="M1 13 L4 21 L10.5 1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="border-t-[1.5px] border-slate-800 dark:border-slate-200 pt-0.5 px-1 inline-flex items-center">
              {renderNodeList(node.radicand, radPath, true)}
            </span>
          </span>
        );
      }
    }

    return <span className="inline-flex items-center flex-wrap">{elements}</span>;
  };

  return (
    <div className="space-y-1.5">
      {/* Compact Casio Natural-Display Function Keys */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div
          role="group"
          aria-label="Casio math keys"
          className="flex flex-wrap items-center gap-1"
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(insertFraction)}
            aria-label="Insert stacked fraction"
            title="Stacked fraction (/)"
            className="min-h-[30px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
          >
            <span className="inline-flex flex-col items-center leading-none text-[8px]">
              <span className="border-b border-current px-0.5 pb-[1px]">□</span>
              <span className="px-0.5 pt-[1px]">□</span>
            </span>
            <span>a/b</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(insertSqrt)}
            aria-label="Insert square root"
            title="Square root (sqrt()"
            className="min-h-[30px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            √□
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(insertSup)}
            aria-label="Insert exponent"
            title="Power / exponent (^)"
            className="min-h-[30px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            x<sup className="text-[9px]">□</sup>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(insertSub)}
            aria-label="Insert subscript"
            title="Subscript (_)"
            className="min-h-[30px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            x<sub className="text-[9px]">□</sub>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              applyAction((prev) =>
                moveLeft(insertChar(insertChar(prev, '('), ')'))
              )
            }
            aria-label="Insert parentheses"
            title="Parentheses"
            className="min-h-[30px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200"
          >
            ( )
          </button>

          {(['π', 'ω', 'θ', 'Ω'] as const).map((sym) => (
            <button
              key={sym}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyAction((prev) => insertChar(prev, sym))}
              aria-label={`Insert ${sym}`}
              className="min-h-[30px] min-w-[28px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-200"
            >
              {sym}
            </button>
          ))}
        </div>

        {!compact && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            Type <kbd className="font-mono">/</kbd> for fraction · <kbd className="font-mono">→</kbd> step out
          </span>
        )}
      </div>

      {/* Casio Natural-Display Editor Box + Submit/Cancel */}
      <div className="flex items-stretch gap-2">
        <div
          onClick={() => setCursorAt({ stopPropagation: () => {} } as React.MouseEvent, [], state.nodes.length)}
          data-testid="casio-math-display"
          data-plain={plainValue}
          data-latex={latexValue}
          className={`relative flex-1 min-h-[48px] px-3 py-1.5 rounded-lg border bg-[#fbf9ff] dark:bg-[#0e0919] text-base text-slate-900 dark:text-violet-50 flex items-center overflow-x-auto cursor-text transition-colors ${
            isFocused
              ? 'border-violet-500 ring-2 ring-violet-500/20'
              : 'border-violet-200 dark:border-violet-800'
          }`}
        >
          <input
            ref={inputRef}
            id={id}
            type="text"
            aria-label={ariaLabel}
            aria-valuetext={plainValue}
            value=""
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="sr-only"
          />

          {state.nodes.length === 0 ? (
            <div className="flex items-center gap-1 min-h-[28px]">
              {isFocused && renderCaret('caret-empty-root')}
              <span className="text-xs text-slate-400 dark:text-violet-300/60 select-none">
                {showCalculator
                  ? 'Casio calculator: type math (/ for x over y) or click Apply on any saved equation'
                  : 'Type Casio math: press / for x over y, ^ power, _ subscript'}
              </span>
            </div>
          ) : (
            <div className="py-0.5 min-h-[28px] flex items-center">
              {renderNodeList(state.nodes, [])}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showCalculator && hasContent && (
            <button
              type="button"
              onClick={clearCalculator}
              aria-label="Clear calculator input"
              title="Clear calculator (AC)"
              className="min-h-[40px] px-2.5 py-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1e1635] hover:bg-violet-50 dark:hover:bg-violet-900/50 text-xs font-medium text-slate-700 dark:text-violet-200"
            >
              AC
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-violet-200 dark:border-violet-800 text-xs font-medium text-slate-700 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-900/50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={submitCurrent}
            disabled={!hasContent}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-100 disabled:text-violet-300 dark:disabled:bg-[#22193b] dark:disabled:text-violet-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {/* Live Casio Calculator Result & CALC Variable Inputs */}
      {showCalculator && calcResult && calcResult.status !== 'empty' && (
        <div
          data-testid="casio-calculator-panel"
          className="rounded-lg border border-violet-200 dark:border-violet-800/70 bg-violet-50/60 dark:bg-[#110c20] px-3 py-2 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-violet-300">
              <span className="font-semibold text-[11px] text-violet-700 dark:text-violet-300">
                Casio CALC
              </span>
              {appliedLabel && (
                <span className="text-slate-600 dark:text-violet-200/80 truncate max-w-[200px]">
                  · {appliedLabel}
                </span>
              )}
            </div>

            <div data-testid="casio-calc-result" className="font-mono tabular-nums text-sm">
              {calcResult.status === 'evaluated' && (
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {calcResult.targetVar ? `${calcResult.targetVar} = ` : '= '}
                  {calcResult.value}
                </span>
              )}
              {calcResult.status === 'solved' && (
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  Solved: {calcResult.targetVar} = {calcResult.value}
                </span>
              )}
              {calcResult.status === 'checked' && (
                <span className="font-medium text-slate-700 dark:text-violet-100">
                  {calcResult.value}
                  {calcResult.detail ? (
                    <span className="ml-2 text-xs text-slate-500 dark:text-violet-300/70">
                      ({calcResult.detail})
                    </span>
                  ) : null}
                </span>
              )}
              {calcResult.status === 'needs_vars' && (
                <span className="text-xs font-sans text-slate-500 dark:text-violet-300/70">
                  {calcResult.missingVars.length > 1
                    ? `Enter values (${calcResult.missingVars.join(', ')})`
                    : `Enter ${calcResult.missingVars[0]}`}
                </span>
              )}
              {calcResult.status === 'error' && (
                <span className="text-xs font-sans text-amber-700 dark:text-amber-400">
                  {calcResult.errorMessage}
                </span>
              )}
            </div>
          </div>

          {calcResult.variables.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-violet-200/70 dark:border-violet-800/60">
              {calcResult.variables.map((varName) => {
                const inputId = `${id}-var-${varName}`;
                const hasVal = (varValues[varName] ?? '').trim().length > 0;
                return (
                  <div key={varName} className="inline-flex items-center gap-1">
                    <label
                      htmlFor={inputId}
                      className="text-xs font-serif italic text-slate-700 dark:text-violet-200"
                    >
                      {varName} =
                    </label>
                    <input
                      id={inputId}
                      data-testid={`calc-var-${varName}`}
                      type="text"
                      value={varValues[varName] ?? ''}
                      onChange={(e) =>
                        setVarValues((prev) => ({
                          ...prev,
                          [varName]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      placeholder="?"
                      aria-label={`Value for ${varName}`}
                      className={`w-20 min-h-[30px] px-2 py-0.5 rounded border text-xs font-mono tabular-nums bg-white dark:bg-[#1a132e] text-slate-900 dark:text-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
                        hasVal
                          ? 'border-violet-500 dark:border-violet-500'
                          : 'border-violet-200 dark:border-violet-800'
                      }`}
                    />
                  </div>
                );
              })}
              {Object.values(varValues).some((v) => v.trim().length > 0) && (
                <button
                  type="button"
                  onClick={() => setVarValues({})}
                  className="min-h-[30px] px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  Clear vars
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
