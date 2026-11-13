'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
 BookOpen,
 CheckCircle2,
 ChevronRight,
 Settings,
 Sparkles,
 Check,
 Calendar,
 ChevronDown,
 ChevronUp,
 BookmarkCheck,
 RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
 buildAllBiblePlans,
 buildWeeklyBibleGroups,
 computeBibleDailyTodo,
 DAY_OF_WEEK_KO,
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
 const [viewTab, setViewTab] = useState<'daily' | 'weekly'>('daily');
 const [selectedTrack, setSelectedTrack] = useState<
 'all' | 'new_testament' | 'wisdom' | 'old_testament'
 >('all');
 const [openWeeks, setOpenWeeks] = useState<Record<number, boolean>>({ 1: true });

 // 설정 임시 폼 상태
 const [draftDailyNt, setDraftDailyNt] = useState(1);
 const [draftDailyWd, setDraftDailyWd] = useState(1);
 const [draftDailyOt, setDraftDailyOt] = useState(1);

 useEffect(() => {
 const localSet = loadLocalBibleSettings();
 const localProg = loadLocalBibleProgress();
 setSettings(localSet);
 setPlans(buildAllBiblePlans(localProg));
 setDraftDailyNt(localSet.daily_nt_count);
 setDraftDailyWd(localSet.daily_wd_count);
 setDraftDailyOt(localSet.daily_ot_count);
 if (localSet.active_track) {
 setSelectedTrack(localSet.active_track);
 }
 setIsHydrated(true);
 }, []);

 const ntStats = useMemo(
 () => computeBibleDailyTodo(plans, settings, 'new_testament'),
 [plans, settings]
 );
 const wdStats = useMemo(
 () => computeBibleDailyTodo(plans, settings, 'wisdom'),
 [plans, settings]
 );
 const otStats = useMemo(
 () => computeBibleDailyTodo(plans, settings, 'old_testament'),
 [plans, settings]
 );

 // 통합 또는 개별 트랙 To-Do 리스트
 const activeTodoList = useMemo(() => {
 if (selectedTrack === 'new_testament') return ntStats.todoPlans;
 if (selectedTrack === 'wisdom') return wdStats.todoPlans;
 if (selectedTrack === 'old_testament') return otStats.todoPlans;
 // 'all' 통합 모드: 신약 1개 + 시가서 1개 + 구약 1개
 return [...ntStats.todoPlans, ...wdStats.todoPlans, ...otStats.todoPlans];
 }, [selectedTrack, ntStats, wdStats, otStats]);

 // 전체 통독 진도 통계
 const totalPlansCount = ntStats.totalPlans + wdStats.totalPlans + otStats.totalPlans;
 const totalCompleted = ntStats.completedCount + wdStats.completedCount + otStats.completedCount;
 const overallPercent = totalPlansCount > 0 ? Math.round((totalCompleted / totalPlansCount) * 100) : 0;

 // 주간 단위 그룹 데이터 (선택된 트랙 기준)
 const weeklyGroups = useMemo(() => {
 const cat = selectedTrack === 'all' ? undefined : selectedTrack;
 return buildWeeklyBibleGroups(plans, cat);
 }, [plans, selectedTrack]);

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
 active_track: selectedTrack,
 };
 setSettings(next);
 saveLocalBibleSettings(next);
 setShowSettingsModal(false);
 toast.success(
 `통독 목표 설정 완료: 하루 신약 ${next.daily_nt_count}개 · 시가서 ${next.daily_wd_count}개 · 구약 ${next.daily_ot_count}개`
 );
 };

 // 통독 완료 토글 (체크 / 체크 해제)
 const handleToggleComplete = (e: React.MouseEvent, plan: BiblePlanItem) => {
 e.preventDefault();
 e.stopPropagation();
 const isCurrentlyDone = (plan.completed_count || 0) >= 1;
 const nextState = !isCurrentlyDone;
 const updatedMap = updatePlanCompletion(plan.id, nextState);
 setPlans(buildAllBiblePlans(updatedMap));

 if (nextState) {
 toast.success(`🎉 '${plan.title}' 통독 완료!`);
 } else {
 toast.info(`'${plan.title}' 통독 완료를 취소했습니다.`);
 }
 };

 const toggleWeekOpen = (week: number) => {
 setOpenWeeks((prev) => ({
 ...prev,
 [week]: !prev[week],
 }));
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

 if (!isHydrated) {
 return (
 <div className="flex min-h-[60vh] items-center justify-center">
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EA580C] border-t-transparent" />
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* 1. 상단 브랜드 헤더 (모바일 2행 완전 분리: 텍스트 짤림 0%) */}
      <header className="border border-black/10 border-l-4 border-l-brand bg-gradient-to-b from-brand-surface/80 via-white to-brand-surface/30 p-5 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10">
          {/* 1행: 로고 & 타이틀 */}
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark border border-brand/30">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                52주 1년 1독 성경 통독 & 송태근 목사 강해
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight select-none whitespace-nowrap">
              BIBLE MASTER <span className="text-brand-dark">성경 통독 마스터</span>
            </h1>
            <p className="mt-1 text-xs text-gray-600 whitespace-nowrap">
              신약 277일 · 시가서 239일 · 구약 292일 | 일간 To-Do & 주간 요일별 진도표
            </p>
          </div>

          {/* 2행: 설정 버튼 (모바일 전폭 단독 행) */}
          <div className="w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-black/15 bg-[#1F1F1F] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[#2B2B2B] hover:border-brand cursor-pointer shadow-xs"
            >
              <Settings className="h-4 w-4 text-brand" />
              <span>일일 목표 분량 설정</span>
            </button>
          </div>
        </div>

        {/* 종합 통독 진도율 바 */}
        <div className="mt-6 pt-5 border-t border-black/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-white p-3 border border-black/10 shadow-xs">
            <div className="text-xs text-gray-500">전체 통독 진도</div>
            <div className="mt-1 text-lg font-black text-brand">{overallPercent}%</div>
            <div className="mt-0.5 text-[11px] text-gray-400">
              {totalCompleted} / {totalPlansCount} 완독
            </div>
          </div>
 <div className="bg-white p-3 border border-black/10 shadow-xs">
 <div className="text-xs text-gray-500">오늘의 To-Do</div>
 <div className="mt-1 text-lg font-black text-gray-900">{activeTodoList.length}개</div>
 <div className="mt-0.5 text-[11px] text-gray-400">추천 진도</div>
 </div>
 <div className="bg-white p-3 border border-black/10 shadow-xs">
 <div className="text-xs text-gray-500">신약 완독</div>
 <div className="mt-1 text-lg font-black text-[#EA580C]">
 {ntStats.completedCount}/{ntStats.totalPlans}
 </div>
 <div className="mt-0.5 text-[11px] text-gray-400">277일 코스</div>
 </div>
 <div className="bg-white p-3 border border-black/10 shadow-xs">
 <div className="text-xs text-gray-500">구약·시가서 완독</div>
 <div className="mt-1 text-lg font-black text-[#A78BFA]">
 {wdStats.completedCount + otStats.completedCount}/
 {wdStats.totalPlans + otStats.totalPlans}
 </div>
 <div className="mt-0.5 text-[11px] text-gray-400">531일 코스</div>
 </div>
 </div>
 </header>

      {/* 2. 4대 맞춤 트랙 선택 탭 (신약만 / 구약만 / 시가서만 / 전체 다) */}
      <div className="flex flex-col sm:grid sm:grid-cols-4 gap-2 w-full">
        <button
          onClick={() => handleTrackChange('all')}
          className={`w-full flex items-center justify-between p-3.5 border transition-all text-left cursor-pointer ${
            selectedTrack === 'all'
              ? 'border-brand bg-brand/10 text-gray-900 shadow-sm'
              : 'border-black/10 bg-white text-gray-600 hover:text-gray-900 hover:border-brand/40'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>🌟</span> 전체 다 (통합 통독)
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">신약+시가서+구약 매일 동시</div>
          </div>
          <span className="text-xs font-black text-brand-dark">{totalPlansCount}개</span>
        </button>

        <button
          onClick={() => handleTrackChange('new_testament')}
          className={`w-full flex items-center justify-between p-3.5 border transition-all text-left cursor-pointer ${
            selectedTrack === 'new_testament'
              ? 'border-brand bg-brand/10 text-gray-900 shadow-sm'
              : 'border-black/10 bg-white text-gray-600 hover:text-gray-900 hover:border-brand/40'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>✝️</span> 신약만 (277일)
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              완독 {ntStats.completedCount}/{ntStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-brand">신약 집중</span>
        </button>

        <button
          onClick={() => handleTrackChange('wisdom')}
          className={`w-full flex items-center justify-between p-3.5 border transition-all text-left cursor-pointer ${
            selectedTrack === 'wisdom'
              ? 'border-[#0284C7] bg-[#0284C7]/10 text-gray-900 shadow-sm'
              : 'border-black/10 bg-white text-gray-600 hover:text-gray-900 hover:border-[#0284C7]/40'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>📜</span> 시가서만 (239일)
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              완독 {wdStats.completedCount}/{wdStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-[#0284C7]">시편·잠언</span>
        </button>

        <button
          onClick={() => handleTrackChange('old_testament')}
          className={`w-full flex items-center justify-between p-3.5 border transition-all text-left cursor-pointer ${
            selectedTrack === 'old_testament'
              ? 'border-[#7C3AED] bg-[#7C3AED]/10 text-gray-900 shadow-sm'
              : 'border-black/10 bg-white text-gray-600 hover:text-gray-900 hover:border-[#7C3AED]/40'
          }`}
        >
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5">
              <span>🏛️</span> 구약만 (292일)
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              완독 {otStats.completedCount}/{otStats.totalPlans}
            </div>
          </div>
          <span className="text-xs font-black text-[#7C3AED]">모세오경·역사</span>
        </button>
      </div>

      {/* 3. 뷰 탭 전환 (📋 일간 To-Do vs 📅 주간 진도표) */}
      <div className="grid grid-cols-2 sm:flex items-center gap-2 border-b border-black/10 pb-3 w-full">
        <button
          onClick={() => setViewTab('daily')}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            viewTab === 'daily'
              ? 'bg-brand text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-white border border-black/10'
          }`}
        >
          <span>📋 일간 단위 To-Do ({activeTodoList.length})</span>
        </button>
        <button
          onClick={() => setViewTab('weekly')}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            viewTab === 'weekly'
              ? 'bg-brand text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 bg-white border border-black/10'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>📅 주간 단위 진도표 (1~52주)</span>
        </button>
      </div>

      {/* 4-A. 일간 단위 To-Do 렌더링 */}
      {viewTab === 'daily' && (
        <div className="space-y-3">
          {activeTodoList.length === 0 ? (
            <div className="border border-black/10 bg-white p-10 text-center space-y-3">
              <BookmarkCheck className="h-12 w-12 text-[#10B981] mx-auto" />
              <h3 className="text-lg font-bold">
                선택하신 트랙의 모든 말씀을 완독하셨습니다! 🎉
              </h3>
              <p className="text-xs text-gray-500">
                [주간 단위 진도표] 탭에서 원하는 주차의 말씀을 언제든 다시 확인하실 수 있습니다.
              </p>
            </div>
          ) : (
            activeTodoList.map((plan) => {
              const info = TRACK_INFO[plan.category];
              const isCompleted = (plan.completed_count || 0) >= 1;
              const dayKo = DAY_OF_WEEK_KO[plan.day]?.dayName || `${plan.day}일`;

              return (
                <div
                  key={plan.id}
                  className="border border-black/10 bg-white p-4 sm:p-5 transition-all hover:border-brand/50 hover:bg-brand-surface/30 flex flex-col gap-3 shadow-xs"
                >
                  {/* 상단 메타 배지 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: `${info.color}20`,
                        color: info.color,
                        border: `1px solid ${info.color}40`,
                      }}
                    >
                      {info.icon} {info.shortName}
                    </span>
                    <span className="text-xs font-mono font-semibold text-gray-700 bg-black/5 px-2 py-0.5">
                      {plan.week}주차 {plan.day}일차 ({dayKo})
                    </span>
                    {(plan.sermon_audio_url || plan.sermon_title) && (
                      <span className="inline-flex items-center gap-1 bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark border border-brand/25">
                        🎙️ 송태근 목사 설교
                      </span>
                    )}
                  </div>

                  {/* 제목줄 (모바일 100% 전폭 단독 점유) */}
                  <Link
                    href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                    className="block cursor-pointer group"
                  >
                    <h3 className="text-base sm:text-lg font-bold group-hover:text-brand-dark transition-colors">
                      {plan.title}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {plan.verse_count}개 절 · {plan.paragraph_count}개 단락
                      {plan.sermon_title && ` · ${plan.sermon_title}`}
                    </p>
                  </Link>

                  {/* 액션 버튼 바: 모바일 1줄에 1개씩 완전 분리 (줄바꿈 원천 차단) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-black/5">
                    {/* 통독 완료 토글 버튼 */}
                    <button
                      onClick={(e) => handleToggleComplete(e, plan)}
                      className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                        isCompleted
                          ? 'border border-[#10B981]/50 bg-[#10B981]/15 text-emerald-700'
                          : 'border border-black/15 bg-[#FAF9F5] text-gray-700 hover:text-gray-900 hover:border-[#10B981]/40'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                      <span>{isCompleted ? '✓ 오늘 통독 완료됨' : '오늘 말씀 통독 완료 체크'}</span>
                    </button>

                    {/* 말씀 읽기 바로가기 버튼 */}
                    <Link
                      href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-brand hover:bg-brand-hover px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
                    >
                      <span>본문 말씀 읽기 & 강해</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

 {/* 4-B. 주간 단위 (1~52주차 요일별 묶음) 진도표 렌더링 */}
 {viewTab === 'weekly' && (
 <div className="space-y-4">
 <p className="text-xs text-gray-500">
 💡 주차별 카드를 터치하여 월요일~일요일 요일별 성경 읽기 진도를 한눈에 확인하고 체크하세요.
 </p>

 <div className="space-y-3">
 {weeklyGroups.map((group) => {
 const isOpen = openWeeks[group.week] ?? false;
 const percent =
 group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;

 return (
                <div
                  key={`week-${group.week}`}
                  className={`border transition-all ${
                    group.isAllCompleted
                      ? 'border-[#10B981]/30 bg-emerald-50/60'
                      : 'border-black/10 bg-white'
                  }`}
                >
                  {/* 주차 카드 헤더 (클릭 시 아코디언 토글) */}
                  <button
                    onClick={() => toggleWeekOpen(group.week)}
                    className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-brand-surface/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center bg-brand/10 border border-brand/30 text-xs font-bold text-brand-dark">
                        {group.week}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2">
                          제 {group.week} 주차 성경 통독
                          {group.isAllCompleted && (
                            <span className="text-[10px] bg-[#10B981]/20 px-1.5 py-0.2 text-emerald-700 font-semibold">
                              ✓ 주간 완독
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-gray-600">
                          {group.completedCount} / {group.totalCount} 완료 ({percent}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="hidden sm:block w-24 h-2 bg-black/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </button>

                  {/* 주차 내부 요일별 플랜 목록 */}
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-black/5">
                      {group.plans.map((plan) => {
                        const isDone = (plan.completed_count || 0) >= 1;
                        const dayMeta = DAY_OF_WEEK_KO[plan.day] || {
                          dayName: `${plan.day}일`,
                          full: `${plan.day}일차`,
                        };
                        const info = TRACK_INFO[plan.category];

                        return (
                          <div
                            key={plan.id}
                            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border transition-all ${
                              isDone
                                ? 'border-[#10B981]/20 bg-emerald-50/50'
                                : 'border-black/10 bg-[#FAF9F5]'
                            }`}
                          >
                            <Link
                              href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                              className="flex items-center gap-2.5 flex-1 overflow-hidden cursor-pointer group"
                            >
                              <span className="shrink-0 w-12 text-center bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                                {dayMeta.dayName}요일
                              </span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 shrink-0"
                                style={{
                                  backgroundColor: `${info.color}15`,
                                  color: info.color,
                                }}
                              >
                                {info.shortName}
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-brand-dark truncate transition-colors">
                                {plan.title}
                              </span>
                              {(plan.sermon_audio_url || plan.sermon_title) && (
                                <span className="text-[10px] text-brand-dark shrink-0 font-medium">🎙️ 설교</span>
                              )}
                            </Link>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                              <button
                                onClick={(e) => handleToggleComplete(e, plan)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-[#10B981]/20 text-emerald-700 border border-[#10B981]/40'
                                    : 'bg-white text-gray-600 hover:text-gray-900 border border-black/10'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                                <span>{isDone ? '완독' : '완료 체크'}</span>
                              </button>

                              <Link
                                href={`/plan/${plan.category}/${plan.week}/${plan.day}`}
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="말씀 읽기"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
 );
 })}
 </div>
 </div>
 )}

      {/* 5. 진도 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-brand/40 bg-white p-6 text-gray-900 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand" />
                성경 통독 일일 분량 설정
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-600 hover:text-gray-900 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ✝️ 하루 신약 목표 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyNt}
                  onChange={(e) => setDraftDailyNt(Number(e.target.value))}
                  className="w-full bg-[#FAF9F5] border border-black/15 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  📜 하루 시가서 목표 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyWd}
                  onChange={(e) => setDraftDailyWd(Number(e.target.value))}
                  className="w-full bg-[#FAF9F5] border border-black/15 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  🏛️ 하루 구약 목표 (기본 1개)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={draftDailyOt}
                  onChange={(e) => setDraftDailyOt(Number(e.target.value))}
                  className="w-full bg-[#FAF9F5] border border-black/15 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-black/10">
                <button
                  type="button"
                  onClick={handleResetProgress}
                  className="text-xs text-red-600 hover:text-red-700 underline cursor-pointer"
                >
                  진도 전체 초기화
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-black/5 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-brand text-white hover:bg-brand-hover cursor-pointer"
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
