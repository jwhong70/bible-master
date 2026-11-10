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

function extractYouTubeVideoId(url?: string): string | null {
 if (!url) return null;
 const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
 return match ? match[1] : null;
}

function formatSermonTitle(title?: string): string {
 if (!title) return '본문 강해';
 return title.replace(/\[강해\(송태근\s*목사\)\]\s*/, '').trim();
}

export default function BibleReaderClient({ plan: initialPlan }: BibleReaderClientProps) {
 const router = useRouter();
 const [plan, setPlan] = useState<BiblePlanItem>(initialPlan);
 const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
 const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
 const [allNotesExpanded, setAllNotesExpanded] = useState(false);
 const [isPlayingTTS, setIsPlayingTTS] = useState(false);
 const [currentSpeechVerseIndex, setCurrentSpeechVerseIndex] = useState<number | null>(null);

 // 구절별 송태근 목사님 설교 오디오 재생 상태
 const [activeSermon, setActiveSermon] = useState<{ title: string; url: string } | null>(null);
 const sermonVideoId = useMemo(() => extractYouTubeVideoId(activeSermon?.url), [activeSermon?.url]);

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
		const utterance = new SpeechSynthesisUtterance(targetVerse.text);
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
 <span className="text-xs font-semibold text-zinc-300 bg-white/5 px-2 py-0.5 ">
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

 {/* 2. 본문 컨테이너 (모바일 좌우 여백 최소화로 가로폭 극대화) */}
 <main className="mx-auto max-w-4xl px-2.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
 {/* 말씀 카드 대제목 */}
 <div className="border border-[#D4AF37]/30 bg-gradient-to-b from-[#181820] to-[#111116] p-4 sm:p-8 shadow-xl space-y-3 sm:space-y-4">
 <div className="space-y-1.5 w-full">
 <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
 <span className="text-[#D4AF37] font-bold">{trackInfo.shortName} 통독</span>
 <span>•</span>
 <span>{plan.week}주차 {plan.day}일차 ({dayKo})</span>
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

 {/* 상단 컨트롤 버튼 바 (모바일 1줄에 1버튼씩 완전 분리) */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-white/5">
 {/* 🔊 본문 순수 말씀 낭독 (TTS) */}
 <button
 onClick={handleToggleTTS}
 className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
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
 </div>

 {/* 4. 성경 본문 렌더링 (단락별) */}
 <div className="space-y-4 sm:space-y-6">
 {groupedVerses.map(([pTitle, verses], pIndex) => (
 <section
 key={`paragraph-${pIndex}`}
 className="border border-white/10 bg-[#121217] p-3.5 sm:p-7 shadow-lg space-y-3.5"
 >
 {/* 단락 소제목: 모바일 1행 분리 */}
 <div className="pb-2.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
 <h3 className="text-sm sm:text-base font-bold text-[#FDE68A] flex items-center gap-2">
 <span className="inline-block h-2 w-2 rounded-full bg-[#D4AF37] shrink-0" />
 <span>{pTitle}</span>
 </h3>
 <span className="text-xs font-mono text-zinc-500">{verses.length}절</span>
 </div>

 {/* 구절 목록: 모바일 절 번호 1행 분리 및 본문·버튼 좌우 100% 전폭 최대화 */}
 <div className="space-y-3">
 {verses.map((verse) => {
 const globalIdx = plan.verses.findIndex((v) => v.id === verse.id);
 const isCurrentTTS = currentSpeechVerseIndex === globalIdx;
 const hasNotes = verse.notes && verse.notes.length > 0;
 const isNoteOpen = openNotes[verse.id] || false;

 return (
 <div
 key={verse.id}
 className={`group p-3 sm:p-4.5 transition-all space-y-2.5 ${
 isCurrentTTS
 ? 'bg-[#D4AF37]/15 border border-[#D4AF37]'
 : 'bg-[#17171e]/70 border border-white/5 hover:border-white/20'
 }`}
 >
 {/* 1행: 작은 글씨 절 번호 뱃지 (단독 1줄 배치) */}
 <div className="flex items-center justify-between">
 <span className="inline-block text-[11px] font-bold font-mono text-[#D4AF37] select-none bg-[#D4AF37]/10 px-1.5 py-0.5 border border-[#D4AF37]/20">
 {verse.num}절
 </span>
 </div>

 {/* 2행: 성경 본문 말씀 (좌우 100% 전폭 최대화) */}
 <p className={`w-full block font-normal text-zinc-100 leading-relaxed sm:leading-loose ${fontSizeClasses}`}>
 {verse.text}
 </p>

 {/* 3행: 송태근 목사님 설교 버튼 (모바일 100% 전폭 전개) */}
 {verse.sermon_url && (
 <div className="pt-0.5">
 <button
 onClick={() => {
 if (activeSermon?.url === verse.sermon_url) {
 setActiveSermon(null);
 } else {
 setActiveSermon({
 title: formatSermonTitle(verse.sermon_title),
 url: verse.sermon_url!,
 });
 }
 }}
 className={`w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer ${
 activeSermon?.url === verse.sermon_url
 ? 'bg-[#D4AF37] text-black shadow-[#D4AF37]/30 ring-2 ring-[#D4AF37]'
 : 'border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FDE68A] hover:bg-[#D4AF37] hover:text-black'
 }`}
 >
 <Headphones className="h-3.5 w-3.5 shrink-0" />
 <span className="truncate">
 {activeSermon?.url === verse.sermon_url
 ? '🎙️ 설교 재생 중 (클릭 시 닫기)'
 : `🎙️ 송태근 목사님 설교 듣기: ${formatSermonTitle(verse.sermon_title)}`}
 </span>
 </button>
 </div>
 )}

 {/* 4행: 말씀 강해(NOTE) 토글 버튼 (모바일 100% 전폭 전개) */}
 {hasNotes && (
 <div className="pt-0.5 space-y-2">
 <button
 onClick={() => toggleNote(verse.id)}
 className={`w-full sm:w-auto inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
 isNoteOpen
 ? 'bg-[#D4AF37]/20 text-[#FDE68A] border border-[#D4AF37]/40'
 : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 border border-white/5'
 }`}
 >
 <Sparkles className="h-3 w-3 text-[#D4AF37] shrink-0" />
 <span>말씀 강해 ({verse.notes.length}개)</span>
 {isNoteOpen ? (
 <ChevronUp className="h-3 w-3 shrink-0 ml-auto sm:ml-0" />
 ) : (
 <ChevronDown className="h-3 w-3 shrink-0 ml-auto sm:ml-0" />
 )}
 </button>

 {/* 펼쳐진 강해(NOTE) 아코디언 */}
 {isNoteOpen && (
 <div className="border border-[#D4AF37]/20 bg-[#1b1b24] p-3 sm:p-4 space-y-2 text-xs sm:text-sm text-zinc-300 animate-in fade-in slide-in-from-top-1 duration-150">
 {verse.notes.map((note, nIdx) => {
 // Markdown 볼드체 구문 파싱: - **주제**: 내용
 const match = note.match(/^-\s*\*\*(.*?)\*\*:\s*(.*)$/);
 if (match) {
 const [, topic, body] = match;
 return (
 <div key={nIdx} className="leading-relaxed flex items-start gap-2">
 <span className="text-[#D4AF37] mt-1 shrink-0">✦</span>
 <div className="flex-1">
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
 );
 })}
 </div>
 </section>
 ))}
 </div>
 </main>

 {/* 5. 화면 하단 고정 송태근 목사님 설교 오디오 플레이어 (본문 스크롤하며 자유 청취) */}
 {activeSermon && (
 <div className="fixed bottom-[68px] sm:bottom-[60px] inset-x-0 z-40 px-3 py-2 sm:px-6 bg-[#0a0a10]/95 backdrop-blur-md border-t border-[#D4AF37]/40 shadow-2xl animate-in slide-in-from-bottom duration-200">
 <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
 <div className="flex items-center justify-between gap-2 min-w-0">
 <div className="flex items-center gap-2 min-w-0">
 <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37] text-black text-xs shrink-0 font-bold animate-pulse">
 🎙️
 </span>
 <div className="min-w-0">
 <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
 송태근 목사님 설교 청취 중
 </p>
 <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
 {activeSermon.title}
 </h4>
 </div>
 </div>
 <button
 onClick={() => setActiveSermon(null)}
 className="text-zinc-400 hover:text-white p-1 hover:bg-white/10 transition-colors sm:hidden"
 title="설교 닫기"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* 인앱 유튜브 오디오 플레이어 (화면 이탈 및 광고 방지) */}
 <div className="flex items-center gap-2 justify-end">
 {sermonVideoId && (
 <div className="w-full sm:w-72 h-9 overflow-hidden border border-white/10 bg-black">
 <iframe
 src={`https://www.youtube.com/embed/${sermonVideoId}?autoplay=1&playsinline=1`}
 title="송태근 목사님 설교 플레이어"
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 className="w-full h-full border-0"
 />
 </div>
 )}
 <button
 onClick={() => setActiveSermon(null)}
 className="hidden sm:inline-flex text-zinc-400 hover:text-white p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
 title="설교 닫기"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 </div>
 )}

 {/* 6. 하단 고정 플로팅 액션 바: 모바일 1줄 전폭 분리 */}
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

 {/* 중앙: 오늘 통독 완료 토글 버튼 (모바일 100% 전폭 단독 점유) */}
 <button
 onClick={handleToggleComplete}
 className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold shadow-xl transition-all cursor-pointer ${
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
