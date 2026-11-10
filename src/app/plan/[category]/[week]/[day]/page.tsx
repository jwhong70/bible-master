import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BibleReaderClient from '@/components/BibleReaderClient';
import { getSeedPlans, TRACK_INFO } from '@/lib/bibleCurriculum';
import { BibleCategory } from '@/types/bible';

interface Props {
  params: Promise<{
    category: string;
    week: string;
    day: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, week, day } = await params;
  const plans = getSeedPlans();
  const plan = plans.find(
    (p) =>
      p.category === category &&
      p.week === Number(week) &&
      p.day === Number(day)
  );

  if (!plan) {
    return {
      title: '말씀을 찾을 수 없습니다 | BIBLE MASTER',
    };
  }

  const trackInfo = TRACK_INFO[plan.category as BibleCategory];
  return {
    title: `${plan.title} (${trackInfo?.shortName || ''} ${plan.week}주차 ${plan.day}일) | BIBLE MASTER`,
    description: `${plan.title} 말씀 통독 및 송태근 목사 강해 해설 (${plan.verse_count}개 절)`,
  };
}

export default async function PlanPage({ params }: Props) {
  const { category, week, day } = await params;
  const plans = getSeedPlans();
  const plan = plans.find(
    (p) =>
      p.category === category &&
      p.week === Number(week) &&
      p.day === Number(day)
  );

  if (!plan) {
    notFound();
  }

  return <BibleReaderClient plan={plan} />;
}

