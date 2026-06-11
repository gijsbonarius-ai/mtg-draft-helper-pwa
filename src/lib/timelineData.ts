import type { Baby } from './types';
import type { WeekInfo } from './pregnancyData';
import { getWeekInfo, calculatePregnancyWeek } from './pregnancyData';

export interface PregnancyMilestone {
  kind: 'pregnancy';
  week: number;
  emoji: string;
  extraEmoji?: string;
  title: string;
  description: string;
  gradient: string;
  border: string;
  textColor: string;
}

export interface BabyMilestone {
  kind: 'baby';
  ageMonths: number;
  emoji: string;
  extraEmoji?: string;
  title: string;
  description: string;
  gradient: string;
  border: string;
  textColor: string;
}

export const PREGNANCY_MILESTONES: PregnancyMilestone[] = [
  {
    kind: 'pregnancy', week: 4,
    emoji: '🎊', extraEmoji: '✨',
    title: 'Positive test!',
    description: 'A new adventure begins — welcome to the most magical journey of your lives!',
    gradient: 'from-blossom-50 via-blossom-50 to-white', border: 'border-blossom-200', textColor: 'text-blossom-700',
  },
  {
    kind: 'pregnancy', week: 6,
    emoji: '💓', extraEmoji: '🩷',
    title: 'First heartbeat!',
    description: 'A tiny heart is beating for the very first time. The most magical sound in the universe!',
    gradient: 'from-rose-50 via-rose-50 to-white', border: 'border-rose-200', textColor: 'text-rose-700',
  },
  {
    kind: 'pregnancy', week: 8,
    emoji: '🌱', extraEmoji: '🫛',
    title: 'All organs forming',
    description: 'Every major organ is now developing. The foundations for a complete human being are being laid!',
    gradient: 'from-meadow-50 via-meadow-50 to-white', border: 'border-meadow-200', textColor: 'text-meadow-700',
  },
  {
    kind: 'pregnancy', week: 12,
    emoji: '🎀', extraEmoji: '🎉',
    title: 'First trimester complete!',
    description: 'The most critical development phase is complete. The biggest risk has passed — time to celebrate!',
    gradient: 'from-powder-50 via-powder-50 to-white', border: 'border-powder-200', textColor: 'text-powder-600',
  },
  {
    kind: 'pregnancy', week: 16,
    emoji: '👂', extraEmoji: '🎵',
    title: 'Baby can hear you!',
    description: 'Those tiny ears are working! Start talking, singing, and reading — your baby is listening!',
    gradient: 'from-sunshine-50 via-sunshine-50 to-white', border: 'border-sunshine-200', textColor: 'text-sunshine-700',
  },
  {
    kind: 'pregnancy', week: 20,
    emoji: '🎉', extraEmoji: '🌟',
    title: 'Halfway there!',
    description: '20 weeks down, 20 to go! You are exactly at the midpoint of this incredible journey.',
    gradient: 'from-blossom-50 via-lilac-50 to-white', border: 'border-lilac-200', textColor: 'text-lilac-600',
  },
  {
    kind: 'pregnancy', week: 24,
    emoji: '💪', extraEmoji: '🌟',
    title: 'Viability milestone!',
    description: 'A huge milestone — baby could now survive outside the womb with medical help. Growing stronger every day!',
    gradient: 'from-meadow-50 via-meadow-50 to-white', border: 'border-meadow-300', textColor: 'text-meadow-700',
  },
  {
    kind: 'pregnancy', week: 28,
    emoji: '⭐', extraEmoji: '🌙',
    title: 'Third trimester begins!',
    description: 'The final stretch! Baby is growing rapidly and adding essential fat layers. The finish line is in sight!',
    gradient: 'from-lilac-50 via-lilac-50 to-white', border: 'border-lilac-200', textColor: 'text-lilac-700',
  },
  {
    kind: 'pregnancy', week: 37,
    emoji: '🎉', extraEmoji: '✨',
    title: 'Full term!',
    description: 'Baby is officially full term! All systems are go for life outside the womb. Any day now!',
    gradient: 'from-sunshine-50 via-sunshine-50 to-white', border: 'border-sunshine-300', textColor: 'text-sunshine-700',
  },
  {
    kind: 'pregnancy', week: 40,
    emoji: '🍼', extraEmoji: '🌸',
    title: 'Due date!',
    description: 'Your estimated due date has arrived! Only 5% of babies come on exactly this day — how exciting is the wait!',
    gradient: 'from-blossom-50 via-blossom-100 to-white', border: 'border-blossom-300', textColor: 'text-blossom-700',
  },
];

