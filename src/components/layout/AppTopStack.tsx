import React, { ReactNode } from 'react';

interface AppTopStackProps {
  header?: ReactNode;
  ticker: ReactNode;
  compact?: boolean;
  headerHidden?: boolean;
  tickerHidden?: boolean;
}

export const AppTopStack: React.FC<AppTopStackProps> = ({
  header,
  ticker,
  compact = false,
  headerHidden: _headerHidden = false,
  tickerHidden = false
}) => {
  // Keep ticker anchored under the header slot even when header hides on scroll.
  // This prevents overlap/flicker and keeps ticker permanently visible.
  const anchoredToHeader = Boolean(header);
  const topVar = compact
    ? anchoredToHeader
      ? 'var(--verse-top-compact-with-header)'
      : 'var(--verse-top-compact)'
    : anchoredToHeader
      ? 'var(--verse-top-expanded-with-header)'
      : 'var(--verse-top-expanded)';

  return (
    <>
      {header}
      <div
        data-testid="floating-verse-ticker"
        className={`fixed left-1/2 z-[80] w-[min(1200px,94vw)] -translate-x-1/2 px-2 transition-all duration-300 ${
          tickerHidden ? 'opacity-0 pointer-events-none -translate-y-2' : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
        style={{ top: topVar }}
      >
        {ticker}
      </div>
    </>
  );
};
