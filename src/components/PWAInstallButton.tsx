import React, { useState } from 'react';
import { MonitorDown } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install app locally"
        className="min-h-[38px] px-3 py-1.5 rounded-md border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <MonitorDown className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[38px] px-3 py-1.5 rounded-md border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <MonitorDown className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          >
            <div className="w-full max-w-sm rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-[#171128] p-5 shadow-xl">
              <h3
                id="ios-install-title"
                className="text-base font-semibold text-slate-900 dark:text-violet-50"
              >
                Install Lecture Scratchpad
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-violet-200/80">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong> to use Lecture Scratchpad locally offline.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full min-h-[38px] rounded-md bg-violet-600 hover:bg-violet-700 text-xs font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
