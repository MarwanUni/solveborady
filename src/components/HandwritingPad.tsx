import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Eraser,
  ImageUp,
  Loader2,
  Pen,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';
import { ReadableEquation, Stroke, StrokePoint } from '../types';
import { CasioMathInput, ExternalCasioLoad } from './CasioMathInput';

interface HandwritingPadProps {
  theme: 'dark' | 'light';
  isConverting: boolean;
  isModalOpen?: boolean;
  errorMessage: string | null;
  appliedEquation?: ExternalCasioLoad | null;
  sheetEquations?: ReadableEquation[];
  onConvertImage: (
    imageBase64: string,
    mimeType: string,
    source: 'handwritten' | 'photo',
    strokes?: Stroke[]
  ) => Promise<boolean>;
  onAddTypedEquation: (plainText: string, latexText?: string) => void;
}

export const HandwritingPad: React.FC<HandwritingPadProps> = ({
  theme,
  isConverting,
  isModalOpen = false,
  errorMessage,
  appliedEquation = null,
  sheetEquations = [],
  onConvertImage,
  onAddTypedEquation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<Stroke[] | null>(null);
  const [autoConvert, setAutoConvert] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);

  const cancelAutoTimer = useCallback(() => {
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const renderCanvas = useCallback(
    (strokeList: Stroke[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const drawStroke = (stroke: Stroke) => {
        if (stroke.points.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke.width;

        if (stroke.mode === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = theme === 'dark' ? '#F8FAFC' : '#0F172A';
        }

        ctx.beginPath();
        const pts = stroke.points;
        if (pts.length === 1) {
          ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        } else {
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const midX = (pts[i].x + pts[i + 1].x) / 2;
            const midY = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
          }
          const last = pts[pts.length - 1];
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        ctx.restore();
      };

      for (const s of strokeList) {
        drawStroke(s);
      }
      if (currentStrokeRef.current) {
        drawStroke(currentStrokeRef.current);
      }

      ctx.restore();
    },
    [theme]
  );

  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  // Resize canvas cleanly to match container without triggering ResizeObserver loops
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let rafId: number | null = null;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.floor(rect.width * dpr);
      const nextHeight = Math.floor(rect.height * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        renderCanvas(strokesRef.current);
      }
    };

    const scheduleUpdate = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateSize();
      });
    };

    updateSize();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(container);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, [renderCanvas]);

  useEffect(() => {
    renderCanvas(strokes);
  }, [strokes, renderCanvas]);

  const convertFileBlob = useCallback(
    (file: File, source: 'photo' | 'handwritten' = 'photo') => {
      if (!file.type.startsWith('image/') || isConverting) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          void onConvertImage(reader.result, file.type || 'image/png', source);
        }
      };
      reader.readAsDataURL(file);
    },
    [isConverting, onConvertImage]
  );

  // Global Ctrl+V paste image from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            convertFileBlob(file, 'photo');
            return;
          }
        }
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [convertFileBlob]);

  // Export crisp black-on-white PNG and clear pad if conversion succeeds
  const handleConvertAndClear = useCallback(async () => {
    cancelAutoTimer();
    if (strokes.length === 0 || isConverting) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.mode === 'eraser' ? '#FFFFFF' : '#0F172A';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const midX = (pts[i].x + pts[i + 1].x) / 2;
          const midY = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    const snapshot = strokes;
    const dataUrl = exportCanvas.toDataURL('image/png');
    const ok = await onConvertImage(dataUrl, 'image/png', 'handwritten', snapshot);
    if (ok) {
      setUndoSnapshot(snapshot);
      setStrokes([]);
    }
  }, [strokes, isConverting, onConvertImage, cancelAutoTimer]);

  // Auto-convert timer when Auto mode is enabled
  useEffect(() => {
    cancelAutoTimer();
    if (!autoConvert || strokes.length === 0 || isConverting || isDrawingRef.current) {
      return;
    }
    autoTimerRef.current = window.setTimeout(() => {
      void handleConvertAndClear();
    }, 1500);

    return () => cancelAutoTimer();
  }, [autoConvert, strokes, isConverting, handleConvertAndClear, cancelAutoTimer]);

  const handleUndo = useCallback(() => {
    cancelAutoTimer();
    if (strokes.length === 0 && undoSnapshot && undoSnapshot.length > 0) {
      setStrokes(undoSnapshot);
      setUndoSnapshot(null);
      return;
    }
    setStrokes((prev) => prev.slice(0, -1));
  }, [strokes.length, undoSnapshot, cancelAutoTimer]);

  const handleClear = useCallback(() => {
    cancelAutoTimer();
    if (strokes.length > 0) {
      setUndoSnapshot(strokes);
    }
    setStrokes([]);
  }, [strokes, cancelAutoTimer]);

  // Keyboard shortcuts while not typing in an input or inside a modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const el = document.activeElement;
      const activeTag = el?.tagName;
      const inInput =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (inInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleConvertAndClear();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'd') {
          e.preventDefault();
          setTool('pen');
        } else if (key === 'e') {
          e.preventDefault();
          setTool('eraser');
        } else if (key === 'a') {
          e.preventDefault();
          setAutoConvert((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, handleUndo, handleConvertAndClear]);

  const getLocalPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    cancelAutoTimer();
    setUndoSnapshot(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getLocalPoint(e);
    currentStrokeRef.current = {
      points: [pt],
      mode: tool,
      width: tool === 'eraser' ? 20 : 3.2,
    };
    renderCanvas(strokes);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pt = getLocalPoint(e);
    currentStrokeRef.current.points.push(pt);
    renderCanvas(strokes);
  };

  const finishStroke = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (finished.points.length > 0) {
      setStrokes((prev) => [...prev, finished]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) convertFileBlob(file, 'photo');
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) convertFileBlob(file, 'photo');
  };

  // Draw a neat handwritten sample equation ("V1/R1 + V2/R2 = 0") for quick testing
  const loadSampleSketch = () => {
    cancelAutoTimer();
    setUndoSnapshot(null);
    const sampleStrokes: Stroke[] = [
      { mode: 'pen', width: 3.2, points: [{ x: 64, y: 80 }, { x: 76, y: 120 }, { x: 90, y: 80 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 102, y: 106 }, { x: 108, y: 100 }, { x: 108, y: 126 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 58, y: 138 }, { x: 120, y: 138 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 64, y: 186 }, { x: 64, y: 150 }, { x: 84, y: 150 }, { x: 84, y: 168 }, { x: 64, y: 168 }, { x: 86, y: 186 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 100, y: 174 }, { x: 106, y: 168 }, { x: 106, y: 192 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 144, y: 138 }, { x: 172, y: 138 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 158, y: 124 }, { x: 158, y: 152 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 198, y: 80 }, { x: 210, y: 120 }, { x: 224, y: 80 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 232, y: 104 }, { x: 244, y: 102 }, { x: 246, y: 112 }, { x: 232, y: 126 }, { x: 248, y: 126 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 192, y: 138 }, { x: 256, y: 138 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 198, y: 186 }, { x: 198, y: 150 }, { x: 218, y: 150 }, { x: 218, y: 168 }, { x: 198, y: 168 }, { x: 220, y: 186 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 232, y: 172 }, { x: 244, y: 170 }, { x: 246, y: 180 }, { x: 232, y: 192 }, { x: 248, y: 192 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 280, y: 132 }, { x: 308, y: 132 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 280, y: 146 }, { x: 308, y: 146 }] },
      { mode: 'pen', width: 3.2, points: [{ x: 338, y: 118 }, { x: 326, y: 130 }, { x: 326, y: 150 }, { x: 338, y: 158 }, { x: 350, y: 148 }, { x: 350, y: 128 }, { x: 338, y: 118 }] },
    ];
    setStrokes(sampleStrokes);
  };

  const canUndo = strokes.length > 0 || (undoSnapshot !== null && undoSnapshot.length > 0);

  return (
    <section
      aria-label="Write Equations"
      className="flex flex-col h-full bg-white dark:bg-[#171128] min-h-0"
    >
      {/* Clean Pad Toolbar */}
      <div className="px-4 py-3 border-b border-violet-200/80 dark:border-violet-900/60 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-violet-50">
          Write Equations
        </h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center p-0.5 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-[#100b1d]">
            <button
              type="button"
              onClick={() => setTool('pen')}
              aria-pressed={tool === 'pen'}
              title="Pen tool (D)"
              className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                tool === 'pen'
                  ? 'bg-white dark:bg-[#23193e] text-violet-900 dark:text-violet-100 shadow-xs'
                  : 'text-slate-600 dark:text-violet-300/70 hover:text-violet-900 dark:hover:text-violet-100'
              }`}
            >
              <Pen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              aria-pressed={tool === 'eraser'}
              title="Eraser tool (E)"
              className={`min-h-[34px] px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                tool === 'eraser'
                  ? 'bg-white dark:bg-[#23193e] text-violet-900 dark:text-violet-100 shadow-xs'
                  : 'text-slate-600 dark:text-violet-300/70 hover:text-violet-900 dark:hover:text-violet-100'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Eraser</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            aria-label="Undo last stroke"
            title={strokes.length === 0 && undoSnapshot ? 'Restore cleared drawing' : 'Undo (Ctrl+Z)'}
            className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            aria-label="Clear handwriting pad"
            className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoConvert((prev) => !prev)}
            aria-pressed={autoConvert}
            title="Automatically convert & clear 1.5s after you pause writing (A)"
            className={`min-h-[36px] px-2.5 py-1.5 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
              autoConvert
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                : 'border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 text-slate-700 dark:text-violet-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Auto</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isConverting}
            className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-xs font-medium text-slate-700 dark:text-violet-200 inline-flex items-center gap-1.5"
          >
            <ImageUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Photo</span>
          </button>
        </div>
      </div>

      {/* Drawing Surface + Drag & Drop */}
      <div
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragOver) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex-1 min-h-[260px] purple-wave-surface overflow-hidden transition-colors ${
          isDragOver ? 'ring-2 ring-inset ring-violet-500 bg-violet-100/40 dark:bg-violet-950/30' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          data-testid="handwriting-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          className="absolute inset-0 w-full h-full block touch-none cursor-crosshair"
          aria-label="Handwriting equation canvas"
        />

        {strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-violet-100 mb-1">
              {isDragOver
                ? 'Drop image to convert equations'
                : 'Write equations here with your touchpad, mouse, or pen'}
            </p>
            <p className="text-xs text-slate-500 dark:text-violet-300/75 mb-3">
              You can also press <kbd className="px-1 py-0.5 rounded border border-violet-300 dark:border-violet-700 bg-white/80 dark:bg-[#1a132e] font-mono text-[11px]">Ctrl+V</kbd> to paste a screenshot or drop a photo
            </p>
            <button
              type="button"
              onClick={loadSampleSketch}
              className="pointer-events-auto min-h-[36px] px-3.5 py-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-white/95 dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/50 text-xs font-medium text-violet-900 dark:text-violet-100 transition-colors"
            >
              Draw sample equation
            </button>
          </div>
        )}
      </div>

      {/* Error Banner (if any) */}
      {errorMessage && (
        <div
          role="alert"
          className="px-4 py-2 border-t border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 font-medium"
        >
          {errorMessage}
        </div>
      )}

      {/* Primary Convert & Clear Action + Quick Type Casio Calculator */}
      <div className="p-3.5 border-t border-violet-200/80 dark:border-violet-900/60 bg-white dark:bg-[#171128] space-y-2.5">
        <button
          type="button"
          onClick={() => void handleConvertAndClear()}
          disabled={strokes.length === 0 || isConverting}
          className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:from-violet-100 disabled:to-violet-100 disabled:text-violet-400 dark:disabled:from-[#22193b] dark:disabled:to-[#22193b] dark:disabled:text-violet-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
        >
          {isConverting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Converting handwriting...</span>
            </>
          ) : (
            <>
              <span>Convert &amp; Clear Pad</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>

        <CasioMathInput
          id="quick-type-eq"
          ariaLabel="Casio calculator and equation input"
          submitLabel="Add"
          showCalculator
          externalLoad={appliedEquation}
          sheetEquations={sheetEquations}
          onSubmit={(plain, latex) => onAddTypedEquation(plain, latex)}
        />
      </div>
    </section>
  );
};
