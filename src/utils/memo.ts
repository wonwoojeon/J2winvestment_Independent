import type { MemoEntry } from '@/types/investment';

export const normalizeMemoEntries = (
  memo?: MemoEntry[] | string | null
): MemoEntry[] => {
  if (!memo) return [];
  if (Array.isArray(memo)) {
    return memo
      .map((entry) => ({
        text: typeof entry?.text === 'string' ? entry.text : '',
        isImportant: Boolean(entry?.isImportant),
        importantTag: typeof entry?.importantTag === 'string' ? entry.importantTag : '',
      }))
      .filter((entry) => entry.text.trim() || entry.importantTag?.trim());
  }
  if (typeof memo === 'string') {
    const trimmed = memo.trim();
    if (!trimmed) return [];
    const looksJson = trimmed.startsWith('[') || trimmed.startsWith('{');
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeMemoEntries(parsed as MemoEntry[]);
        }
      } catch {
        // fall through to secondary unescape
      }
      try {
        const unescaped = trimmed
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"');
        const parsed = JSON.parse(unescaped);
        if (Array.isArray(parsed)) {
          return normalizeMemoEntries(parsed as MemoEntry[]);
        }
      } catch {
        // fall through to treat as plain text
      }
    }
    return [{ text: trimmed, isImportant: false, importantTag: '' }];
  }
  return [];
};

export const buildMemoEntries = (
  text: string,
  isImportant: boolean,
  importantTag: string
): MemoEntry[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return [
    {
      text: trimmed,
      isImportant,
      importantTag: isImportant ? importantTag.trim() : '',
    },
  ];
};

export const getMemoText = (memo?: MemoEntry[] | string | null): string => {
  return normalizeMemoEntries(memo)
    .map((entry) => entry.text)
    .filter(Boolean)
    .join('\n');
};

export const getMemoPreview = (
  memo?: MemoEntry[] | string | null,
  maxLength = 80
): string => {
  const text = getMemoText(memo);
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

export const getImportantMemoTag = (memo?: MemoEntry[] | string | null): string => {
  const entry = normalizeMemoEntries(memo).find(
    (item) => item.isImportant && item.importantTag?.trim()
  );
  return entry?.importantTag?.trim() || '';
};

export const hasImportantMemo = (memo?: MemoEntry[] | string | null): boolean => {
  return normalizeMemoEntries(memo).some((item) => item.isImportant);
};
