import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Grid2x2,
  HardDrive,
  Keyboard,
  Moon,
  PenTool,
  Sun,
  WifiOff,
} from 'lucide-react';
import { DownloadLocalModal } from './components/DownloadLocalModal';
import { HandwritingPad } from './components/HandwritingPad';
import { MatrixSolverPanel } from './components/MatrixSolverPanel';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReadableSheet } from './components/ReadableSheet';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WavyHeaderRibbon } from './components/WavyAccent';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { CopyFormat, ReadableEquation, Stroke, ThemeMode } from './types';
import { recognizeStrokesLocally } from './utils/localStrokeRecognizer';
import { extractContextSymbols } from './utils/mathContext';
import { expressionToLatex } from './utils/mathEngine';

const STORAGE_EQUATIONS_KEY = 'lecture-scratchpad-readable-eqs-v1';
const STORAGE_THEME_KEY = 'lecture-scratchpad-theme';
const STORAGE_COPY_FORMAT_KEY = 'lecture-scratchpad-copy-format-v1';
const STORAGE_LOCAL_MODE_KEY = 'lecture-scratchpad-local-mode-v1';
const STORAGE_SIDEBAR_SIDE_KEY = 'lecture-scratchpad-sidebar-side-v1';

const STARTER_EQUATIONS: ReadableEquation[] = [
  {
    id: 'starter-1',
    title: 'Nodal KCL Example',
    plain: '(V1 - Vs)/R1 + (V1 - V2)/R2 = 0',
    latex: '\\frac{V_1 - V_s}{R_1} + \\frac{V_1 - V_2}{R_2} = 0',
    source: 'handwritten',
    createdAt: 1731600000000,
  },
  {
    id: 'starter-2',
    title: 'Quadratic Formula',
    plain: 'x = (-b + sqrt(b^2 - 4*a*c)) / (2*a)',
    latex: 'x = \\frac{-b + \\sqrt{b^{2} - 4ac}}{2a}',
    source: 'handwritten',
    createdAt: 1731600001000,
  },
];

function loadSavedEquations(): ReadableEquation[] {
  try {
    const raw = localStorage.getItem(STORAGE_EQUATIONS_KEY);
    if (!raw) return STARTER_EQUATIONS;
    const parsed = JSON.parse(raw) as ReadableEquation[];
    return Array.isArray(parsed) ? parsed : STARTER_EQUATIONS;
  } catch {
    return STARTER_EQUATIONS;
  }
}

