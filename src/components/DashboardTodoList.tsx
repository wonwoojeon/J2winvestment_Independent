import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

type TodoItem = {
  id: string;
  text: string;
  createdAt: string;
  completedAt: string | null;
};

type TodoRow = {
  id: string;
  text: string;
  created_at: string;
  completed_at: string | null;
};

const formatTodoDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ko-KR');
};

interface DashboardTodoListProps {
  userId?: string;
  readOnly?: boolean;
}

export const DashboardTodoList: React.FC<DashboardTodoListProps> = ({ userId, readOnly = false }) => {
  const storageKey = useMemo(() => `dashboard_todos_${userId || 'guest'}`, [userId]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadLocalItems = () => {
      if (typeof window === 'undefined') return;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as TodoItem[];
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        } catch (error) {
          console.error('❌ 투두 리스트 로드 실패:', error);
        }
      }
    };

    const loadRemoteItems = async () => {
      if (!userId) return;
      setLoading(true);
      setSyncError(null);
      try {
        const { data, error } = await supabase
          .from('dashboard_todos')
          .select('id, text, created_at, completed_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const rows = (data || []) as TodoRow[];
        setItems(
          rows.map((row) => ({
            id: row.id,
            text: row.text,
            createdAt: row.created_at,
            completedAt: row.completed_at
          }))
        );
      } catch (error) {
        console.error('❌ 투두 리스트 동기화 실패:', error);
        setSyncError('동기화 실패');
        loadLocalItems();
      } finally {
        setLoading(false);
      }
    };

    setItems([]);
    if (userId) {
      loadRemoteItems();
    } else {
      loadLocalItems();
    }
  }, [storageKey, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput, isOpen]);

  const activeItems = items
    .filter((item) => !item.completedAt)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const completedItems = items
    .filter((item) => item.completedAt)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  const handleAddItem = async () => {
    if (readOnly) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (!userId) {
      const nextItem: TodoItem = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
        completedAt: null
      };
      setItems((prev) => [...prev, nextItem]);
      setInputValue('');
      setShowInput(false);
      setIsOpen(true);
      return;
    }

    try {
      setSyncError(null);
      const { data, error } = await supabase
        .from('dashboard_todos')
        .insert({
          user_id: userId,
          text: trimmed,
          created_at: new Date().toISOString(),
          completed_at: null
        })
        .select('id, text, created_at, completed_at')
        .single();
      if (error) throw error;
      const row = data as TodoRow;
      setItems((prev) => [
        ...prev,
        {
          id: row.id,
          text: row.text,
          createdAt: row.created_at,
          completedAt: row.completed_at
        }
      ]);
      setInputValue('');
      setShowInput(false);
      setIsOpen(true);
    } catch (error) {
      console.error('❌ 투두 추가 실패:', error);
      setSyncError('추가 실패');
    }
  };

  const handleToggleComplete = async (id: string, checked: boolean) => {
    if (readOnly) return;
    const completedAt = checked ? new Date().toISOString() : null;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, completedAt }
          : item
      )
    );
    if (!userId) return;
    try {
      setSyncError(null);
      const { error } = await supabase
        .from('dashboard_todos')
        .update({ completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('❌ 완료 상태 업데이트 실패:', error);
      setSyncError('업데이트 실패');
    }
  };

  const startEditing = (item: TodoItem) => {
    if (readOnly) return;
    setEditingId(item.id);
    setEditText(item.text);
    const completedDate = item.completedAt
      ? item.completedAt.split('T')[0]
      : new Date().toISOString().split('T')[0];
    setEditDate(completedDate);
  };

  const handleSaveEdit = async () => {
    if (readOnly) return;
    if (!editingId) return;
    const currentItem = items.find((item) => item.id === editingId);
    if (!currentItem) return;
    const trimmed = editText.trim();
    const nextText = trimmed || currentItem.text;
    const nextCompletedAt = editDate
      ? new Date(editDate).toISOString()
      : currentItem.completedAt;
    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              text: nextText,
              completedAt: nextCompletedAt
            }
          : item
      )
    );
    if (userId) {
      try {
        setSyncError(null);
        const { error } = await supabase
          .from('dashboard_todos')
          .update({
            text: nextText,
            completed_at: nextCompletedAt
          })
          .eq('id', editingId)
          .eq('user_id', userId);
        if (error) throw error;
      } catch (error) {
        console.error('❌ 완료 항목 수정 실패:', error);
        setSyncError('수정 실패');
      }
    }
    setEditingId(null);
  };

  const handleDeleteItem = async (id: string) => {
    if (readOnly) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
    if (!userId) return;
    try {
      setSyncError(null);
      const { error } = await supabase
        .from('dashboard_todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (error) {
      console.error('❌ 완료 항목 삭제 실패:', error);
      setSyncError('삭제 실패');
    }
  };

  return (
    <div className="glass-panel bg-slate-950/40">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-slate-100 font-semibold">To do List</span>
          {loading && <span className="text-xs text-slate-300/60">동기화 중...</span>}
          {syncError && <span className="text-xs text-rose-300">{syncError}</span>}
          <span className="text-xs text-slate-300/70">
            진행 {activeItems.length} · 완료 {completedItems.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-300 hover:bg-slate-800"
              onClick={() => {
                setIsOpen(true);
                setShowInput(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {isOpen ? '접기' : '펼치기'}
            {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {!readOnly && showInput && (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                  if (e.key === 'Escape') {
                    setShowInput(false);
                    setInputValue('');
                  }
                }}
                placeholder="할 일을 입력하세요"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAddItem}
              >
                추가
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {activeItems.length === 0 ? (
              <div className="text-sm text-slate-500">지금은 할 일이 없어요.</div>
            ) : (
              activeItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.completedAt)}
                    onChange={(e) => handleToggleComplete(item.id, e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <span className="flex-1">{item.text}</span>
                  <span className="text-xs text-slate-500">
                    {formatTodoDate(item.createdAt)}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="border-t border-slate-800 pt-2">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
              onClick={() => setCompletedOpen((prev) => !prev)}
            >
              완료 목록 {completedItems.length}개
              {completedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {completedOpen && (
              <div className="mt-3 space-y-2">
                {completedItems.length === 0 ? (
                  <div className="text-sm text-slate-500">완료된 항목이 없습니다.</div>
                ) : (
                  completedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400"
                    >
                      {editingId === item.id && !readOnly ? (
                        <div className="space-y-2">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="bg-slate-800 border-slate-700 text-white"
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="bg-slate-800 border-slate-700 text-white"
                            />
                            <Button
                              type="button"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={handleSaveEdit}
                            >
                              저장
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-700 text-slate-300 hover:bg-slate-800"
                              onClick={() => setEditingId(null)}
                            >
                              취소
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 text-left"
                          onClick={() => startEditing(item)}
                          disabled={readOnly}
                        >
                          <span className="flex-1 line-through">{item.text}</span>
                          {item.completedAt && (
                            <span className="text-xs text-slate-500">
                              완료 {formatTodoDate(item.completedAt)}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
