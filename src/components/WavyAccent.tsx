import React from 'react';

interface WavyHeaderRibbonProps {
  className?: string;
}

/**
 * Multi-layered purple sinusoidal SVG wave ribbon that gives the top header
 * and solver banners an organic wavy purple finish without obstructing controls.
 */
export const WavyHeaderRibbon: React.FC<WavyHeaderRibbonProps> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 1440 42"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`block w-full h-4 sm:h-5 pointer-events-none select-none ${className}`}
  >
    <path
      d="M0,18 C180,42 360,0 560,22 C760,44 960,4 1180,24 C1310,36 1390,18 1440,14 L1440,42 L0,42 Z"
      className="fill-violet-200/55 dark:fill-violet-900/35"
    />
    <path
      d="M0,26 C240,6 440,42 720,20 C980,0 1200,38 1440,22 L1440,42 L0,42 Z"
      className="fill-[#f7f5fc] dark:fill-[#0d0917]"
    />
  </svg>
);

export const WavyDivider: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 1200 24"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`block w-full h-3 pointer-events-none select-none ${className}`}
  >
    <path
      d="M0,12 Q150,2 300,12 T600,12 T900,12 T1200,12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-violet-300/70 dark:text-violet-700/60"
    />
    <path
      d="M0,16 Q150,24 300,16 T600,16 T900,16 T1200,16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-fuchsia-300/55 dark:text-fuchsia-800/45"
    />
  </svg>
);