export default function App() {
  const isOnline = useOnlineStatus();
  const [equations, setEquations] = useState<ReadableEquation[]>(loadSavedEquations);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      return saved === 'light' || saved === 'dark' ? saved : 'light';
    } catch {
      return 'light';
    }
  });
  const [copyFormat, setCopyFormat] = useState<CopyFormat>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COPY_FORMAT_KEY);
      if (saved === 'latex' || saved === 'markdown' || saved === 'mathml') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'latex';
  });
  const [localMode, setLocalMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_LOCAL_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SIDEBAR_SIDE_KEY);
      return saved === 'left' || saved === 'right' ? saved : 'right';
    } catch {
      return 'right';
    }
  });
  const [workspaceTab, setWorkspaceTab] = useState<'pad' | 'matrix'>('pad');
  const [matrixSeed, setMatrixSeed] = useState<{ key: number; lines: string[] } | null>(null);
  const [appliedEquation, setAppliedEquation] = useState<{
    key: number;
    id: string;
    plain: string;
    title?: string;
  } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EQUATIONS_KEY, JSON.stringify(equations));
    } catch {
      // ignore storage limits
    }
  }, [equations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COPY_FORMAT_KEY, copyFormat);
    } catch {
      // ignore
    }
  }, [copyFormat]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCAL_MODE_KEY, String(localMode));
    } catch {
      // ignore
    }
  }, [localMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SIDEBAR_SIDE_KEY, sidebarSide);
    } catch {
      // ignore
    }
  }, [sidebarSide]);

  const appendRecognizedEquations = useCallback(
    (
      list: Array<{ latex: string; plain: string; title?: string }>,
      source: 'handwritten' | 'photo'
    ) => {
      const now = Date.now();
      const added: ReadableEquation[] = list.map((item, idx) => ({
        id: `eq-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        latex: item.latex || expressionToLatex(item.plain),
        plain: item.plain || item.latex,
        title: item.title || undefined,
        source,
        createdAt: now + idx,
      }));
      setEquations((prev) => [...prev, ...added]);
    },
    []
  );

  const handleConvertImage = useCallback(
    async (
      imageBase64: string,
      mimeType: string,
      source: 'handwritten' | 'photo',
      strokes?: Stroke[]
    ): Promise<boolean> => {
      setIsConverting(true);
      setErrorMessage(null);

      const useLocalOnly = localMode || !isOnline;

      try {
        if (useLocalOnly) {
          if (strokes && strokes.length > 0) {
            const localResults = recognizeStrokesLocally(strokes);
            if (localResults.length === 0) {
              setErrorMessage(
                'No strokes detected on the pad. Write an equation and convert again.'
              );
              return false;
            }
            appendRecognizedEquations(localResults, source);
            return true;
          }
          setErrorMessage(
            'Photo OCR requires an internet connection. Draw directly on the pad or type math below to work 100% locally.'
          );
          return false;
        }

        const contextSymbols = extractContextSymbols(equations);
        const res = await fetch('/api/recognize-math', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64, mimeType, contextSymbols }),
        });

        const data = (await res.json()) as {
          equations?: Array<{ latex: string; plain: string; title?: string }>;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || 'Could not convert handwriting.');
        }

        const list = data.equations ?? [];
        if (list.length === 0) {
          setErrorMessage(
            'No equations detected. Try writing a little larger or clearer and convert again.'
          );
          return false;
        }

        appendRecognizedEquations(list, source);
        return true;
      } catch (err) {
        if (strokes && strokes.length > 0) {
          const localResults = recognizeStrokesLocally(strokes);
          if (localResults.length > 0) {
            appendRecognizedEquations(localResults, source);
            return true;
          }
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Failed to convert handwritten math.'
        );
        return false;
      } finally {
        setIsConverting(false);
      }
    },
    [equations, localMode, isOnline, appendRecognizedEquations]
  );

  const handleAddTypedEquation = useCallback(
    (plainText: string, latexText?: string, title?: string) => {
      setErrorMessage(null);
      const latex = latexText?.trim() || expressionToLatex(plainText) || plainText;
      const item: ReadableEquation = {
        id: `eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        plain: plainText,
        latex,
        title,
        source: 'typed',
        createdAt: Date.now(),
      };
      setEquations((prev) => [...prev, item]);
    },
    []
  );

  const handleUpdateEquation = useCallback(
    (id: string, nextPlain: string, nextLatex: string) => {
      setEquations((prev) =>
        prev.map((eq) =>
          eq.id === id ? { ...eq, plain: nextPlain, latex: nextLatex } : eq
        )
      );
    },
    []
  );

  const handleDeleteEquation = useCallback((id: string) => {
    setEquations((prev) => prev.filter((eq) => eq.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setEquations([]);
  }, []);

  const handleApplyEquation = useCallback((eq: ReadableEquation) => {
    setWorkspaceTab('pad');
    setAppliedEquation((prev) => ({
      key: (prev?.key ?? 0) + 1,
      id: eq.id,
      plain: eq.plain,
      title: eq.title,
    }));
  }, []);

  const handleSolveInMatrix = useCallback(() => {
    const lines = equations
      .map((eq) => eq.plain.trim())
      .filter((p) => p.includes('='));
    if (lines.length > 0) {
      setMatrixSeed((prev) => ({ key: (prev?.key ?? 0) + 1, lines }));
    }
    setWorkspaceTab('matrix');
  }, [equations]);

  // Global keyboard shortcuts: ?, Alt+J (theme), Alt+S (download modal), Alt+P (print), Alt+O (local mode), Alt+B (bar side), Alt+M (matrix solver)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const tag = el?.tagName;
      const inInput =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (el instanceof HTMLElement && el.isContentEditable);

      if (e.key === '?' && !inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'j') {
          e.preventDefault();
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
        } else if (key === 's') {
          e.preventDefault();
          setDownloadOpen(true);
        } else if (key === 'p') {
          e.preventDefault();
          if (equations.length > 0) window.print();
        } else if (key === 'o') {
          e.preventDefault();
          setLocalMode((prev) => !prev);
        } else if (key === 'b') {
          e.preventDefault();
          setSidebarSide((prev) => (prev === 'right' ? 'left' : 'right'));
        } else if (key === 'm') {
          e.preventDefault();
          setWorkspaceTab((prev) => (prev === 'pad' ? 'matrix' : 'pad'));
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [equations.length]);

  const effectiveLocal = localMode || !isOnline;

  return (
    <div className="min-h-screen lg:h-screen w-screen flex flex-col bg-[#f7f5fc] dark:bg-[#0d0917] text-slate-900 dark:text-violet-50 lg:overflow-hidden">
      {/* Purple Wavy Top Header */}
      <header className="bg-gradient-to-r from-[#4c1d95] via-[#6d28d9] to-[#7e22ce] dark:from-[#26114d] dark:via-[#3b1778] dark:to-[#4c1d95] text-white shrink-0 no-print">
        <div className="px-5 pt-2.5 pb-1.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              Lecture Scratchpad
            </h1>

            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200">
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Offline</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Top-bar Download Button for Local PC */}
            <button
              type="button"
              onClick={() => setDownloadOpen(true)}
              data-testid="top-download-btn"
              aria-label="Download local offline files (Alt+S)"
              title="Download offline workbook, equations & backup for your PC (Alt+S)"
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-white text-violet-900 hover:bg-violet-50 font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-violet-700" aria-hidden="true" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={() => setLocalMode((prev) => !prev)}
              aria-pressed={effectiveLocal}
              title="Run handwriting recognition 100% locally in-browser without network calls (Alt+O)"
              className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                effectiveLocal
                  ? 'border-emerald-300/70 bg-emerald-500/25 text-white'
                  : 'border-white/25 bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{effectiveLocal ? 'Local Mode' : 'Local'}</span>
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts (?)"
              title="Keyboard shortcuts (?)"
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Keyboard className="w-3.5 h-3.5 text-violet-200" aria-hidden="true" />
              <span>Shortcuts</span>
              <kbd className="px-1 py-0.2 rounded border border-white/30 bg-white/15 font-mono text-[11px] text-white">
                ?
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title="Toggle Dark / Light theme (Alt+J)"
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-violet-100" aria-hidden="true" />
              )}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
        <WavyHeaderRibbon />
      </header>

      {/* Workspace + Dockable Equations Bar (Left or Right) */}
      <main
        className={`flex-1 min-h-0 grid grid-cols-1 ${
          sidebarSide === 'left'
            ? 'lg:grid-cols-[460px_minmax(0,1fr)]'
            : 'lg:grid-cols-[minmax(0,1fr)_460px]'
        }`}
      >
        <div
          className={`min-h-[480px] lg:min-h-0 lg:h-full flex flex-col no-print ${
            sidebarSide === 'left' ? 'lg:order-2' : 'lg:order-1'
          }`}
        >
          {/* Workspace Mode Switcher: Write & Casio Calc vs Matrix Solver */}
          <div className="px-4 py-2 border-b border-violet-200/80 dark:border-violet-900/60 bg-white dark:bg-[#171128] flex items-center justify-between gap-2 shrink-0">
            <div
              role="tablist"
              aria-label="Workspace mode"
              className="inline-flex items-center p-0.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-[#100b1d]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === 'pad'}
                data-testid="tab-write-calc"
                onClick={() => setWorkspaceTab('pad')}
                className={`min-h-[32px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  workspaceTab === 'pad'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-violet-200/80 hover:text-violet-900 dark:hover:text-white'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Write &amp; Casio Calc</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === 'matrix'}
                data-testid="tab-matrix-solver"
                onClick={() => setWorkspaceTab('matrix')}
                className={`min-h-[32px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  workspaceTab === 'matrix'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-violet-200/80 hover:text-violet-900 dark:hover:text-white'
                }`}
              >
                <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Matrix Solver</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-500 dark:text-violet-300/70 hidden sm:inline">
              Switch view: <kbd className="font-mono">Alt+M</kbd>
            </span>
          </div>

          <div className="flex-1 min-h-0">
            {workspaceTab === 'pad' ? (
              <HandwritingPad
                theme={theme}
                isConverting={isConverting}
                isModalOpen={shortcutsOpen || downloadOpen}
                errorMessage={errorMessage}
                appliedEquation={appliedEquation}
                sheetEquations={equations}
                onConvertImage={handleConvertImage}
                onAddTypedEquation={handleAddTypedEquation}
              />
            ) : (
              <MatrixSolverPanel
                equations={equations}
                importedSeed={matrixSeed}
                onSaveResultEquation={handleAddTypedEquation}
              />
            )}
          </div>
        </div>

        <aside
          aria-label="Equations bar"
          data-testid="equations-sidebar"
          data-side={sidebarSide}
          className={`min-h-[380px] lg:min-h-0 lg:h-full border-t lg:border-t-0 border-violet-200/80 dark:border-violet-900/60 ${
            sidebarSide === 'left'
              ? 'lg:order-1 lg:border-r'
              : 'lg:order-2 lg:border-l'
          }`}
        >
          <ReadableSheet
            equations={equations}
            copyFormat={copyFormat}
            sidebarSide={sidebarSide}
            activeAppliedId={appliedEquation?.id ?? null}
            onToggleSidebarSide={() =>
              setSidebarSide((prev) => (prev === 'right' ? 'left' : 'right'))
            }
            onApplyEquation={handleApplyEquation}
            onSolveInMatrix={handleSolveInMatrix}
            onChangeCopyFormat={setCopyFormat}
            onUpdateEquation={handleUpdateEquation}
            onDeleteEquation={handleDeleteEquation}
            onClearAll={handleClearAll}
          />
        </aside>
      </main>

      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <DownloadLocalModal
        isOpen={downloadOpen}
        equations={equations}
        onClose={() => setDownloadOpen(false)}
      />
    </div>
  );
}
