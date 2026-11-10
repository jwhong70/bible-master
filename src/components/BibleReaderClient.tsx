'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  BookmarkCheck,
  Check,
  Headphones,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { BibleCategory, BiblePlanItem, BibleVerse } from '@/types/bible';
import {
  buildAllBiblePlans,
  DAY_OF_WEEK_KO,
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

  // 인앱 송태근 목사님 설교 오디오 플레이어 상태
  const [showSermonPlayer, setShowSermonPlayer] = useState(false);
  const hasSermon = Boolean(plan.sermon_audio_url || plan.sermon_title);

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

  const isCompleted = (plan.completed_count || 0) >= 1;
  const trackInfo = TRACK_INFO[plan.category];
  const dayKo = DAY_OF_WEEK_KO[plan.day]?.dayName || `${plan.day}일`;

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

  // 1회독 완독 토글 (복습 제거)
  const handleToggleComplete = () => {
    const nextState = !isCompleted;
    const nextProg = updatePlanCompletion(plan.id, nextState);
    setPlan((prev) => ({
      ...prev,
      completed_count: nextState ? 1 : 0,
      last_read_at: nextState ? new Date().toISOString() : null,
    }));

    if (nextState) {
      toast.success(`🎉 축하합니다! '${plan.title}' 통독을 완료했습니다!`);
    } else {
      toast.info(`'${plan.title}' 통독 완료를 취소했습니다.`);
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

  // TTS 한국어 성경 말씀 낭독 (Web Speech API)
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
        toast.info('오늘 분량 말씀 낭독을 완료했습니다.');
        return;
      }

      setCurrentSpeechVerseIndex(idx);
      const targetVerse = verses[idx];
      // 대괄호[], 소괄호()가 완전히 제외된 순수 본문만 낭독
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
    <div className="min-h-screen pb-36">
      {/* 1. 상단 고정 헤더: 모바일 2행 분리 (줄바꿈 원천 차단) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* 1행: 진도표 뒤로가기 & 트랙/일차 배지 */}
          <div className="flex items-center justify-between w-full sm:w-auto">
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
              <span className="text-xs font-semibold text-zinc-300 bg-white/5 px-2 py-0.5 rounded-md">
                {plan.week}주 {plan.day}일 ({dayKo})
              </span>
            </div>
          </div>

          {/* 2행: 글자 크기 & 강해 일괄 펼침 */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5">
            <button
              onClick={() => {
                const sizes: Array<'sm' | 'md' | 'lg' | 'xl'> = ['sm', 'md', 'lg', 'xl'];
                const nextIdx = (sizes.indexOf(fontSize) + 1) % sizes.length;
                setFontSize(sizes[nextIdx]);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl border border-white/10 bg-[#141419] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              title="글자 크기 변경"
            >
              글자 크기 <span className="ml-1 font-bold text-[#FDE68A] uppercase">{fontSize}</span>
            </button>

            <button
              onClick={toggleAllNotes}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
        {/* 말씀 카드 대제목 */}
        <div className="rounded-3xl border border-[#D4AF37]/30 bg-gradient-to-b from-[#181820] to-[#111116] p-5 sm:p-8 shadow-xl space-y-4">
          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-[#D4AF37] font-bold">{trackInfo.shortName} 통독</span>
              <span>•</span>
              <span>{plan.week}주차 {plan.day}일차 ({dayKo})</span>
              <span>•</span>
              <span>총 {plan.verse_count}개 절</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white select-none">
              {plan.title}
            </h1>
            {plan.sermon_title && (
              <p className="text-sm font-semibold text-[#FDE68A]">
                📖 {plan.sermon_title}
              </p>
            )}
          </div>

          {/* 상단 컨트롤 버튼 바 (모바일 1줄에 1버튼씩 완전 분리) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-white/5">
            {/* 🎙️ 송태근 목사님 설교 듣기 (인앱 오디오 플레이어) */}
            {hasSermon && (
              <button
                onClick={() => setShowSermonPlayer((prev) => !prev)}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer ${
                  showSermonPlayer
                    ? 'bg-[#D4AF37] text-black shadow-[#D4AF37]/20'
                    : 'border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#FDE68A] hover:bg-[#D4AF37] hover:text-black'
                }`}
              >
                <Headphones className="h-4 w-4 shrink-0" />
                <span>{showSermonPlayer ? '송태근 목사님 설교 닫기' : '🎙️ 송태근 목사님 설교 듣기'}</span>
              </button>
            )}

            {/* 🔊 본문 순수 말씀 낭독 (TTS) */}
            <button
              onClick={handleToggleTTS}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isPlayingTTS
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FDE68A] animate-pulse'
                  : 'border-white/10 bg-[#1f1f28] text-zinc-300 hover:text-white hover:border-[#D4AF37]/50'
              }`}
            >
              {isPlayingTTS ? (
                <>
                  <Pause className="h-4 w-4 shrink-0" />
                  <span>말씀 낭독 일시정지</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
                  <span>성경 본문 자동 낭독 듣기</span>
                </>
              )}
            </button>
          </div>

          {/* 3. 인앱 송태근 목사님 설교 순수 오디오 플레이어 (영상/유튜브/광고 완전 배제) */}
          {showSermonPlayer && (
            <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#0d0d14] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D4AF37] text-black text-xs font-bold">
                    🎙️
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    송태근 목사님 설교 · {plan.sermon_title || plan.title}
                  </h4>
                </div>
                <button
                  onClick={() => setShowSermonPlayer(false)}
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                  title="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 오디오 플레이어: 광고 없는 순수 MP3 오디오 */}
              <div className="rounded-xl bg-black/60 p-3 border border-white/10">
                <audio
                  controls
                  autoPlay
                  src={plan.sermon_audio_url || `/audio/sermons/${plan.id}.mp3`}
                  className="w-full h-10 accent-[#D4AF37]"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                💡 설교 음성을 들으시면서 아래 성경 본문 말씀과 노트를 편안하게 읽으실 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 4. 성경 본문 렌더링 (단락별) */}
        <div className="space-y-6">
          {groupedVerses.map(([pTitle, verses], pIndex) => (
            <section
              key={`paragraph-${pIndex}`}
              className="rounded-3xl border border-white/10 bg-[#121217] p-5 sm:p-7 shadow-lg space-y-4"
            >
              {/* 단락 소제목: 모바일 1행 분리 */}
              <div className="pb-3 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-[#FDE68A] flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#D4AF37] shrink-0" />
                  <span>{pTitle}</span>
                </h3>
                <span className="text-xs font-mono text-zinc-500">{verses.length}절</span>
              </div>

              {/* 구절 목록 */}
              <div className="space-y-3">
                {verses.map((verse) => {
                  const globalIdx = plan.verses.findIndex((v) => v.id === verse.id);
                  const isCurrentTTS = currentSpeechVerseIndex === globalIdx;
                  const hasNotes = verse.notes && verse.notes.length > 0;
                  const isNoteOpen = openNotes[verse.id] || false;

                  return (
                    <div
                      key={verse.id}
                      className={`group rounded-2xl p-3.5 sm:p-4 transition-all ${
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
                        <div className="flex-1 space-y-2">
                          <p className={`font-normal text-zinc-100 ${fontSizeClasses}`}>
                            {verse.text}
                          </p>

                          {/* 말씀 강해(NOTE) 아코디언 토글 버튼 */}
                          {hasNotes && (
                            <div>
                              <button
                                onClick={() => toggleNote(verse.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                                  isNoteOpen
                                    ? 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/40'
                                    : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
                                }`}
                              >
                                <Sparkles className="h-3 w-3 text-[#D4AF37] shrink-0" />
                                <span>말씀 강해 ({verse.notes.length}개)</span>
                                {isNoteOpen ? (
                                  <ChevronUp className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
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

      {/* 5. 하단 고정 플로팅 액션 바: 모바일 1줄 전폭 분리 */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-4 py-2.5 sm:px-6 shadow-2xl">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* 이전/다음 말씀 네비게이션 */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            {adjacent.prev ? (
              <Link
                href={`/plan/${adjacent.prev.category}/${adjacent.prev.week}/${adjacent.prev.day}`}
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#16161c] px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>이전 말씀</span>
              </Link>
            ) : (
              <div className="w-16" />
            )}

            {adjacent.next ? (
              <Link
                href={`/plan/${adjacent.next.category}/${adjacent.next.week}/${adjacent.next.day}`}
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#16161c] px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
              >
                <span>다음 말씀</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* 중앙: 오늘 통독 완료 토글 버튼 (모바일 100% 전폭 단독 점유) */}
          <button
            onClick={handleToggleComplete}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl transition-all cursor-pointer ${
              isCompleted
                ? 'bg-[#10B981] text-black hover:bg-[#059669]'
                : 'bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] text-black hover:brightness-110'
            }`}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{isCompleted ? '✓ 오늘 말씀 통독 완료됨' : '오늘 말씀 통독 완료 체크'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
