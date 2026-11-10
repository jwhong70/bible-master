export type BibleCategory = 'new_testament' | 'wisdom' | 'old_testament';

export interface BibleVerse {
  id: string;
  num: string;
  paragraph_index: number;
  paragraph_title: string;
  sermon_url?: string;
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
  review_count: number;     // 복습/통독 회차 (기본 1회 = 총 2회 완독)
  active_track: 'all' | 'new_testament' | 'wisdom' | 'old_testament'; // 활성 트랙
  start_date: string;
}

