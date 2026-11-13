"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
 prompt: () => Promise<void>;
 userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
 const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
 const [isVisible, setIsVisible] = useState(false);
 const [isIOS, setIsIOS] = useState(false);
 const [isKakao, setIsKakao] = useState(false);
 const [showIOSModal, setShowIOSModal] = useState(false);

 useEffect(() => {
 if (typeof window === "undefined") return;

 try {
 // 1. 이미 PWA 독립 앱(standalone)으로 실행 중인지 확인
 const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
 if (isStandalone) return;

 // 2. 이미 설치 완료된 이력이 있는지 확인
 if (localStorage.getItem("bible_master_pwa_installed") === "true") return;

 // 3. 7일 이내에 닫기를 눌렀는지 확인
 const dismissedTime = localStorage.getItem("bible_master_pwa_dismissed");
 if (dismissedTime) {
 const diffDays = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60 * 24);
 if (diffDays < 7) return;
 }
 } catch {
 // ignore
 }

 // 4. 모바일 기기 또는 768px 미만 화면 감지
 const userAgent = (window.navigator?.userAgent || "").toLowerCase();
 const isMobileDevice =
 /iphone|ipad|ipod|android|blackberry|iemobile|opera mini|mobile/i.test(userAgent) ||
 window.innerWidth < 768;
 if (!isMobileDevice) return;

 // 5. 앱 설치 완료 이벤트 감지
 const handleAppInstalled = () => {
 setIsVisible(false);
 try {
 localStorage.setItem("bible_master_pwa_installed", "true");
 } catch {}
 };
 window.addEventListener("appinstalled", handleAppInstalled);

 // 6. 안드로이드 크롬 PWA 설치 신호 감지
 const handleBeforeInstallPrompt = (e: Event) => {
 e.preventDefault();
 setDeferredPrompt(e as BeforeInstallPromptEvent);
 };
 window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

 // 7. iOS 및 인앱 브라우저(카카오톡 등) 환경 감지
 const checkIsIOS = /iphone|ipad|ipod/i.test(userAgent);
 const checkIsKakao = /kakaotalk/i.test(userAgent);
 setIsIOS(checkIsIOS);
 setIsKakao(checkIsKakao);

 // 최초 1.2초 후 자연스럽게 배너 노출
 const timer = setTimeout(() => {
 setIsVisible(true);
 }, 1200);

 return () => {
 clearTimeout(timer);
 window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
 window.removeEventListener("appinstalled", handleAppInstalled);
 };
 }, []);

 const handleInstallClick = async () => {
 // 카카오톡 등 인앱 브라우저일 경우 기본 브라우저 열기 안내
 if (isKakao) {
 const currentUrl = window.location.href;
 window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
 return;
 }

 // 안드로이드 크롬/웨일 등 (표준 PWA 설치 API)
 if (deferredPrompt) {
 try {
 await deferredPrompt.prompt();
 const choiceResult = await deferredPrompt.userChoice;
 if (choiceResult.outcome === "accepted") {
 setIsVisible(false);
 try {
 localStorage.setItem("bible_master_pwa_installed", "true");
 } catch {}
 }
 setDeferredPrompt(null);
 } catch {
 setShowIOSModal(true);
 }
 return;
 }

 // iOS Safari 등 (안내 모달 노출)
 setShowIOSModal(true);
 };

 const handleDismiss = (e: React.MouseEvent) => {
 e.stopPropagation();
 setIsVisible(false);
 try {
 localStorage.setItem("bible_master_pwa_dismissed", Date.now().toString());
 } catch {}
 };

 if (!isVisible) return null;

 return (
 <>
 {/* 화면 최하단 PWA 앱 설치 유도 플로팅 배너 */}
 <aside
 aria-label="성경 통독 앱 설치 안내"
 onClick={handleInstallClick}
 className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 border border-[#EA580C]/40 bg-[#121218]/95 backdrop-blur-xl p-3 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 cursor-pointer hover:border-[#EA580C]/70"
 >
 <div className="flex items-center justify-between gap-3">
 {/* 좌측 앱 아이콘 & 문구 */}
 <div className="flex items-center gap-2.5 min-w-0">
 <div className="relative h-11 w-11 shrink-0 overflow-hidden border border-[#EA580C]/40 bg-[#0d0d12] shadow-inner p-1">
 <Image
 src="/icon-192x192.png"
 alt="성경 통독 앱 아이콘"
 width={40}
 height={40}
 className="h-full w-full object-contain"
 priority
 />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-1.5">
 <span className="text-xs sm:text-sm font-black text-white truncate">
 성경 마스터 (1년 1독)
 </span>
 <span className="bg-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-orange-300">
 앱 추천
 </span>
 </div>
 <p className="text-[11px] text-zinc-400 truncate">
 홈 화면에 추가하여 매일 말씀 통독하기
 </p>
 </div>
 </div>

 {/* 우측 액션 버튼 & 닫기 */}
 <div className="flex items-center gap-1.5">
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleInstallClick();
 }}
 className="bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-lg transition-transform active:scale-95 hover:bg-brand-hover cursor-pointer"
 >
 {isKakao ? "브라우저로 열기" : "1초 설치"}
 </button>
 <button
 onClick={handleDismiss}
 aria-label="닫기"
 className="p-1 text-zinc-400 hover:text-white cursor-pointer"
 >
 <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>
 </aside>

 {/* 모바일 홈 화면 추가 3단계 안내 모달 */}
 {showIOSModal && (
 <div
 role="dialog"
 aria-modal="true"
 onClick={() => setShowIOSModal(false)}
 className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
 >
 <div
 onClick={(e) => e.stopPropagation()}
 className="w-full max-w-sm border border-[#EA580C]/40 bg-[#14141d] p-5 shadow-2xl space-y-4"
 >
 <div className="flex items-center justify-between border-b border-white/10 pb-3">
 <div className="flex items-center gap-2">
 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs font-black">
 📖
 </span>
 <h3 className="text-base font-bold text-white">
 {isIOS ? "아이폰 홈 화면에 추가하기" : "앱으로 간편하게 이용하기"}
 </h3>
 </div>
 <button
 onClick={() => setShowIOSModal(false)}
 className="text-zinc-400 hover:text-white p-1 cursor-pointer"
 aria-label="닫기"
 >
 ✕
 </button>
 </div>

 <p className="text-xs text-zinc-300 leading-relaxed">
 사파리(Safari) 또는 브라우저에서 아래 3단계를 진행하시면 스마트폰 바탕화면에 성경 통독 앱이 바로 추가됩니다:
 </p>

 <div className="space-y-2.5 text-xs text-zinc-200">
 <div className="flex items-start gap-2.5 bg-white/5 p-2.5 border border-white/5">
 <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 font-bold text-orange-300 text-[11px]">
 1
 </span>
 <p className="leading-tight">
 브라우저 하단(또는 상단)의{" "}
 <strong className="text-orange-300 font-bold">공유 버튼</strong>
 (네모에 위쪽 화살표 기호)을 터치합니다.
 </p>
 </div>

 <div className="flex items-start gap-2.5 bg-white/5 p-2.5 border border-white/5">
 <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 font-bold text-orange-300 text-[11px]">
 2
 </span>
 <p className="leading-tight">
 메뉴를 아래로 스크롤하여{" "}
 <strong className="text-orange-300 font-bold">[홈 화면에 추가]</strong>
 (⊕ 아이콘)를 선택합니다.
 </p>
 </div>

 <div className="flex items-start gap-2.5 bg-white/5 p-2.5 border border-white/5">
 <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 font-bold text-orange-300 text-[11px]">
 3
 </span>
 <p className="leading-tight">
 우측 상단의 <strong className="text-orange-300 font-bold">[추가]</strong>를
 누르면 바탕화면에 성경 아이콘이 생성됩니다!
 </p>
 </div>
 </div>

 <button
 onClick={() => setShowIOSModal(false)}
 className="w-full bg-brand py-2.5 text-xs font-bold text-white shadow-lg hover:bg-brand-hover cursor-pointer"
 >
 확인했습니다
 </button>
 </div>
 </div>
 )}
 </>
 );
}
