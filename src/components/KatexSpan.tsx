import React, { useMemo } from 'react';
import katex from 'katex';

interface KatexSpanProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const KatexSpan: React.FC<KatexSpanProps> = React.memo(
  ({ latex, displayMode = false, className = '' }) => {
    const html = useMemo(() => {
      if (!latex.trim()) return '';
      try {
        return katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: false,
        });
      } catch {
        return '';
      }
    }, [latex, displayMode]);

    if (!html) return null;

    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);

KatexSpan.displayName = 'KatexSpan';
