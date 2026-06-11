import { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import {
  generateTimeline,
  dateToWeekKey,
  type TimelineItem,
  type ContentKeys,
} from '../lib/timelineData';
import { getDaysUntilDueDate } from '../lib/pregnancyData';
import { getBabyAgeDisplay } from '../lib/babyData';
import DayDetail from '../components/DayDetail';

function getLMP(dueDate: string): Date {
  const d = new Date(dueDate);
  d.setDate(d.getDate() - 280);
  return d;
}

export default function Timeline() {
  const { profile } = useAuth();
  const { baby, loading: babyLoading } = useBaby();
  const navigate = useNavigate();

  const [contentKeys, setContentKeys] = useState<ContentKeys>({ diary: new Set(), photos: new Set(), data: new Set() });
  const [selected, setSelected] = useState<TimelineItem | null>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => generateTimeline(baby), [baby]);

  // Scroll to current week/day after data loads
  useEffect(() => {
    if (!babyLoading && currentRef.current) {
      setTimeout(() => {
        currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [babyLoading, items.length]);

  const loadContentKeys = async () => {
    if (!baby) return;

    const ck: ContentKeys = { diary: new Set(), photos: new Set(), data: new Set() };
    const isPregnancy = !baby.birth_date;

    if (isPregnancy && baby.due_date) {
      const lmp = getLMP(baby.due_date);

      const [{ data: pregData }, { data: diaryData }, { data: photoData }] = await Promise.all([
        supabase.from('pregnancy_entries').select('week').eq('baby_id', baby.id),
        supabase.from('diary_entries').select('entry_date').eq('baby_id', baby.id).not('entry_date', 'is', null),
        supabase.from('photos').select('taken_at').eq('baby_id', baby.id),
      ]);

      pregData?.forEach((e: { week: number }) => ck.data.add(`week-${e.week}`));
      diaryData?.forEach((e: { entry_date: string }) => {
        if (e.entry_date) ck.diary.add(dateToWeekKey(new Date(e.entry_date), lmp));
      });
      photoData?.forEach((e: { taken_at: string }) => {
        if (e.taken_at) ck.photos.add(dateToWeekKey(new Date(e.taken_at), lmp));
      });
    } else if (baby.birth_date) {
      const [{ data: diaryData }, { data: photoData }, { data: growthData }] = await Promise.all([
        supabase.from('diary_entries').select('entry_date').eq('baby_id', baby.id).not('entry_date', 'is', null),
        supabase.from('photos').select('taken_at').eq('baby_id', baby.id),
        supabase.from('growth_entries').select('measured_at').eq('baby_id', baby.id),
      ]);

      diaryData?.forEach((e: { entry_date: string }) => { if (e.entry_date) ck.diary.add(e.entry_date); });
      photoData?.forEach((e: { taken_at: string }) => { if (e.taken_at) ck.photos.add(e.taken_at.split('T')[0]); });
      growthData?.forEach((e: { measured_at: string }) => { if (e.measured_at) ck.data.add(e.measured_at); });
    }

    setContentKeys(ck);
  };

  useEffect(() => { loadContentKeys(); }, [baby]);

  if (babyLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-5xl animate-bounce mb-3">🌸</div>
        <p className="text-blossom-400 font-semibold">Loading your journey...</p>
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="text-6xl mb-4">🌱</div>
        <h2 className="font-display font-bold text-2xl text-gray-800 mb-2">Start your journey</h2>
        <p className="text-gray-400 text-sm mb-6">Create a baby profile to begin your timeline.</p>
        {profile?.role === 'parent' && (
          <button onClick={() => navigate('/settings')} className="btn-primary">
            <Plus size={16} /> Create baby profile
          </button>
        )}
      </div>
    );
  }

  const isPregnancy = !baby.birth_date;
  const heroSubtitle = isPregnancy && baby.due_date
    ? `${getDaysUntilDueDate(baby.due_date)} days to go`
    : baby.birth_date
    ? getBabyAgeDisplay(baby.birth_date)
    : '';

  return (
    <div className="pb-6" ref={containerRef}>
      {/* Hero banner */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-blossom-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-blossom-700">{baby.name}'s Journey</h2>
            <p className="text-gray-400 text-xs">{heroSubtitle}</p>
          </div>
          <button
            onClick={() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="text-xs text-blossom-500 font-semibold px-3 py-1.5 rounded-full bg-blossom-50 hover:bg-blossom-100"
          >
            Today ↓
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative px-4 pt-4">
        {/* Vertical line */}
        <div className="absolute left-[27px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-blossom-300 via-blossom-100 to-transparent" />

        <div className="space-y-1">
          {items.map(item => {
            if (item.type === 'milestone-pregnancy' || item.type === 'milestone-baby') {
              const m = item.milestone!;
              return (
                <div key={item.key} className="relative pl-10 py-2">
                  {/* Diamond on line */}
                  <div
                    className={`absolute left-[18px] top-[18px] w-4 h-4 rotate-45 rounded-sm border-2 border-white
                      ${item.isPast || item.isCurrent ? 'bg-blossom-400' : 'bg-gray-200'}`}
                  />
                  <div className={`rounded-3xl p-4 border bg-gradient-to-br ${m.gradient} ${m.border}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span className="text-3xl leading-none">{m.emoji}</span>
                        {m.extraEmoji && <span className="text-lg leading-none mt-0.5">{m.extraEmoji}</span>}
                      </div>
                      <div className="flex-1">
                        <p className={`font-display font-bold text-base ${m.textColor}`}>{m.title}</p>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">{m.description}</p>
                        {'week' in m && (
                          <p className={`text-xs font-semibold mt-2 ${m.textColor} opacity-60`}>Week {m.week}</p>
                        )}
                        {'ageMonths' in m && m.ageMonths > 0 && (
                          <p className={`text-xs font-semibold mt-2 ${m.textColor} opacity-60`}>{m.ageMonths} {m.ageMonths === 1 ? 'month' : 'months'} old</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Week or Day row
            const entryKey = item.key;
            const hasDiary = contentKeys.diary.has(entryKey);
            const hasPhotos = contentKeys.photos.has(entryKey);
            const hasData = contentKeys.data.has(entryKey);
            const hasAny = hasDiary || hasPhotos || hasData;

            return (
              <div key={item.key} ref={item.isCurrent ? currentRef : undefined}>
                {/* Month label for baby days */}
                {item.monthLabel && (
                  <div className="pl-10 py-2">
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">{item.monthLabel}</p>
                  </div>
                )}

                <button
                  onClick={() => !item.isFuture && setSelected(item)}
                  className={`relative w-full flex items-center gap-3 pl-10 pr-3 py-2.5 rounded-2xl text-left transition-all
                    ${item.isCurrent ? 'bg-blossom-50' : ''}
                    ${!item.isFuture ? 'hover:bg-gray-50 active:bg-gray-100' : 'cursor-default'}
                  `}
                >
                  {/* Dot on the line */}
                  <div
                    className={`absolute left-[19px] w-3 h-3 rounded-full border-2 border-white flex-shrink-0 transition-all
                      ${item.isCurrent ? 'bg-blossom-500 shadow-glow-pink scale-125' : ''}
                      ${!item.isCurrent && hasAny ? 'bg-blossom-400' : ''}
                      ${!item.isCurrent && !hasAny && item.isPast ? 'bg-gray-200' : ''}
                      ${item.isFuture ? 'bg-gray-100 border-gray-100' : ''}
                    `}
                  />

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.type === 'week' ? (
                        <span className={`font-semibold text-sm ${item.isCurrent ? 'text-blossom-600' : item.isFuture ? 'text-gray-300' : 'text-gray-700'}`}>
                          Week {item.weekNumber}
                        </span>
                      ) : (
                        <span className={`font-semibold text-sm ${item.isCurrent ? 'text-blossom-600' : item.isFuture ? 'text-gray-300' : 'text-gray-700'}`}>
                          {item.shortLabel}
                        </span>
                      )}
                      {item.isCurrent && (
                        <span className="badge bg-blossom-100 text-blossom-600 text-xs">Today</span>
                      )}
                    </div>
                    {item.type === 'week' && item.weekInfo && (
                      <p className={`text-xs mt-0.5 ${item.isFuture ? 'text-gray-200' : 'text-gray-400'}`}>
                        {item.shortLabel}
                      </p>
                    )}
                  </div>

                  {/* Right side: emoji + content dots + arrow */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.type === 'week' && item.weekInfo && (
                      <span className={`text-lg ${item.isFuture ? 'opacity-30' : ''}`}>{item.weekInfo.sizeEmoji}</span>
                    )}

                    {hasAny && !item.isFuture && (
                      <div className="flex gap-1 items-center">
                        {hasDiary && <div className="w-1.5 h-1.5 rounded-full bg-blossom-400" title="Diary" />}
                        {hasPhotos && <div className="w-1.5 h-1.5 rounded-full bg-powder-400" title="Photos" />}
                        {hasData && <div className="w-1.5 h-1.5 rounded-full bg-sunshine-400" title="Data" />}
                      </div>
                    )}

                    {!item.isFuture && (
                      <ChevronRight size={14} className={`${item.isCurrent ? 'text-blossom-400' : 'text-gray-200'}`} />
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* End of timeline */}
        <div className="pl-10 py-8 text-center">
          <div className="text-3xl mb-2">🌈</div>
          <p className="text-gray-300 text-xs">The adventure continues…</p>
        </div>
      </div>

      {/* Day detail modal */}
      {selected && (
        <DayDetail
          item={selected}
          baby={baby}
          onClose={() => setSelected(null)}
          onSave={() => {
            setSelected(null);
            loadContentKeys();
          }}
        />
      )}
    </div>
  );
}
