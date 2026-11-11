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
  RotateCcw,
  RotateCw,
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

function extractYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatSermonTitle(title?: string): string {
  if (!title) return '본문 강해';
  return title.replace(/\[강해\(송태근\s*목사\)\]\s*/, '').trim();
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function BibleReaderClient({ plan: initialPlan }: BibleReaderClientProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<BiblePlanItem>(initialPlan);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [allNotesExpanded, setAllNotesExpanded] = useState(false);

  // 1. 고음질 신경망 AI 성우 오디오 플레이어 (Edge TTS MP3)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [showAudioPlayer, setShowAudioPlayer] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // 브라우저 TTS 폴백 상태
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);

  // 구절별 송태근 목사님 설교 오디오 재생 상태
  const [activeSermon, setActiveSermon] = useState<{ title: string; url: string } | null>(null);
  const sermonVideoId = useMemo(() => extractYouTubeVideoId(activeSermon?.url), [activeSermon?.url]);

  // 플랜별 Supabase Storage 오디오 URL
  const audioUrl = useMemo(
    () => `https://sqsmqipyqwnblabtihnm.supabase.co/storage/v1/object/public/bible-audio/${plan.id}.mp3`,
    [plan.id]
  );

  // 진행 상태 동기화
  useEffect(() => {
    const prog = loadLocalBibleProgress();
    const itemProg = prog[initialPlan.id];
    setPlan({
      ...initialPlan,
      completed_count: itemProg?.completed_count ?? initialPlan.completed_count,
      last_read_at: itemProg?.last_read_at ?? initialPlan.last_read_at,
    });
    // 플랜 변경 시 오디오 정지
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    }
  }, [initialPlan]);

  const isCompleted = (plan.completed_count || 0) >= 1;
  const trackInfo = TRACK_INFO[plan.category];
  const dayKo = DAY_OF_WEEK_KO[plan.day]?.dayName || `${plan.day}일`;

  // 인접 플랜 (이전 / 다음)
  const adjacent = useMemo(() => {
    const all = buildAllBiblePlans(loadLocalBibleProgress());
    return getAdjacentPlans(plan, all);
  }, [plan]);

  // 장(Chapter)별 -> 소제목(Paragraph)별 2단계 계층적 그룹화
  const chapterSections = useMemo(() => {
    const chMap = new Map<string, Map<string, BibleVerse[]>>();
    for (const v of plan.verses) {
      const chName = (v as any).chapter || (plan.title.includes('장') ? plan.title : '본문');
      const pTitle = v.paragraph_title || '본문';
      if (!chMap.has(chName)) {
        chMap.set(chName, new Map());
      }
      const pMap = chMap.get(chName)!;
      if (!pMap.has(pTitle)) {
        pMap.set(pTitle, []);
      }
      pMap.get(pTitle)!.push(v);
    }
    return Array.from(chMap.entries()).map(([chapterName, pMap]) => ({
      chapterName,
      paragraphs: Array.from(pMap.entries()),
    }));
  }, [plan.verses, plan.title]);

  // 1회독 완독 토글
  const handleToggleComplete = () => {
    const nextState = !isCompleted;
    updatePlanCompletion(plan.id, nextState);
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

  // 브라우저 기본 TTS 폴백 실행
  const startFallbackTTS = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      toast.error('음성 낭독을 지원하지 않는 브라우저입니다.');
      return;
    }
    const verses = plan.verses;
    if (verses.length === 0) return;

    let index = 0;
    setIsPlayingTTS(true);

    const speakVerse = (idx: number) => {
      if (idx >= verses.length) {
        setIsPlayingTTS(false);
        toast.info('오늘 분량 말씀 낭독을 완료했습니다.');
        return;
      }
      const targetVerse = verses[idx];
      const utterance = new SpeechSynthesisUtterance(targetVerse.text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.95;

      utterance.onend = () => {
        index++;
        speakVerse(index);
      };
      utterance.onerror = () => {
        setIsPlayingTTS(false);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakVerse(index);
  };

  // 고음질 AI 성우 오디오 토글
  const handleToggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      setShowAudioPlayer(true);
      setIsLoadingAudio(true);
      audioRef.current
        .play()
        .then(() => {
          setIsPlayingAudio(true);
          setIsLoadingAudio(false);
        })
        .catch((err) => {
          console.warn('AI 오디오 재생 실패, 브라우저 TTS로 전환:', err);
          setIsLoadingAudio(false);
          setIsPlayingAudio(false);
          toast.info('고음질 음성 스트리밍 준비 중이어서 브라우저 실시간 음성으로 낭독합니다.');
          startFallbackTTS();
        });
    }
  };

  // 10초 스킵 (-10초, +10초)
  const handleSkipTime = (delta: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioDuration, audioRef.current.currentTime + delta));
    audioRef.current.currentTime = newTime;
    setAudioCurrentTime(newTime);
  };

  // 배속 변경 (1.0x -> 1.25x -> 1.5x -> 1.0x)
  const handleRateCycle = () => {
    if (!audioRef.current) return;
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    audioRef.current.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  // 스마트폰 잠금화면 및 백그라운드 오디오 메타데이터 연동
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator && isPlayingAudio) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${plan.title} (말씀 통독)`,
        artist: '성경 통독 - 당신의 피비',
        album: `${trackInfo.shortName} ${plan.week}주 ${plan.day}일차`,
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play();
        setIsPlayingAudio(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        setIsPlayingAudio(false);
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => handleSkipTime(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => handleSkipTime(10));
    }
  }, [isPlayingAudio, plan.title, trackInfo.shortName, plan.week, plan.day]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
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
    <div className="min-h-screen pb-44">
      {/* 백그라운드 오디오 태그 */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setAudioCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setAudioDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlayingAudio(false);
          setAudioCurrentTime(0);
          toast.success('오늘 분량 말씀 낭독을 완료했습니다.');
        }}
        onError={() => {
          setIsPlayingAudio(false);
          setIsLoadingAudio(false);
        }}
      />

      {/* 1. 상단 고정 헤더: 모바일 2행 분리 (줄바꿈 원천 차단) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-2.5 py-2 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* 1행: 진도표 뒤로가기 & 트랙/일차 배지 */}
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link
              href="/"
              className="flex items-center gap-1.5 border border-white/10 bg-[#141419] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-[#D4AF37]/50 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>진도표</span>
            </Link>

            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${trackInfo.color}20`,
                  color: trackInfo.color,
                  border: `1px solid ${trackInfo.color}40`,
                }}
              >
                {trackInfo.icon} {trackInfo.shortName}
              </span>
              <span className="text-xs font-semibold text-zinc-300 bg-white/5 px-2 py-0.5">
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center border border-white/10 bg-[#141419] px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              title="글자 크기 변경"
            >
              글자 크기 <span className="ml-1 font-bold text-[#FDE68A] uppercase">{fontSize}</span>
            </button>

            <button
              onClick={toggleAllNotes}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
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
      <main className="mx-auto max-w-4xl px-2.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* 말씀 카드 대제목 */}
        <div className="border border-[#D4AF37]/30 bg-gradient-to-b from-[#181820] to-[#111116] p-4 sm:p-8 shadow-xl space-y-3 sm:space-y-4">
          <div className="space-y-1.5 w-full">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="text-[#D4AF37] font-bold">{trackInfo.shortName} 통독</span>
              <span>•</span>
              <span>
                {plan.week}주차 {plan.day}일차 ({dayKo})
              </span>
              <span>•</span>
              <span>총 {plan.verse_count}개 절</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white select-none">
              {plan.title}
            </h1>
            {plan.sermon_title && (
              <p className="text-xs sm:text-sm font-semibold text-[#FDE68A]">
                📖 {plan.sermon_title}
              </p>
            )}
          </div>

          {/* 상단 컨트롤 버튼 바: 고음질 AI 성우 말씀 낭독 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-white/5">
            <button
              onClick={handleToggleAudio}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isPlayingAudio || isPlayingTTS
                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FDE68A] animate-pulse'
                  : 'border-[#D4AF37]/40 bg-[#1f1f28] text-zinc-200 hover:text-white hover:border-[#D4AF37]'
              }`}
            >
              {isPlayingAudio || isPlayingTTS ? (
                <>
                  <Pause className="h-4 w-4 shrink-0 text-[#FDE68A]" />
                  <span>말씀 낭독 일시정지</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
                  <span>🎧 고음질 AI 성우 말씀 듣기</span>
                </>
              )}
            </button>

            {plan.sermon_url && (
              <button
                onClick={() =>
                  setActiveSermon({
                    title: plan.sermon_title || `${plan.title} 설교 강해`,
                    url: plan.sermon_url!,
                  })
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/10 bg-[#16161c] px-4 py-2.5 text-xs sm:text-sm font-semibold text-zinc-300 hover:border-[#D4AF37]/50 hover:text-white transition-all cursor-pointer"
              >
                <Headphones className="h-4 w-4 text-[#D4AF37] shrink-0" />
                <span>오늘의 강해 설교 듣기 (송태근 목사)</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. 본문 단락 및 절 목록 */}
        <div className="space-y-6 sm:space-y-8">
        {chapterSections.map(({ chapterName, paragraphs }, chIdx) => (
            <div key={chapterName + chIdx} className="space-y-5 sm:space-y-7">
              {/* 1. 크게 장 단위 중제목 구분선 */}
              <div className="flex items-center gap-3 pt-3 pb-2 border-b-2 border-[#D4AF37]/50">
                <span className="px-3 py-1 bg-[#D4AF37] text-black font-black text-sm sm:text-base tracking-wider shadow-md">
                  {chapterName}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-[#D4AF37]/50 via-[#D4AF37]/20 to-transparent" />
              </div>

              {/* 2. 장 내부 소제목별 단락 카드 */}
              <div className="space-y-5 sm:space-y-6">
                {paragraphs.map(([paragraphTitle, verses], pIdx) => (
            <section
              key={paragraphTitle + pIdx}
              className="border border-white/5 bg-[#121217]/60 p-3.5 sm:p-6 space-y-4"
            >
              {paragraphTitle && paragraphTitle !== '본문' && (
                <div className="border-b border-white/10 pb-2.5 flex items-center gap-2">
                  <span className="h-2 w-2 bg-[#D4AF37]" />
                  <h2 className="text-sm sm:text-base font-bold text-[#FDE68A] tracking-wide">
                    {paragraphTitle}
                  </h2>
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                {verses.map((verse) => {
                  const hasNotes = verse.notes && verse.notes.length > 0;
                  const hasSermon = !!verse.sermon_url;
                  const isNoteOpen = openNotes[verse.id];

                  return (
                    <article
                      key={verse.id}
                      className="group border border-white/5 bg-[#16161c]/80 p-3 sm:p-4 hover:border-white/15 transition-all"
                    >
                      {/* 절 번호 배지 행 */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                        <span className="font-mono text-xs font-bold text-[#D4AF37]">
                          [{verse.num}절]
                        </span>

                        <div className="flex items-center gap-1.5">
                          {hasSermon && (
                            <button
                              onClick={() =>
                                setActiveSermon({
                                  title: verse.sermon_title || `${verse.num}절 설교`,
                                  url: verse.sermon_url!,
                                })
                              }
                              className="inline-flex items-center gap-1 border border-white/10 bg-[#1e1e26] px-2 py-0.5 text-[11px] font-semibold text-zinc-300 hover:border-[#D4AF37]/50 hover:text-white transition-all cursor-pointer"
                              title={verse.sermon_title || '설교 듣기'}
                            >
                              <Headphones className="h-3 w-3 text-[#D4AF37]" />
                              <span className="hidden sm:inline">
                                {formatSermonTitle(verse.sermon_title)}
                              </span>
                              <span className="sm:hidden">설교</span>
                            </button>
                          )}

                          {hasNotes && (
                            <button
                              onClick={() => toggleNote(verse.id)}
                              className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer ${
                                isNoteOpen
                                  ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FDE68A]'
                                  : 'border-white/10 bg-[#1e1e26] text-zinc-400 hover:text-white'
                              }`}
                            >
                              <BookOpen className="h-3 w-3" />
                              <span>강해 {verse.notes.length}</span>
                              {isNoteOpen ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 본문 텍스트 행 */}
                      <p
                        className={`text-zinc-100 font-normal pt-2 break-keep ${fontSizeClasses}`}
                      >
                        {verse.text}
                      </p>

                      {/* 절 강해 해설 아코디언 */}
                      {hasNotes && isNoteOpen && (
                        <div className="mt-3 border-t border-white/10 pt-3 space-y-2 bg-black/20 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FDE68A]">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>말씀 강해 해설</span>
                          </div>
                          <ul className="space-y-2 text-xs sm:text-sm text-zinc-300">
                            {verse.notes.map((note, nIdx) => (
                              <li
                                key={nIdx}
                                className="pl-3 border-l-2 border-[#D4AF37]/40 leading-relaxed text-zinc-300"
                              >
                                {note.replace(/^- \*\*(.*?)\*\*:/, '$1: ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 4. 고음질 AI 성우 말씀 낭독 전용 플로팅 플레이어 바 (화면 하단 고정) */}
      {showAudioPlayer && (
        <div className="fixed bottom-16 sm:bottom-14 inset-x-0 z-40 border-t border-[#D4AF37]/40 bg-[#0c0c10]/98 backdrop-blur-lg px-3 py-2.5 sm:px-6 shadow-2xl">
          <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* 오디오 정보 및 재생/일시정지/스킵 버튼 */}
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAudio}
                  className="h-9 w-9 inline-flex items-center justify-center bg-[#D4AF37] text-black hover:bg-[#F59E0B] transition-colors cursor-pointer"
                  title={isPlayingAudio ? '일시정지' : '재생'}
                >
                  {isPlayingAudio ? (
                    <Pause className="h-4 w-4 fill-black" />
                  ) : (
                    <Play className="h-4 w-4 fill-black ml-0.5" />
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSkipTime(-10)}
                    className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="10초 뒤로"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleSkipTime(10)}
                    className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="10초 앞으로"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 제목 & 시간 정보 */}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  🎧 {plan.title} (AI 성우 낭독)
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                </span>
              </div>

              {/* 배속 토글 버튼 */}
              <button
                onClick={handleRateCycle}
                className="inline-flex items-center px-2 py-1 border border-white/10 bg-[#16161c] text-[11px] font-bold text-[#FDE68A] hover:border-[#D4AF37]/50 cursor-pointer"
                title="재생 속도 조절"
              >
                {playbackRate}x
              </button>
            </div>

            {/* 타임라인 진행 바 (Seekbar) */}
            <div className="flex items-center gap-2 w-full sm:w-72">
              <input
                type="range"
                min={0}
                max={audioDuration || 100}
                value={audioCurrentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val;
                  }
                  setAudioCurrentTime(val);
                }}
                className="w-full h-1.5 bg-zinc-800 accent-[#D4AF37] cursor-pointer"
              />
              <button
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setIsPlayingAudio(false);
                  setShowAudioPlayer(false);
                }}
                className="text-zinc-400 hover:text-white p-1 hover:bg-white/10 transition-colors cursor-pointer"
                title="오디오 바 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 인앱 설교 오디오 플레이어 바 */}
      {activeSermon && (
        <div className="fixed bottom-16 sm:bottom-14 inset-x-0 z-40 border-t border-[#D4AF37]/30 bg-[#0f0f14]/95 backdrop-blur-md px-3 py-2 sm:px-6 shadow-2xl">
          <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1 bg-[#D4AF37]/20 border border-[#D4AF37]/40 px-2 py-0.5 text-[10px] font-bold text-[#FDE68A] shrink-0">
                  <Headphones className="h-3 w-3" />
                  <span>설교 오디오</span>
                </span>
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {formatSermonTitle(activeSermon.title)}
                </span>
              </div>
              <button
                onClick={() => setActiveSermon(null)}
                className="sm:hidden text-zinc-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sermonVideoId && (
              <div className="flex items-center gap-2 justify-end">
                <div className="w-full sm:w-72 h-9 overflow-hidden border border-white/10 bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${sermonVideoId}?autoplay=1&playsinline=1`}
                    title="송태근 목사님 설교 플레이어"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="w-full h-full border-0"
                  />
                </div>
                <button
                  onClick={() => setActiveSermon(null)}
                  className="hidden sm:inline-flex text-zinc-400 hover:text-white p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
                  title="설교 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. 하단 고정 네비게이션 액션 바 */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-4 py-2.5 sm:px-6 shadow-2xl">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* 이전/다음 말씀 네비게이션 */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            {adjacent.prev ? (
              <Link
                href={`/plan/${adjacent.prev.category}/${adjacent.prev.week}/${adjacent.prev.day}`}
                className="inline-flex items-center gap-1 border border-white/10 bg-[#16161c] px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
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
                className="inline-flex items-center gap-1 border border-white/10 bg-[#16161c] px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#D4AF37]/50 transition-all cursor-pointer"
              >
                <span>다음 말씀</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* 오늘 통독 완료 토글 버튼 */}
          <button
            onClick={handleToggleComplete}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold shadow-xl transition-all cursor-pointer ${
              isCompleted
                ? 'bg-[#10B981] text-black hover:bg-[#059669]'
                : 'bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] text-black hover:brightness-110'
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
