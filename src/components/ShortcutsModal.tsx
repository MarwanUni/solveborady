import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import { ShortcutDoc } from '../types';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_ITEMS: ShortcutDoc[] = [
  // Handwriting Pad
  { keys: 'Ctrl + V', action: 'Paste screenshot or image onto pad to convert', category: 'Handwriting Pad' },
  { keys: 'Ctrl + Enter', action: 'Convert handwriting & clear pad', category: 'Handwriting Pad' },
  { keys: 'Ctrl + Z', action: 'Undo last stroke (or restore cleared pad)', category: 'Handwriting Pad' },
  { keys: 'D', action: 'Switch to Pen tool', category: 'Handwriting Pad' },
  { keys: 'E', action: 'Switch to Eraser tool', category: 'Handwriting Pad' },
  { keys: 'A', action: 'Toggle Auto-convert (1.5s pause)', category: 'Handwriting Pad' },

  // Typing & Equations
  { keys: '/ , ^ , _', action: 'Insert stacked fraction (x above y), power, or subscript', category: 'Typing & Equations' },
  { keys: '← ↑ ↓ →', action: 'Navigate inside fraction numerator, denominator, or powers', category: 'Typing & Equations' },
  { keys: 'Enter', action: 'Add typed equation or save inline edit', category: 'Typing & Equations' },
  { keys: 'Esc', action: 'Cancel inline edit or close modal', category: 'Typing & Equations' },
  { keys: ':w, :th, :ohm, :mu', action: 'Expand Greek & EE symbols as you type', category: 'Typing & Equations' },

  // Workspace & Export
  { keys: '?', action: 'Open or close this keyboard shortcuts modal', category: 'Workspace & Export' },
  { keys: 'Alt + M', action: 'Switch between Write/Casio Calc and Matrix Solver', category: 'Workspace & Export' },
  { keys: 'Alt + B', action: 'Move Equations bar between Left and Right side', category: 'Workspace & Export' },
  { keys: 'Alt + S', action: 'Open Download for Local PC modal (.html, .tex, .md, .json)', category: 'Workspace & Export' },
  { keys: 'Alt + P', action: 'Print / save equations as PDF', category: 'Workspace & Export' },
  { keys: 'Alt + J', action: 'Toggle Light / Dark theme', category: 'Workspace & Export' },
  { keys: 'Alt + O', action: 'Toggle Local (offline) recognition mode', category: 'Workspace & Export' },
];

const CATEGORIES: Array<'Handwriting Pad' | 'Typing & Equations' | 'Workspace & Export'> = [
  'Handwriting Pad',
  'Typing & Equations',
  'Workspace & Export',
];

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null
  );
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const rafId = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !dialogRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown, true);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        aria-describedby="shortcuts-modal-desc"
        className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#171128] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-violet-200/80 dark:border-violet-800/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard
              className="w-4 h-4 text-violet-600 dark:text-violet-400"
              aria-hidden="true"
            />
            <div>
              <h2
                id="shortcuts-modal-title"
                className="text-sm font-semibold text-slate-900 dark:text-violet-50"
              >
                Keyboard Shortcuts
              </h2>
              <p
                id="shortcuts-modal-desc"
                className="text-xs text-slate-500 dark:text-violet-300/75"
              >
                Single-key shortcuts apply when focus is outside text boxes.
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="min-h-[36px] min-w-[36px] rounded-md border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#1d1533] hover:bg-violet-50 dark:hover:bg-violet-900/50 text-slate-600 dark:text-violet-200 inline-flex items-center justify-center"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {CATEGORIES.map((category) => {
            const items = SHORTCUT_ITEMS.filter((s) => s.category === category);
            return (
              <section key={category} aria-label={category}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-violet-700/80 dark:text-violet-300/80 mb-1.5">
                  {category}
                </h3>
                <div className="divide-y divide-violet-100 dark:divide-violet-800/60 rounded-md border border-violet-200 dark:border-violet-800/70">
                  {items.map((item) => (
                    <div
                      key={item.keys}
                      className="px-3.5 py-1.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="text-slate-700 dark:text-violet-100">
                        {item.action}
                      </span>
                      <kbd className="px-2 py-0.5 rounded border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-[#120d21] font-mono text-[11px] font-medium text-violet-900 dark:text-violet-200 whitespace-nowrap shrink-0">
                        {item.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-violet-200/80 dark:border-violet-800/70 bg-violet-50/70 dark:bg-[#120d21] flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-500 dark:text-violet-300/80">
            Press <kbd className="px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-700 bg-white dark:bg-[#1d1533] font-mono text-[11px]">Esc</kbd> or <kbd className="px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-700 bg-white dark:bg-[#1d1533] font-mono text-[11px]">?</kbd> to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