export const BABY_MILESTONES: BabyMilestone[] = [
  {
    kind: 'baby', ageMonths: 0,
    emoji: '🌟', extraEmoji: '🎊',
    title: 'Welcome to the world!',
    description: 'The most magical moment of your lives. The journey of parenthood has officially begun!',
    gradient: 'from-blossom-50 via-blossom-100 to-white', border: 'border-blossom-300', textColor: 'text-blossom-700',
  },
  {
    kind: 'baby', ageMonths: 1,
    emoji: '🌙', extraEmoji: '💛',
    title: 'One month old!',
    description: 'One whole month of love, snuggles, and (very little) sleep. You are doing amazing!',
    gradient: 'from-powder-50 via-powder-50 to-white', border: 'border-powder-200', textColor: 'text-powder-600',
  },
  {
    kind: 'baby', ageMonths: 2,
    emoji: '😊', extraEmoji: '💕',
    title: 'First social smiles!',
    description: 'That first real smile makes every sleepless night completely worth it. Pure, absolute magic!',
    gradient: 'from-sunshine-50 via-sunshine-50 to-white', border: 'border-sunshine-200', textColor: 'text-sunshine-700',
  },
  {
    kind: 'baby', ageMonths: 3,
    emoji: '🌟', extraEmoji: '🎈',
    title: 'Three months old!',
    description: 'Baby is becoming more alert, interactive, and delightful every single day. The fun really begins!',
    gradient: 'from-meadow-50 via-meadow-50 to-white', border: 'border-meadow-200', textColor: 'text-meadow-700',
  },
  {
    kind: 'baby', ageMonths: 6,
    emoji: '🥣', extraEmoji: '🎂',
    title: 'Six months — halfway to one!',
    description: 'Half a year of wonder! Baby may be starting solid foods and learning to sit up. Time flies!',
    gradient: 'from-lilac-50 via-lilac-50 to-white', border: 'border-lilac-200', textColor: 'text-lilac-700',
  },
  {
    kind: 'baby', ageMonths: 9,
    emoji: '🐛', extraEmoji: '🏃',
    title: 'Nine months — on the move!',
    description: 'Baby has spent as long outside as inside! Probably crawling and exploring everything in sight!',
    gradient: 'from-sunshine-50 via-sunshine-50 to-white', border: 'border-sunshine-200', textColor: 'text-sunshine-700',
  },
  {
    kind: 'baby', ageMonths: 12,
    emoji: '🎂', extraEmoji: '🎉',
    title: 'FIRST BIRTHDAY! 🎊',
    description: 'A whole year of wonder, growth, and unconditional love! Happy birthday, little one! What a year!',
    gradient: 'from-blossom-50 via-lilac-50 to-white', border: 'border-blossom-300', textColor: 'text-blossom-700',
  },
  {
    kind: 'baby', ageMonths: 18,
    emoji: '🚶', extraEmoji: '💬',
    title: 'Eighteen months!',
    description: 'A proper little toddler now! Walking (or running!), talking, and having very strong opinions.',
    gradient: 'from-powder-50 via-powder-50 to-white', border: 'border-powder-200', textColor: 'text-powder-600',
  },
  {
    kind: 'baby', ageMonths: 24,
    emoji: '🎂', extraEmoji: '🌈',
    title: 'Second birthday!',
    description: 'Two whole years! A full-blown toddler with a vocabulary, a personality, and big dreams ahead.',
    gradient: 'from-sunshine-50 via-sunshine-50 to-white', border: 'border-sunshine-300', textColor: 'text-sunshine-700',
  },
];

export interface TimelineItem {
  type: 'week' | 'day' | 'milestone-pregnancy' | 'milestone-baby';
  key: string;
  weekNumber?: number;
  weekInfo?: WeekInfo;
  weekStartDate?: Date;
  date?: Date;
  dayNumber?: number;
  dateLabel?: string;
  shortLabel?: string;
  monthLabel?: string;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  milestone?: PregnancyMilestone | BabyMilestone;
}

