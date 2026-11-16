import React, { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  FileJson,
  FileText,
  Info,
  X,
} from 'lucide-react';
import { ReadableEquation } from '../types';
import { buildDownloadPayload } from '../utils/mathContext';
import {
  buildJsonBackupPayload,
  buildPortableOfflineAppHtml,
} from '../utils/portableExport';

interface DownloadLocalModalProps {
  isOpen: boolean;
  equations: ReadableEquation[];
  onClose: () => void;
}

function triggerFileDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const DownloadLocalModal: React.FC<DownloadLocalModalProps> = ({
  isOpen,
  equations,
  onClose,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const raf = window.requestAnimationFrame(() => closeBtnRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const downloadOfflineHtmlApp = () => {
    const html = buildPortableOfflineAppHtml(equations);
    triggerFileDownload(
      'lecture-scratchpad-local.html',
      'text/html;charset=utf-8',
      html
    );
  };

  const downloadLatex = () => {
    const p = buildDownloadPayload(equations, 'latex');
    triggerFileDownload(p.filename, p.mimeType, p.content);
  };

  const downloadMarkdown = () => {
    const p = buildDownloadPayload(equations, 'markdown');
    triggerFileDownload(p.filename, p.mimeType, p.content);
  };

  const downloadJson = () => {
    const json = buildJsonBackupPayload(equations);
    triggerFileDownload(
      'lecture-scratchpad-backup.json',
      'application/json;charset=utf-8',
      json
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-local-title"
        data-testid="download-local-modal"
        className="w-full max-w-xl rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#171128] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-violet-200/80 dark:border-violet-800/70 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" aria-hidden="true" />
            <h2 id="download-local-title" className="text-sm font-semibold">
              Download Files for Your PC
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close download modal"
            className="min-h-[32px] min-w-[32px] rounded-md bg-white/15 hover:bg-white/25 text-white inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Primary Offline Standalone PC Workbook */}
          <div className="rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50/70 dark:bg-violet-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-violet-950 dark:text-violet-100">
                Offline Local PC Workbook (.html)
              </div>
              <p className="text-xs text-slate-600 dark:text-violet-200/80">
                Single self-contained file with your saved equations, interactive Matrix Solver, and expression calculator. Double-click it on your PC — works with zero internet or server.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadOfflineHtmlApp}
              data-testid="download-offline-html-btn"
              className="min-h-[40px] px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Download .HTML</span>
            </button>
          </div>

          {/* Document & Backup Formats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={downloadLatex}
              disabled={equations.length === 0}
              className="min-h-[44px] px-3 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-left space-y-0.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-violet-100">
                <FileCode2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                <span>LaTeX (.tex)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-violet-300/70">
                For Overleaf / TeX
              </div>
            </button>

            <button
              type="button"
              onClick={downloadMarkdown}
              disabled={equations.length === 0}
              className="min-h-[44px] px-3 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 disabled:opacity-40 text-left space-y-0.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-violet-100">
                <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                <span>Markdown (.md)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-violet-300/70">
                Obsidian / Notion
              </div>
            </button>

            <button
              type="button"
              onClick={downloadJson}
              className="min-h-[44px] px-3 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/40 text-left space-y-0.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-violet-100">
                <FileJson className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                <span>Backup (.json)</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-violet-300/70">
                Raw equations data
              </div>
            </button>
          </div>

          {/* Honest Local PC Disclosure */}
          <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-slate-50 dark:bg-[#110c20] p-3.5 space-y-2 text-xs">
            <div className="font-semibold text-slate-800 dark:text-violet-100 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
              <span>What works locally on your PC vs what needs internet:</span>
            </div>
            <ul className="space-y-1 text-slate-600 dark:text-violet-200/80">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>100% Local &amp; Offline:</strong> Matrix Solver (RREF), Casio Natural-Display Calculator, drawing pad in Local Mode, PWA install, and the downloaded <code>.html</code> file.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <strong>Needs Server + API Key:</strong> Uploading a Photo / Screenshot (<code>Ctrl+V</code>) for AI OCR calls <code>/api/recognize-math</code> using <code>GEMINI_API_KEY</code>. Everything else runs offline on your PC.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
