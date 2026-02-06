import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Trash2, Edit3, ChevronDown, ChevronUp, MoreVertical, Minus, Type } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { InvestmentScenario } from '@/types/investment';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

type ScenarioStatus = InvestmentScenario['status'];

const statusLabels: Record<ScenarioStatus, string> = {
  open: '진행중',
  confirmed: '확정',
  invalidated: '무효'
};

const statusStyles: Record<ScenarioStatus, string> = {
  open: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
  confirmed: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  invalidated: 'border-rose-500/40 text-rose-400 bg-rose-500/10'
};

const emptyForm = {
  title: '',
  hypothesis: '',
  trigger: '',
  invalidation: '',
  status: 'open' as ScenarioStatus
};

interface ScenarioTrackerProps {
  userId?: string;
  readOnly?: boolean;
}

export const ScenarioTracker: React.FC<ScenarioTrackerProps> = ({ userId, readOnly }) => {
  const [scenarios, setScenarios] = useState<InvestmentScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedScenarios, setExpandedScenarios] = useState<Record<string, boolean>>({});
  const isReadOnly = Boolean(readOnly);
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>(() => {
    if (typeof window === 'undefined') return 'md';
    const saved = window.localStorage.getItem('scenario_tracker_font_scale');
    return saved === 'sm' || saved === 'md' || saved === 'lg' ? saved : 'md';
  });

  useEffect(() => {
    window.localStorage.setItem('scenario_tracker_font_scale', fontScale);
  }, [fontScale]);

  const labelTextClass = fontScale === 'sm' ? 'text-xs' : fontScale === 'md' ? 'text-sm' : 'text-base';
  const bodyTextClass = fontScale === 'sm' ? 'text-sm' : fontScale === 'md' ? 'text-base' : 'text-lg';
  const subTextClass = fontScale === 'sm' ? 'text-xs' : fontScale === 'md' ? 'text-sm' : 'text-base';

  const adjustFontScale = (delta: -1 | 1) => {
    const scaleOrder: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
    const idx = scaleOrder.indexOf(fontScale);
    const next = Math.min(scaleOrder.length - 1, Math.max(0, idx + delta));
    setFontScale(scaleOrder[next]);
  };

  const loadScenarios = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId ?? user?.id;
      if (!targetUserId) {
        setScenarios([]);
        return;
      }
      const { data, error } = await supabase
        .from('investment_scenarios')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenarios((data || []) as InvestmentScenario[]);
    } catch (error) {
      console.error('❌ 시나리오 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenarios();
  }, [userId]);

  useEffect(() => {
    if (isReadOnly) {
      setShowForm(false);
      setEditingId(null);
    }
  }, [isReadOnly]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!form.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingId) {
        const { error } = await supabase
          .from('investment_scenarios')
          .update({
            title: form.title,
            hypothesis: form.hypothesis,
            trigger: form.trigger,
            invalidation: form.invalidation,
            status: form.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('investment_scenarios')
          .insert({
            user_id: user.id,
            title: form.title,
            hypothesis: form.hypothesis,
            trigger: form.trigger,
            invalidation: form.invalidation,
            status: form.status
          });
        if (error) throw error;
      }

      resetForm();
      setShowForm(false);
      loadScenarios();
    } catch (error) {
      console.error('❌ 시나리오 저장 실패:', error);
      alert('시나리오 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (scenario: InvestmentScenario) => {
    if (isReadOnly) return;
    setEditingId(scenario.id);
    setForm({
      title: scenario.title,
      hypothesis: scenario.hypothesis || '',
      trigger: scenario.trigger || '',
      invalidation: scenario.invalidation || '',
      status: scenario.status
    });
    setShowForm(true);
  };

  const handleDelete = async (scenarioId: string) => {
    if (isReadOnly) return;
    if (!confirm('이 시나리오를 삭제할까요?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('investment_scenarios')
        .delete()
        .eq('id', scenarioId)
        .eq('user_id', user.id);
      if (error) throw error;
      loadScenarios();
    } catch (error) {
      console.error('❌ 시나리오 삭제 실패:', error);
      alert('시나리오 삭제에 실패했습니다.');
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setExpandedScenarios(prev => ({
      ...prev,
      [scenarioId]: !prev[scenarioId]
    }));
  };

  const formatScenarioDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl">
      <CardHeader className="pb-3 border-b border-slate-800/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-slate-100 flex items-center gap-2 break-keep">
            시나리오 트래커
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              onClick={loadScenarios}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            {!isReadOnly && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowForm(prev => !prev);
                  if (showForm) resetForm();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                새 시나리오
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {showForm && !isReadOnly && (
        <CardContent className="pt-4 space-y-4 border-b border-slate-800/50">
          <div className="space-y-2">
            <Label className={`text-slate-400 ${labelTextClass}`}>제목</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              className={`bg-slate-800 border-slate-700 text-white ${bodyTextClass}`}
              placeholder="핵심 시나리오 한 줄"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className={`text-slate-400 ${labelTextClass}`}>가정</Label>
              <Textarea
                value={form.hypothesis}
                onChange={(e) => setForm(prev => ({ ...prev, hypothesis: e.target.value }))}
                className={`bg-slate-800 border-slate-700 text-white min-h-[120px] ${bodyTextClass}`}
                placeholder="핵심 가정"
              />
            </div>
            <div className="space-y-2">
              <Label className={`text-slate-400 ${labelTextClass}`}>트리거</Label>
              <Textarea
                value={form.trigger}
                onChange={(e) => setForm(prev => ({ ...prev, trigger: e.target.value }))}
                className={`bg-slate-800 border-slate-700 text-white min-h-[120px] ${bodyTextClass}`}
                placeholder="확인해야 할 신호"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className={`text-slate-400 ${labelTextClass}`}>무효화 조건</Label>
            <Textarea
              value={form.invalidation}
              onChange={(e) => setForm(prev => ({ ...prev, invalidation: e.target.value }))}
              className={`bg-slate-800 border-slate-700 text-white min-h-[100px] ${bodyTextClass}`}
              placeholder="시나리오가 깨지는 조건"
            />
          </div>
          <div className="space-y-2">
            <Label className={`text-slate-400 ${labelTextClass}`}>상태</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm(prev => ({ ...prev, status: value as ScenarioStatus }))}
            >
              <SelectTrigger className={`bg-slate-800 border-slate-700 text-white ${bodyTextClass}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">진행중</SelectItem>
                <SelectItem value="confirmed">확정</SelectItem>
                <SelectItem value="invalidated">무효</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? '저장 중...' : editingId ? '수정 완료' : '저장'}
            </Button>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              취소
            </Button>
          </div>
        </CardContent>
      )}

      <CardContent className="pt-4 space-y-3">
        {loading ? (
          <div className={`text-slate-500 ${labelTextClass} flex items-center gap-2`}>
            <RefreshCw className="h-4 w-4 animate-spin" />
            시나리오를 불러오는 중...
          </div>
        ) : scenarios.length === 0 ? (
          <div className={`text-slate-500 ${labelTextClass}`}>
            아직 등록된 시나리오가 없습니다.
          </div>
        ) : (
          scenarios.slice(0, 5).map((scenario) => {
            const isExpanded = !!expandedScenarios[scenario.id];
            return (
              <div key={scenario.id} className="bg-slate-950/40 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 w-full">
                    <div
                      className={`text-slate-100 font-semibold ${bodyTextClass} ${
                        isExpanded ? 'whitespace-normal break-words' : 'truncate'
                      }`}
                    >
                      {scenario.title}
                    </div>
                    <div className={`${subTextClass} text-slate-400 mt-1`}>
                      작성일: {formatScenarioDate(scenario.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap">
                    <Badge variant="outline" className={`${subTextClass} shrink-0 ${statusStyles[scenario.status]}`}>
                      {statusLabels[scenario.status]}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white shrink-0 whitespace-nowrap px-2"
                      onClick={() => toggleScenario(scenario.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">접기</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">펼치기</span>
                        </>
                      )}
                    </Button>
                  {!isReadOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-white shrink-0 px-2"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">더보기</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-slate-900 border-slate-700 text-slate-200"
                      >
                        <DropdownMenuItem
                          onClick={() => handleEdit(scenario)}
                          className="cursor-pointer focus:bg-slate-800"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(scenario.id)}
                          className="cursor-pointer text-rose-400 focus:text-rose-300 focus:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                </div>
                {isExpanded && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-end">
                      <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1 py-1">
                        <Type className="h-3.5 w-3.5 text-slate-300" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                          onClick={() => adjustFontScale(-1)}
                          disabled={fontScale === 'sm'}
                          aria-label="글자 크기 줄이기"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="px-1 text-xs text-slate-300">{fontScale.toUpperCase()}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800"
                          onClick={() => adjustFontScale(1)}
                          disabled={fontScale === 'lg'}
                          aria-label="글자 크기 키우기"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {scenario.hypothesis && (
                      <div className={`${subTextClass} text-slate-400 whitespace-pre-wrap`}>
                        가정: {scenario.hypothesis}
                      </div>
                    )}
                    {scenario.trigger && (
                      <div className={`${subTextClass} text-slate-400 whitespace-pre-wrap`}>
                        트리거: {scenario.trigger}
                      </div>
                    )}
                    {scenario.invalidation && (
                      <div className={`${subTextClass} text-slate-400 whitespace-pre-wrap`}>
                        무효화: {scenario.invalidation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