export interface ContentKeys {
  diary: Set<string>;
  photos: Set<string>;
  data: Set<string>;
}

function getLMP(dueDate: string): Date {
  const d = new Date(dueDate);
  d.setDate(d.getDate() - 280);
  return d;
}

export function dateToWeekKey(date: Date, lmp: Date): string {
  const days = Math.floor((date.getTime() - lmp.getTime()) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return `week-${week}`;
}

export function generateTimeline(baby: Baby | null): TimelineItem[] {
  if (!baby) return [];
  if (!baby.birth_date) return generatePregnancyTimeline(baby);
  return generateBabyTimeline(baby);
}

function generatePregnancyTimeline(baby: Baby): TimelineItem[] {
  if (!baby.due_date) return [];

  const lmp = getLMP(baby.due_date);
  const currentWeek = calculatePregnancyWeek(baby.due_date);
  const items: TimelineItem[] = [];

  for (let w = 1; w <= 42; w++) {
    const start = new Date(lmp);
    start.setDate(start.getDate() + (w - 1) * 7);

    const milestone = PREGNANCY_MILESTONES.find(m => m.week === w);
    if (milestone) {
      items.push({
        type: 'milestone-pregnancy',
        key: `milestone-pregnancy-${w}`,
        isCurrent: false,
        isPast: w < currentWeek,
        isFuture: w > currentWeek,
        milestone,
      });
    }

    items.push({
      type: 'week',
      key: `week-${w}`,
      weekNumber: w,
      weekInfo: getWeekInfo(w),
      weekStartDate: new Date(start),
      shortLabel: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      dateLabel: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      isCurrent: w === currentWeek,
      isPast: w < currentWeek,
      isFuture: w > currentWeek,
    });
  }

  return items;
}

function generateBabyTimeline(baby: Baby): TimelineItem[] {
  const birth = new Date(baby.birth_date!);
  birth.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pre-calculate milestone dates (birth anniversary per month)
  const milestoneByDate = new Map<string, BabyMilestone>();
  BABY_MILESTONES.filter(m => m.ageMonths > 0).forEach(m => {
    const d = new Date(birth);
    d.setMonth(d.getMonth() + m.ageMonths);
    milestoneByDate.set(d.toISOString().split('T')[0], m);
  });

  const items: TimelineItem[] = [];

  // Birth milestone
  items.push({
    type: 'milestone-baby',
    key: 'milestone-birth',
    isCurrent: false,
    isPast: true,
    isFuture: false,
    milestone: BABY_MILESTONES[0],
  });

  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  let cur = new Date(birth);
  let dayNum = 0;
  let lastMonthLabel = '';

  while (cur <= end) {
    const ds = cur.toISOString().split('T')[0];
    const isToday = ds === today.toISOString().split('T')[0];
    const isPast = cur < today;
    const isFuture = cur > today;

    const milestone = milestoneByDate.get(ds);
    if (milestone) {
      items.push({
        type: 'milestone-baby',
        key: `milestone-${milestone.ageMonths}m`,
        isCurrent: false,
        isPast,
        isFuture,
        milestone,
      });
    }

    const monthLabel = cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const displayMonthLabel = monthLabel !== lastMonthLabel ? monthLabel : undefined;
    if (displayMonthLabel) lastMonthLabel = monthLabel;

    items.push({
      type: 'day',
      key: ds,
      date: new Date(cur),
      dayNumber: dayNum,
      shortLabel: cur.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      dateLabel: cur.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      monthLabel: displayMonthLabel,
      isCurrent: isToday,
      isPast,
      isFuture,
    });

    const next = new Date(cur);
    next.setDate(next.getDate() + 1);
    cur = next;
    dayNum++;
  }

  return items;
}

export function getEntryDateForItem(item: TimelineItem, _baby?: Baby): string {
  if (item.type === 'week' && item.weekStartDate) {
    return item.weekStartDate.toISOString().split('T')[0];
  }
  if (item.type === 'day' && item.date) {
    return item.date.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}
