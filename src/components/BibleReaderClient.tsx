'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { BibleCategory, BiblePlanItem, BibleVerse } from '@/types/bible';
import {
  buildAllBiblePlans,
  getAdjacentPlans,
  loadLocalBibleProgress,
  loadLocalBibleSettings,
  TRACK_INFO,
  updatePlanCompletion,
} from '@/lib/bibleCurriculum';

interface BibleReaderClientProps {
  plan: BiblePlanItem;
}

export default function BibleReaderClient({ plan: initialPlan }: BibleReaderClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<BiblePlanItem>(initialPlan);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [allNotesExpanded, setAllNotesExpanded] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [currentSpeechVerseIndex, setCurrentSpeechVerseIndex] = useState<number | null>(null);

  // 진행 상태 동기화
  useEffect(() => {
    const prog = loadLocalBibleProgress();
    const itemProg = prog[initialPlan.id];
    setPlan({
      ...initialPlan,
      completed_count: itemProg?.completed_count ?? initialPlan.completed_count,
      last_read_at: itemProg?.last_read_at ?? initialPlan.last_read_at,
    });
  }, [initialPlan]);

  const settings = useMemo(() => loadLocalBibleSettings(), []);
  const totalRequired = 1 + Math.max(0, settings.review_count);

  const trackInfo = TRACK_INFO[plan.category];

  // 인접 플랜 (이전 / 다음)
  const adjacent = useMemo(() => {
    const all = buildAllBiblePlans(loadLocalBibleProgress());
    return getAdjacentPlans(plan, all);
  }, [plan]);

  // 단락별로 절 그룹화
  const groupedVerses = useMemo(() => {
    const map = new Map<string, BibleVerse[]>();
    for (const v of plan.verses) {
      const pTitle = v.paragraph_title || '본문';
      if (!map.has(pTitle)) {
        map.set(pTitle, []);
      }
      map.get(pTitle)!.push(v);
    }
    return Array.from(map.entries());
  }, [plan.verses]);

  // 통독 1회 완료 버튼
  const handleMarkComplete = () => {
    const nextProg = updatePlanCompletion(plan.id, 1);
    const updatedCount = nextProg[plan.id]?.completed_count || 1;
    setPlan((prev) => ({
      ...prev,
      completed_count: updatedCount,
      last_read_at: new Date().toISOString(),
    }));

    if (updatedCount >= totalRequired) {
      toast.success(
        `🎉 축하합니다! '${plan.title}' 완독 목표(${totalRequired}회독)를 완수했습니다!`
      );
    } else {
      toast.success(
        `📖 '${plan.title}' ${updatedCount}회독 통독을 완료했습니다! (${updatedCount}/${totalRequired}회)`
      );
    }
  };

  // 개별 절 강해 토글
  const toggleNote = (verseId: string) => {
    setOpenNotes((prev) => ({
      ...prev,
      [verseId]: !prev[verseId],
    }));
  };

  // 전체 강해 열기/닫기
  const toggleAllNotes = () => {
    const nextState = !allNotesExpanded;
    setAllNotesExpanded(nextState);
    const nextMap: Record<string, boolean> = {};
    for (const v of plan.verses) {
      if (v.notes && v.notes.length > 0) {
        nextMap[v.id] = nextState;
      }
    }
    setOpenNotes(nextMap);
  };

  // TTS 한국어 낭독 (Web Speech API)
  const handleToggleTTS = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('이 브라우저에서는 음성 낭독(TTS)을 지원하지 않습니다.');
      return;
    }

    if (isPlayingTTS) {
      window.speechSynthesis.cancel();
      setIsPlayingTTS(false);
      setCurrentSpeechVerseIndex(null);
      return;
    }

    const verses = plan.verses;
    if (verses.length === 0) return;

    let index = 0;
    setIsPlayingTTS(true);

    const speakVerse = (idx: number) => {
      if (idx >= verses.length) {
        setIsPlayingTTS(false);
        setCurrentSpeechVerseIndex(null);
        toast.info('오늘 분량 음성 낭독을 마쳤습니다.');
        return;
      }

      setCurrentSpeechVerseIndex(idx);
      const targetVerse = verses[idx];
      // 순수 텍스트만 낭독 ([], () 제외된 순수 본문)
      const utterance = new SpeechSynthesisUtterance(
        `${targetVerse.num}절. ${targetVerse.text}`
      );
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;

      utterance.onend = () => {
        index++;
        speakVerse(index);
      };

      utterance.onerror = () => {
        setIsPlayingTTS(false);
        setCurrentSpeechVerseIndex(null);
      };

      window.speechSynthesis.speak(utterance);
    };

    speakVerse(index);
  };

  // 언마운트 시 TTS 중지
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 폰트 크기 스타일 매핑
  const fontSizeClasses = {
    sm: 'text-sm leading-relaxed',
    md: 'text-base sm:text-lg leading-relaxed',
    lg: 'text-lg sm:text-xl leading-relaxed',
    xl: 'text-xl sm:text-2xl leading-relaxed',
  }[fontSize];

  return (
    <div className="min-h-screen pb-32">
      {/* 1. 상단 고정 헤더 */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0c]/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#141419] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-[#D4AF37]/50 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>진도표</span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: `${trackInfo.color}20`,
                color: trackInfo.color,
                border: `1px solid ${trackInfo.color}40`,
              }}
            >
              {trackInfo.icon} {trackInfo.shortName}
            </span>
            <span className="text-xs font-semibold text-zinc-400">
              {plan.week}주차 {plan.day}일차
            </span>
          </div>

          {/* 폰트 크기 및 전체 강해 토글 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const sizes: Array<'sm' | 'md' | 'lg' | 'xl'> = ['sm', 'md', 'lg', 'xl'];
                const nextIdx = (sizes.indexOf(fontSize) + 1) % sizes.length;
                setFontSize(sizes[nextIdx]);
              }}
              className="rounded-xl border border-white/10 bg-[#141419] px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              title="글자 크기 변경"
            >
              글자 <span className="font-bold text-[#FDE68A] uppercase">{fontSize}</span>
            </button>

            <button
              onClick={toggleAllNotes}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                allNotesExpanded
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FDE68A]'
                  : 'border-white/10 bg-[#141419] text-zinc-400 hover:text-white'
              }`}
              title="모든 구절의 말씀 강해 열기/닫기"
            >
              강해 {allNotesExpanded ? '접기' : '펼치기'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. 본문 컨테이너 */}
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        {/* 말씀 카드 헤더 */}
        <div className="rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#181820] to-[#111116] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-mono text-zinc-400">
                <span>PLN ID: {plan.id}</span>
                <span>•</span>
                <span>{plan.verse_count}개 절</span>
                <span>•</span>
                <span>{plan.paragraph_count}개 단락</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {plan.title}
              </h1>
              {plan.sermon_title && (
                <p className="mt-2 text-sm font-semibold text-[#D4AF37]">
                  📖 {plan.sermon_title}
                </p>
              )}
            </div>

            {/* 통독 현황 배지 */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  plan.completed_count >= totalRequired
                    ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                    : plan.completed_count > 0
                    ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                    : 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/40'
                }`}
              >
                {plan.completed_count >= totalRequired
                  ? '완독 완수 🎉'
                  : plan.completed_count > 0
                  ? `${plan.completed_count}/${totalRequired}회독 진행 중`
                  : '신규 읽기'}
              </span>

              {/* TTS 낭독 버튼 */}
              <button
                onClick={handleToggleTTS}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isPlayingTTS
                    ? 'border-red-500 bg-red-500/20 text-red-300 animate-pulse'
                    : 'border-white/10 bg-[#1f1f28] text-zinc-300 hover:text-white hover:border-[#D4AF37]/50'
                }`}
              >
                {isPlayingTTS ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    <span>낭독 일시정지</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>본문 자동 낭독</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. 송태근 목사 강해 유튜브 바로가기 배너 (있을 경우) */}
          {plan.sermon_url && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/30 text-red-400 border border-red-500/40 text-lg">
                  ▶
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    송태근 목사 말씀 강해
                    <span className="text-[10px] rounded bg-red-500/20 px-1.5 py-0.2 text-red-300">
                      YouTube
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-md">
                    {plan.sermon_title || '삼일교회 송태근 목사 성경 강해 듣기'}
                  </p>
                </div>
              </div>

              <a
                href={plan.sermon_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors shadow-lg cursor-pointer"
              >
                <span>강해 영상/음성 듣기</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* 4. 성경 본문 렌더링 (단락별) */}
        <div className="space-y-8">
          {groupedVerses.map(([pTitle, verses], pIndex) => (
            <section
              key={`paragraph-${pIndex}`}
              className="rounded-3xl border border-white/10 bg-[#121217] p-5 sm:p-7 shadow-lg"
            >
              {/* 단락 소제목 */}
              <div className="mb-5 pb-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-[#FDE68A] flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#D4AF37]" />
                  {pTitle}
                </h3>
                <span className="text-xs font-mono text-zinc-500">{verses.length}절</span>
              </div>

              {/* 구절 목록 */}
              <div className="space-y-4">
                {verses.map((verse, vIdx) => {
                  const globalIdx = plan.verses.findIndex((v) => v.id === verse.id);
                  const isCurrentTTS = currentSpeechVerseIndex === globalIdx;
                  const hasNotes = verse.notes && verse.notes.length > 0;
                  const isNoteOpen = openNotes[verse.id] || false;

                  return (
                    <div
                      key={verse.id}
                      className={`group rounded-2xl p-3 sm:p-4 transition-all ${
                        isCurrentTTS
                          ? 'bg-[#D4AF37]/15 border border-[#D4AF37]'
                          : 'bg-[#17171e]/70 border border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 절 번호 */}
                        <span className="mt-0.5 shrink-0 min-w-[24px] text-center text-xs font-bold font-mono text-[#D4AF37] select-none bg-[#D4AF37]/10 rounded-md py-0.5 px-1 border border-[#D4AF37]/20">
                          {verse.num}
                        </span>

                        {/* 본문 텍스트 (순수 성경 말씀) */}
                        <div className="flex-1">
                          <p className={`font-normal text-zinc-100 ${fontSizeClasses}`}>
                            {verse.text}
                          </p>

                          {/* 말씀 강해(NOTE) 토글 버튼 */}
                          {hasNotes && (
                            <div className="mt-3">
                              <button
                                onClick={() => toggleNote(verse.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                                  isNoteOpen
                                    ? 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/40'
                                    : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
                                }`}
                              >
                                <Sparkles className="h-3 w-3 text-[#D4AF37]" />
                                <span>말씀 강해 ({verse.notes.length}개)</span>
                                {isNoteOpen ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>

                              {/* 펼쳐진 강해(NOTE) 아코디언 */}
                              {isNoteOpen && (
                                <div className="mt-2.5 rounded-xl border border-[#D4AF37]/20 bg-[#1b1b24] p-3.5 space-y-2 text-xs sm:text-sm text-zinc-300 animate-in fade-in slide-in-from-top-1 duration-150">
                                  {verse.notes.map((note, nIdx) => {
                                    // Markdown 볼드체 구문 파싱: - **주제**: 내용
                                    const match = note.match(/^-\s*\*\*(.*?)\*\*:\s*(.*)$/);
                                    if (match) {
                                      const [, topic, body] = match;
                                      return (
                                        <div key={nIdx} className="leading-relaxed flex items-start gap-2">
                                          <span className="text-[#D4AF37] mt-1 shrink-0">✦</span>
                                          <div>
                                            <strong className="text-[#FDE68A] font-bold">
                                              {topic}
                                            </strong>
                                            : <span className="text-zinc-200">{body}</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={nIdx} className="leading-relaxed text-zinc-200">
                                        {note}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* 5. 하단 고정 플로팅 액션 바 */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-4 py-3 sm:px-6 shadow-2xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 sm:gap-4">
          {/* 이전 플랜 버튼 */}
          {adjacent.prev ? (
            <Link
              href={`/plan/${adjacent.prev.category}/${adjacent.prev.week}/${adjacent.prev.day}`}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#16161c] px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">이전 말씀</span>
            </Link>
          ) : (
            <div className="w-10 sm:w-20" />
          )}

          {/* 중앙: 오늘 통독 완료 버튼 */}
          <button
            onClick={handleMarkComplete}
            className="flex-1 max-w-sm inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] px-4 py-3 text-sm font-extrabold text-black shadow-xl hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>오늘 말씀 통독 완료 ({plan.completed_count}/{totalRequired}회)</span>
          </button>

          {/* 다음 플랜 버튼 */}
          {adjacent.next ? (
            <Link
              href={`/plan/${adjacent.next.category}/${adjacent.next.week}/${adjacent.next.day}`}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#16161c] px-3 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">다음 말씀</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="w-10 sm:w-20" />
          )}
        </div>
      </footer>
    </div>
  );
}

