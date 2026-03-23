export const parseNumberInputValue = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatZeroableNumberInput = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value) || value === 0) {
    return '';
  }

  return String(value);
};

export const journalFormTone = {
  pageShell:
    'min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 pb-20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-200',
  stickyHeader:
    'bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm dark:bg-slate-950/80 dark:border-slate-800 dark:shadow-none',
  panel:
    'border border-slate-200/80 bg-white/90 text-slate-900 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.8)]',
  subPanel:
    'rounded-xl border border-slate-200/70 bg-white/80 p-1 overflow-hidden dark:border-slate-800 dark:bg-slate-900',
  input:
    'border-slate-300 bg-white text-slate-950 placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500',
  readOnlyInput:
    'border-slate-200 bg-slate-50 text-slate-900 font-bold font-mono dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
  label:
    'text-slate-600 dark:text-slate-400',
  sectionTitle:
    'text-slate-900 dark:text-slate-100',
  helperText:
    'text-slate-500 dark:text-slate-400',
  checklistInput:
    'bg-transparent border-0 border-b border-slate-300 rounded-none px-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500',
  assetValue:
    'rounded bg-slate-50 px-2 py-1 text-right text-sm font-medium text-slate-900 dark:bg-slate-950/80 dark:text-slate-100',
  outlineButton:
    'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
  checkbox:
    'rounded border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-800',
} as const;
