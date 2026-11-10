export type BibleCategory = 'new_testament' | 'wisdom' | 'old_testament';

export interface BibleVerse {
  id: string;
  num: string;
  paragraph_index: number;
  paragraph_title: string;
  sermon_url?: string;
  audio_url?: string;
  text: string;
  notes: string[];
}

export interface BiblePlanItem {
  id: string;
  category: BibleCategory;
  category_name: string; // 신약, 시가서, 구약
  week: number;
  day: number;
  title: string;
  sermon_title?: string;
  sermon_url?: string;
  audio_url?: string; // MP3 순수 음성 파일 URL (Supabase CDN)
  paragraph_count: number;
  verse_count: number;
  completed_count: number;
  last_read_at?: string | null;
  verses: BibleVerse[];
}

export interface BibleStudySettings {
  daily_nt_count: number;   // 신약 하루 목표 (기본 1개)
  daily_wd_count: number;   // 시가서 하루 목표 (기본 1개)
  daily_ot_count: number;   // 구약 하루 목표 (기본 1개)
  active_track: 'all' | 'new_testament' | 'wisdom' | 'old_testament'; // 활성 트랙
  start_date: string;
}

export interface WeeklyBiblePlanGroup {
  week: number;
  plans: BiblePlanItem[];
  completedCount: number;
  totalCount: number;
  isAllCompleted: boolean;
}
