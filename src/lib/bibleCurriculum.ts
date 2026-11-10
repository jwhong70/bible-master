import seedRaw from '@/data/bible_seed.json';
import { BibleCategory, BiblePlanItem, BibleStudySettings } from '@/types/bible';

const STORAGE_PROGRESS_KEY = 'bible_master_progress_v1';
const STORAGE_SETTINGS_KEY = 'bible_master_settings_v1';

export const DEFAULT_BIBLE_SETTINGS: BibleStudySettings = {
  daily_nt_count: 1,
  daily_wd_count: 1,
  daily_ot_count: 1,
  review_count: 1, // 기본 본학습 1회 + 복습 1회 = 총 2회 완독 시 졸업
  active_track: 'all',
  start_date: new Date().toISOString().slice(0, 10),
};

export const TRACK_INFO: Record<
  BibleCategory,
  { name: string; shortName: string; icon: string; count: number; description: string; color: string }
> = {
  new_testament: {
    name: '신약 (New Testament)',
    shortName: '신약',
    icon: '✝️',
    count: 277,
    description: '복음서, 사도행전, 서신서, 요한계시록',
    color: '#D4AF37', // Gold
  },
  wisdom: {
    name: '시가서 (Wisdom & Poetry)',
    shortName: '시가서',
    icon: '📜',
    count: 239,
    description: '욥기, 시편, 잠언, 전도서, 아가',
    color: '#38BDF8', // Sky
  },
  old_testament: {
    name: '구약 (Old Testament)',
    shortName: '구약',
    icon: '🏛️',
    count: 292,
    description: '모세오경, 역사서, 예언서',
    color: '#A78BFA', // Purple
  },
};

export function getSeedPlans(): BiblePlanItem[] {
  const list = (seedRaw as { bible_plans: BiblePlanItem[] }).bible_plans || [];
  return list;
}

export function loadLocalBibleProgress(): Record<
  string,
  { completed_count: number; last_read_at?: string | null }
> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalBibleProgress(
  progress: Record<string, { completed_count: number; last_read_at?: string | null }>
) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

export function loadLocalBibleSettings(): BibleStudySettings {
  if (typeof window === 'undefined') return DEFAULT_BIBLE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_SETTINGS_KEY);
    return raw ? { ...DEFAULT_BIBLE_SETTINGS, ...JSON.parse(raw) } : DEFAULT_BIBLE_SETTINGS;
  } catch {
    return DEFAULT_BIBLE_SETTINGS;
  }
}

export function saveLocalBibleSettings(settings: BibleStudySettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function buildAllBiblePlans(
  progressMap: Record<string, { completed_count: number; last_read_at?: string | null }> = {}
): BiblePlanItem[] {
  const seedList = getSeedPlans();
  return seedList.map((item) => {
    const prog = progressMap[item.id];
    return {
      ...item,
      completed_count: prog?.completed_count ?? 0,
      last_read_at: prog?.last_read_at ?? null,
    };
  });
}

export function computeBibleSlidingTodo(
  allPlans: BiblePlanItem[],
  settings: BibleStudySettings,
  category: BibleCategory
): {
  todoPlans: BiblePlanItem[];
  graduatedCount: number;
  inReviewCount: number;
  totalPlans: number;
} {
  const categoryPlans = allPlans
    .filter((p) => p.category === category)
    .sort((a, b) => a.week * 10 + a.day - (b.week * 10 + b.day));

  const totalRequired = 1 + Math.max(0, settings.review_count);
  const graduatedCount = categoryPlans.filter((p) => p.completed_count >= totalRequired).length;
  const inReviewCount = categoryPlans.filter(
    (p) => p.completed_count > 0 && p.completed_count < totalRequired
  ).length;

  const quota =
    category === 'new_testament'
      ? settings.daily_nt_count
      : category === 'wisdom'
      ? settings.daily_wd_count
      : settings.daily_ot_count;

  const ungraduated = categoryPlans.filter((p) => p.completed_count < totalRequired);
  const reviewing = ungraduated.filter((p) => p.completed_count > 0);
  const freshNew = ungraduated.filter((p) => p.completed_count === 0).slice(0, Math.max(1, quota));

  const todoMap = new Map<string, BiblePlanItem>();
  for (const item of [...reviewing, ...freshNew]) {
    todoMap.set(item.id, item);
  }

  const todoPlans = Array.from(todoMap.values()).sort(
    (a, b) => a.week * 10 + a.day - (b.week * 10 + b.day)
  );

  return {
    todoPlans,
    graduatedCount,
    inReviewCount,
    totalPlans: categoryPlans.length,
  };
}

export function updatePlanCompletion(
  planId: string,
  delta: number = 1
): Record<string, { completed_count: number; last_read_at?: string | null }> {
  const current = loadLocalBibleProgress();
  const existing = current[planId] || { completed_count: 0 };
  const nextCount = Math.max(0, (existing.completed_count || 0) + delta);
  current[planId] = {
    completed_count: nextCount,
    last_read_at: new Date().toISOString(),
  };
  saveLocalBibleProgress(current);
  return current;
}

export function getPlanByRoute(
  category: BibleCategory,
  week: number,
  day: number,
  progressMap?: Record<string, { completed_count: number; last_read_at?: string | null }>
): BiblePlanItem | undefined {
  const prog = progressMap || loadLocalBibleProgress();
  const all = buildAllBiblePlans(prog);
  return all.find((p) => p.category === category && p.week === week && p.day === day);
}

export function getAdjacentPlans(
  current: BiblePlanItem,
  allPlans: BiblePlanItem[]
): { prev?: BiblePlanItem; next?: BiblePlanItem } {
  const categoryPlans = allPlans
    .filter((p) => p.category === current.category)
    .sort((a, b) => a.week * 10 + a.day - (b.week * 10 + b.day));

  const idx = categoryPlans.findIndex((p) => p.id === current.id);
  return {
    prev: idx > 0 ? categoryPlans[idx - 1] : undefined,
    next: idx >= 0 && idx < categoryPlans.length - 1 ? categoryPlans[idx + 1] : undefined,
  };
}
