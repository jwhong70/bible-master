'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Layers,
  RotateCcw,
  Settings,
  Sparkles,
  ExternalLink,
  Check,
  Filter,
  BookmarkCheck,
  Calendar,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buildAllBiblePlans,
  computeBibleSlidingTodo,
  DEFAULT_BIBLE_SETTINGS,
  loadLocalBibleProgress,
  loadLocalBibleSettings,
  saveLocalBibleProgress,
  saveLocalBibleSettings,
  TRACK_INFO,
  updatePlanCompletion,
} from '@/lib/bibleCurriculum';
import { BibleCategory, BiblePlanItem, BibleStudySettings } from '@/types/bible';

export default function BibleDashboardClient() {
  const [settings, setSettings] = useState<BibleStudySettings>(DEFAULT_BIBLE_SETTINGS);
  const [plans, setPlans] = useState<BiblePlanItem[]>(() => buildAllBiblePlans({}));
  const [isHydrated, setIsHydrated] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [viewTab, setViewTab] = useState<'todo' | 'curriculum'>('todo');
  const [selectedTrack, setSelectedTrack] = useState<
    'all' | 'new_testament' | 'wisdom' | 'old_testament'
  >('all');
  const [curriculumFilter, setCurriculumFilter] = useState<
    'all' | 'ready' | 'reviewing' | 'graduated'
  >('all');

  // 설정 임시 폼 상태
  const [draftDailyNt, setDraftDailyNt] = useState(1);
  const [draftDailyWd, setDraftDailyWd] = useState(1);
  const [draftDailyOt, setDraftDailyOt] = useState(1);
  const [draftReviewCount, setDraftReviewCount] = useState(1);

  useEffect(() => {
    const localSet = loadLocalBibleSettings();
    const localProg = loadLocalBibleProgress();
    setSettings(localSet);
    setPlans(buildAllBiblePlans(localProg));
    setDraftDailyNt(localSet.daily_nt_count);
    setDraftDailyWd(localSet.daily_wd_count);
    setDraftDailyOt(localSet.daily_ot_count);
    setDraftReviewCount(localSet.review_count);
    if (localSet.active_track) {
      setSelectedTrack(localSet.active_track);
    }
    setIsHydrated(true);
  }, []);

  const totalRequired = 1 + Math.max(0, settings.review_count);

  const ntStats = useMemo(
    () => computeBibleSlidingTodo(plans, settings, 'new_testament'),
    [plans, settings]
  );
  const wdStats = useMemo(
    () => computeBibleSlidingTodo(plans, settings, 'wisdom'),
    [plans, settings]
  );
  const otStats = useMemo(
    () => computeBibleSlidingTodo(plans, settings, 'old_testament'),
    [plans, settings]
  );

  // 통합 또는 개별 트랙 To-Do 리스트
  const activeTodoList = useMemo(() => {
    if (selectedTrack === 'new_testament') return ntStats.todoPlans;
    if (selectedTrack === 'wisdom') return wdStats.todoPlans;
    if (selectedTrack === 'old_testament') return otStats.todoPlans;
    // 'all' 통합 모드: 각 트랙의 오늘의 플랜을 묶어서 보여줌
    return [...ntStats.todoPlans, ...wdStats.todoPlans, ...otStats.todoPlans];
  }, [selectedTrack, ntStats, wdStats, otStats]);

  // 전체 통독 진도 통계
  const totalPlansCount = ntStats.totalPlans + wdStats.totalPlans + otStats.totalPlans;
  const totalGraduated = ntStats.graduatedCount + wdStats.graduatedCount + otStats.graduatedCount;
  const totalInReview = ntStats.inReviewCount + wdStats.inReviewCount + otStats.inReviewCount;
  const overallPercent = totalPlansCount > 0 ? Math.round((totalGraduated / totalPlansCount) * 100) : 0;

  const handleTrackChange = (track: 'all' | 'new_testament' | 'wisdom' | 'old_testament') => {
    setSelectedTrack(track);
    const next = { ...settings, active_track: track };
    setSettings(next);
    saveLocalBibleSettings(next);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const next: BibleStudySettings = {
      ...settings,
      daily_nt_count: Math.max(1, Math.min(10, Number(draftDailyNt) || 1)),
      daily_wd_count: Math.max(1, Math.min(10, Number(draftDailyWd) || 1)),
      daily_ot_count: Math.max(1, Math.min(10, Number(draftDailyOt) || 1)),
      review_count: Math.max(0, Math.min(5, Number(draftReviewCount) || 1)),
      active_track: selectedTrack,
    };
    setSettings(next);
    saveLocalBibleSettings(next);
    setShowSettingsModal(false);
    toast.success(
      `통독 진도 설정 완료: 하루 신약 ${next.daily_nt_count}개 · 시가서 ${next.daily_wd_count}개 · 구약 ${next.daily_ot_count}개 (총 ${1 + next.review_count}회독 목표)`
    );
  };

  const handleQuickIncrement = (e: React.MouseEvent, plan: BiblePlanItem) => {
    e.preventDefault();
    e.stopPropagation();
    const updatedMap = updatePlanCompletion(plan.id, 1);
    setPlans(buildAllBiblePlans(updatedMap));
    const nextCount = (plan.completed_count || 0) + 1;
    if (nextCount >= totalRequired) {
      toast.success(`🎉 '${plan.title}' 통독 목표(${totalRequired}회독)를 완독했습니다!`);
    } else {
      toast.success(`📖 '${plan.title}' ${nextCount}회독 읽기 완료`);
    }
  };

  const handleResetProgress = () => {
    if (
      window.confirm(
        '모든 통독 진도(읽은 기록)를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
      )
    ) {
      saveLocalBibleProgress({});
      setPlans(buildAllBiblePlans({}));
      toast.info('성경 통독 진도가 초기화되었습니다.');
    }
  };

  // 전체 목차 필터링
  const filteredCurriculumPlans = useMemo(() => {
    let list = plans;
    if (selectedTrack !== 'all') {
      list = list.filter((p) => p.category === selectedTrack);
    }
    if (curriculumFilter === 'ready') {
      list = list.filter((p) => p.completed_count === 0);
    } else if (curriculumFilter === 'reviewing') {
      list = list.filter((p) => p.completed_count > 0 && p.completed_count < totalRequired);
    } else if (curriculumFilter === 'graduated') {
      list = list.filter((p) => p.completed_count >= totalRequired);
    }
    return list;
  }, [plans, selectedTrack, curriculumFilter, totalRequired]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* 1. 상단 브랜드 헤더 */}
      <header className="rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#18181f] via-[#121217] to-[#0d0d10] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-[#FDE68A] border border-[#D4AF37]/30">
                <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                52주 말씀 통독 & 송태근 목사 강해
              </span>
              <span className="text-xs text-zinc-400">총 808개 일일 플랜</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              BIBLE MASTER <span className="text-[#D4AF37]">성경 통독 마스터</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              신약 277일 · 시가서 239일 · 구약 292일 | 누적 복습 슬라이딩 진도표
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#1f1f27] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition-all hover:border-[#D4AF37]/40 hover:text-white cursor-pointer"
            >
              <Settings className="h-4 w-4 text-[#D4AF37]" />
              진도 설정 ({totalRequired}회독 목표)
            </button>
          </div>
        </div>

        {/* 종합 진도율 바 */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-2xl bg-[#0a0a0d] p-3 border border-white/5">
            <div className="text-xs text-zinc-400">전체 통독 진도</div>
            <div className="mt-1 text-lg font-black text-[#FDE68A]">{overallPercent}%</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {totalGraduated} / {totalPlansCount}개 완독
            </div>
          </div>
          <div className="rounded-2xl bg-[#0a0a0d] p-3 border border-white/5">
            <div className="text-xs text-zinc-400">오늘의 To-Do</div>
            <div className="mt-1 text-lg font-black text-white">{activeTodoList.length}개</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">슬라이딩 대기</div>
          </div>
          <div className="rounded-2xl bg-[#0a0a0d] p-3 border border-white/5">
            <div className="text-xs text-zinc-400">복습 진행 중</div>
            <div className="mt-1 text-lg font-black text-[#38BDF8]">{totalInReview}개</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">1회독 완료</div>
          </div>
          <div className="rounded-2xl bg-[#0a0a0d] p-3 border border-white/5">
            <div className="text-xs text-zinc-400">완독 졸업</div>
            <div className="mt-1 text-lg font-black text-[#10B981]">{totalGraduated}개</div>
            <div className="mt-0.5 text-[11px] text-zinc-500">목표 달성</div>
          </div>
        </div>
      </header>

      {/* 2. 트랙 선택 탭 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => handleTrackChange('all')}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTrack === 'all'
              ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-white shadow-lg shadow-[#D4AF37]/10'
              : 'border-white/10 bg-[#131318] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>🌟</span> 통합 3대 트랙
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">신약+시가서+구약 동시</div>
          </div>
          <span className="text-xs font-black text-[#FDE68A]">{totalPlansCount}개</span>
        </button>

        <button
          onClick={() => handleTrackChange('new_testament')}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTrack === 'new_testament'
              ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-white shadow-lg shadow-[#D4AF37]/10'
              : 'border-white/10 bg-[#131318] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>✝️</span> 신약 277일
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              완독 {ntStats.graduatedCount}/{ntStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-[#D4AF37]">
            {ntStats.todoPlans.length} To-Do
          </span>
        </button>

        <button
          onClick={() => handleTrackChange('wisdom')}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTrack === 'wisdom'
              ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-white shadow-lg shadow-[#38BDF8]/10'
              : 'border-white/10 bg-[#131318] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>📜</span> 시가서 239일
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              완독 {wdStats.graduatedCount}/{wdStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-[#38BDF8]">
            {wdStats.todoPlans.length} To-Do
          </span>
        </button>

        <button
          onClick={() => handleTrackChange('old_testament')}
          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
            selectedTrack === 'old_testament'
              ? 'border-[#A78BFA] bg-[#A78BFA]/15 text-white shadow-lg shadow-[#A78BFA]/10'
              : 'border-white/10 bg-[#131318] text-zinc-400 hover:text-white hover:border-white/20'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>🏛️</span> 구약 292일
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              완독 {otStats.graduatedCount}/{otStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-[#A78BFA]">
            {otStats.todoPlans.length} To-Do
          </span>
        </button>
      </div>

      {/* 3. 뷰 탭 (To-Do 진도표 vs 전체 목차) */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewTab('todo')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              viewTab === 'todo'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-zinc-400 hover:text-white bg-white/5'
            }`}
          >
            📋 오늘의 To-Do 진도표 ({activeTodoList.length})
          </button>
          <button
            onClick={() => setViewTab('curriculum')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              viewTab === 'curriculum'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-zinc-400 hover:text-white bg-white/5'
            }`}
          >
            📚 전체 통독 목차 ({filteredCurriculumPlans.length})
          </button>
        </div>

        {viewTab === 'curriculum' && (
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={curriculumFilter}
              onChange={(e) => setCurriculumFilter(e.target.value as any)}
              className="bg-[#18181f] border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="all">전체 상태</option>
              <option value="ready">신규 대기 (0회)</option>
              <option value="reviewing">복습 중 (1회)</option>
              <option value="graduated">완독 완료 ({totalRequired}회)</option>
            </select>
          </div>
        )}
      </div>

      {/* 4-A. 오늘의 To-Do 진도표 렌더링 */}
      {viewTab === 'todo' && (
        <div className="space-y-3">
          {activeTodoList.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#131318] p-12 text-center">
              <BookmarkCheck className="h-12 w-12 text-[#10B981] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">오늘의 통독 To-Do를 모두 완료했습니다!</h3>
              <p className="mt-1 text-xs text-zinc-400">
                새로운 진도를 시작하려면 진도 설정을 변경하거나 [전체 통독 목차]에서 원하는 플랜을 읽어보세요.
              </p>
            </div>
          ) : (
            activeTodoList.map((plan) => {
              const info = TRACK_INFO[plan.category];
              const isGraduated = plan.completed_count >= totalRequired;
              const isFresh = plan.completed_count === 0;

              return (
                <div
                  key={plan.id}
                  className="group relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/10 bg-[#141419] p-4 sm:p-5 transition-all hover:border-[#D4AF37]/40 hover:bg-[#181820]"
                >
                  <Link
                    href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                    className="flex-1 space-y-2 cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-lg px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: `${info.color}20`,
                          color: info.color,
                          border: `1px solid ${info.color}40`,
                        }}
                      >
                        {info.icon} {info.shortName}
                      </span>
                      <span className="text-xs font-mono font-semibold text-zinc-400">
                        {plan.week}주차 {plan.day}일차 [{plan.week}.{plan.day}]
                      </span>
                      {plan.sermon_url && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">
                          🎙️ 송태근 목사 강해
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#FDE68A] transition-colors">
                        {plan.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {plan.verse_count}개 절 · {plan.paragraph_count}개 단락
                        {plan.sermon_title && ` · ${plan.sermon_title}`}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                    {/* 회독 배지 */}
                    <div className="text-right mr-1">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          isGraduated
                            ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                            : isFresh
                            ? 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/30'
                            : 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                        }`}
                      >
                        {isGraduated
                          ? '완독 완수'
                          : isFresh
                          ? '신규 읽기'
                          : `${plan.completed_count}/${totalRequired} 복습`}
                      </span>
                    </div>

                    {/* 빠른 읽기 완료 체크 버튼 */}
                    <button
                      onClick={(e) => handleQuickIncrement(e, plan)}
                      title="오늘 통독 1회 완료 체크"
                      className="p-2.5 rounded-xl border border-white/10 bg-[#1c1c24] text-zinc-300 hover:text-white hover:border-[#10B981]/50 hover:bg-[#10B981]/10 transition-all cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    {/* 본문 읽기 버튼 */}
                    <Link
                      href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] px-4 py-2.5 text-xs font-bold text-black shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <span>말씀 읽기</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4-B. 전체 통독 목차 렌더링 */}
      {viewTab === 'curriculum' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCurriculumPlans.map((plan) => {
            const info = TRACK_INFO[plan.category];
            const isGraduated = plan.completed_count >= totalRequired;

            return (
              <Link
                key={plan.id}
                href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                className="group flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-[#141419] hover:border-[#D4AF37]/40 hover:bg-[#181820] transition-all cursor-pointer"
              >
                <div className="space-y-1 overflow-hidden pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${info.color}15`,
                        color: info.color,
                      }}
                    >
                      {info.shortName} {plan.week}주 {plan.day}일
                    </span>
                    {plan.sermon_url && (
                      <span className="text-[10px] text-red-400">🎙️ 강해</span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#FDE68A] truncate transition-colors">
                    {plan.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    {plan.verse_count}개 절 · {plan.paragraph_count}개 단락
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isGraduated
                        ? 'bg-[#10B981]/20 text-[#10B981]'
                        : plan.completed_count > 0
                        ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                        : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    {plan.completed_count}/{totalRequired}회
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-white transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 5. 진도 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-[#D4AF37]/40 bg-[#16161c] p-6 text-white shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-[#FDE68A] flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#D4AF37]" />
                성경 통독 진도 설정
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  ✝️ 하루 신약 통독 분량 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyNt}
                  onChange={(e) => setDraftDailyNt(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0e0e12] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  📜 하루 시가서 통독 분량 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyWd}
                  onChange={(e) => setDraftDailyWd(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0e0e12] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  🏛️ 하루 구약 통독 분량 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyOt}
                  onChange={(e) => setDraftDailyOt(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0e0e12] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  🔁 통독 완독 목표 회차
                </label>
                <select
                  value={draftReviewCount}
                  onChange={(e) => setDraftReviewCount(Number(e.target.value))}
                  className="w-full rounded-xl bg-[#0e0e12] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value={0}>1회독 완독 시 졸업</option>
                  <option value={1}>본학습 1회 + 복습 1회 (총 2회독 후 졸업 - 권장)</option>
                  <option value={2}>본학습 1회 + 복습 2회 (총 3회독 후 졸업)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  진도 전체 초기화
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-white/5 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] text-black hover:brightness-110 cursor-pointer"
                  >
                    설정 저장
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

