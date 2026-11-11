import seedRaw from '@/data/bible_seed.json';
import { BibleCategory, BiblePlanItem, BibleStudySettings, WeeklyBiblePlanGroup } from '@/types/bible';

const STORAGE_PROGRESS_KEY = 'bible_master_progress_v1';
const STORAGE_SETTINGS_KEY = 'bible_master_settings_v1';

export const DEFAULT_BIBLE_SETTINGS: BibleStudySettings = {
  daily_nt_count: 1,
  daily_wd_count: 1,
  daily_ot_count: 1,
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

export const DAY_OF_WEEK_KO: Record<number, { dayName: string; full: string }> = {
  1: { dayName: '월', full: '월요일' },
  2: { dayName: '화', full: '화요일' },
  3: { dayName: '수', full: '수요일' },
  4: { dayName: '목', full: '목요일' },
  5: { dayName: '금', full: '금요일' },
  6: { dayName: '토', full: '토요일' },
  7: { dayName: '일', full: '일요일' },
};

export function getSeedPlans(): BiblePlanItem[] {
  const list = ((seedRaw as unknown) as { bible_plans: BiblePlanItem[] }).bible_plans || [];
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

/**
 * 복습 제거: 1회독 완료 시 즉시 완독(졸업) 처리
 */
export function computeBibleDailyTodo(
  allPlans: BiblePlanItem[],
  settings: BibleStudySettings,
  category: BibleCategory
): {
  todoPlans: BiblePlanItem[];
  completedCount: number;
  totalPlans: number;
} {
  const categoryPlans = allPlans
    .filter((p) => p.category === category)
    .sort((a, b) => a.week * 10 + a.day - (b.week * 10 + b.day));

  const completedCount = categoryPlans.filter((p) => p.completed_count >= 1).length;

  const quota =
    category === 'new_testament'
      ? settings.daily_nt_count
      : category === 'wisdom'
      ? settings.daily_wd_count
      : settings.daily_ot_count;

  // 아직 안 읽은 분량 중에서 오늘의 목표 개수(quota)만큼 추천
  const unreadPlans = categoryPlans.filter((p) => p.completed_count === 0);
  const todoPlans = unreadPlans.slice(0, Math.max(1, quota));

  return {
    todoPlans,
    completedCount,
    totalPlans: categoryPlans.length,
  };
}

/**
 * 주간 단위 (1~52주차별) 그룹화
 */
export function buildWeeklyBibleGroups(
  allPlans: BiblePlanItem[],
  category?: BibleCategory
): WeeklyBiblePlanGroup[] {
  let targetPlans = allPlans;
  if (category) {
    targetPlans = targetPlans.filter((p) => p.category === category);
  }

  const weekMap = new Map<number, BiblePlanItem[]>();
  for (const p of targetPlans) {
    if (!weekMap.has(p.week)) {
      weekMap.set(p.week, []);
    }
    weekMap.get(p.week)!.push(p);
  }

  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
  return sortedWeeks.map((week) => {
    const plans = weekMap.get(week)!.sort((a, b) => a.day - b.day);
    const completedCount = plans.filter((p) => p.completed_count >= 1).length;
    return {
      week,
      plans,
      completedCount,
      totalCount: plans.length,
      isAllCompleted: completedCount === plans.length && plans.length > 0,
    };
  });
}

export function updatePlanCompletion(
  planId: string,
  targetCompletedState?: boolean
): Record<string, { completed_count: number; last_read_at?: string | null }> {
  const current = loadLocalBibleProgress();
  const existing = current[planId] || { completed_count: 0 };
  
  let nextCount = 1;
  if (targetCompletedState !== undefined) {
    nextCount = targetCompletedState ? 1 : 0;
  } else {
    // 토글: 이미 1 이상이면 0으로, 0이면 1로
    nextCount = existing.completed_count >= 1 ? 0 : 1;
  }

  current[planId] = {
    completed_count: nextCount,
    last_read_at: nextCount > 0 ? new Date().toISOString() : null,
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
