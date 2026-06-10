import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, TrendingUp, BookOpen, Camera, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { DiaryEntry, GrowthEntry } from '../lib/types';
import { calculatePregnancyWeek, getDaysUntilDueDate, getWeekInfo } from '../lib/pregnancyData';
import { getBabyAgeDisplay, getBabyAgeMonths, getCurrentStageMilestones } from '../lib/babyData';

export default function Dashboard() {
  const { profile } = useAuth();
  const { baby, loading: babyLoading } = useBaby();
  const navigate = useNavigate();
  const [recentEntries, setRecentEntries] = useState<DiaryEntry[]>([]);
  const [latestGrowth, setLatestGrowth] = useState<GrowthEntry | null>(null);

  useEffect(() => {
    if (!baby) return;

    supabase
      .from('diary_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentEntries((data as DiaryEntry[]) ?? []));

    supabase
      .from('growth_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('measured_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setLatestGrowth(data as GrowthEntry));
  }, [baby]);

  if (babyLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🍼</div>
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="px-4 py-8">
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">🌱</div>
          <h2 className="font-display font-bold text-xl text-gray-800 mb-2">Start your journey</h2>
          <p className="text-gray-500 mb-6 text-sm">
            No baby profile yet. Add one in Settings to begin tracking.
          </p>
          {profile?.role === 'parent' && (
            <button onClick={() => navigate('/settings')} className="btn-primary">
              <Plus size={16} />
              Create baby profile
            </button>
          )}
        </div>
      </div>
    );
  }

  const isPregnancy = !baby.birth_date;
  const pregnancyWeek = isPregnancy && baby.due_date ? calculatePregnancyWeek(baby.due_date) : null;
  const daysLeft = isPregnancy && baby.due_date ? getDaysUntilDueDate(baby.due_date) : null;
  const weekInfo = pregnancyWeek ? getWeekInfo(pregnancyWeek) : null;
  const ageMonths = !isPregnancy && baby.birth_date ? getBabyAgeMonths(baby.birth_date) : null;
  const ageDisplay = !isPregnancy && baby.birth_date ? getBabyAgeDisplay(baby.birth_date) : null;
  const currentMilestones = ageMonths != null ? getCurrentStageMilestones(ageMonths) : [];

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Hero card */}
      {isPregnancy && weekInfo ? (
        <div className="card p-5 bg-gradient-to-br from-blossom-50 to-powder-50 border-blossom-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-blossom-400 font-semibold text-sm">Week {pregnancyWeek} of 40</p>
              <h2 className="font-display font-bold text-2xl text-gray-800">{baby.name}</h2>
            </div>
            <span className="text-4xl">{weekInfo.sizeEmoji}</span>
          </div>
          <p className="text-gray-600 text-sm mb-3">
            Baby is the size of a <strong>{weekInfo.sizeComparison}</strong>
          </p>
          {daysLeft !== null && (
            <div className="bg-white/70 rounded-2xl px-4 py-2 inline-block">
              <span className="text-blossom-600 font-bold">{daysLeft}</span>
              <span className="text-gray-500 text-sm ml-1">days to go</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-blossom-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blossom-300 to-blossom-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((pregnancyWeek ?? 0) / 40) * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-white/60 rounded-2xl">
            <p className="text-xs text-gray-500 font-semibold mb-1">✨ This week</p>
            <p className="text-sm text-gray-700">{weekInfo.babyDevelopment}</p>
          </div>
        </div>
      ) : (
        <div className="card p-5 bg-gradient-to-br from-powder-50 to-meadow-50 border-powder-100">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-powder-500 font-semibold text-sm">{ageDisplay}</p>
              <h2 className="font-display font-bold text-2xl text-gray-800">{baby.name}</h2>
            </div>
            <span className="text-4xl">👶</span>
          </div>
          {latestGrowth && (
            <div className="flex gap-3 mt-3">
              {latestGrowth.weight_grams && (
                <div className="bg-white/70 rounded-2xl px-3 py-2">
                  <p className="text-xs text-gray-400">Weight</p>
                  <p className="font-bold text-gray-800 text-sm">{(latestGrowth.weight_grams / 1000).toFixed(2)} kg</p>
                </div>
              )}
              {latestGrowth.height_cm && (
                <div className="bg-white/70 rounded-2xl px-3 py-2">
                  <p className="text-xs text-gray-400">Height</p>
                  <p className="font-bold text-gray-800 text-sm">{latestGrowth.height_cm} cm</p>
                </div>
              )}
            </div>
          )}
          {currentMilestones.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 font-semibold mb-2">🌟 Milestones to watch</p>
              <div className="flex flex-wrap gap-2">
                {currentMilestones.slice(0, 3).map((m, i) => (
                  <span key={i} className="text-xs bg-white/70 rounded-full px-2.5 py-1 text-gray-600">
                    {m.emoji} {m.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(isPregnancy ? '/pregnancy' : '/growth')}
          className="card p-4 flex items-center gap-3 hover:border-blossom-200 transition-colors text-left"
        >
          {isPregnancy ? (
            <div className="w-10 h-10 rounded-2xl bg-blossom-100 flex items-center justify-center">
              <Heart size={20} className="text-blossom-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-powder-100 flex items-center justify-center">
              <TrendingUp size={20} className="text-powder-500" />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm text-gray-800">{isPregnancy ? 'Pregnancy' : 'Growth'}</p>
            <p className="text-xs text-gray-400">Track & log</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/diary')}
          className="card p-4 flex items-center gap-3 hover:border-blossom-200 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-2xl bg-sunshine-100 flex items-center justify-center">
            <BookOpen size={20} className="text-sunshine-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Diary</p>
            <p className="text-xs text-gray-400">Write a memory</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/gallery')}
          className="card p-4 flex items-center gap-3 hover:border-blossom-200 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-2xl bg-meadow-100 flex items-center justify-center">
            <Camera size={20} className="text-meadow-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800">Gallery</p>
            <p className="text-xs text-gray-400">Photos & memories</p>
          </div>
        </button>

        {isPregnancy && weekInfo && (
          <button
            onClick={() => navigate('/pregnancy')}
            className="card p-4 flex items-center gap-3 hover:border-blossom-200 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-2xl bg-lilac-100 flex items-center justify-center">
              <span className="text-xl">{weekInfo.sizeEmoji}</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">Fun fact</p>
              <p className="text-xs text-gray-400 line-clamp-2">{weekInfo.funFact.slice(0, 50)}…</p>
            </div>
          </button>
        )}
      </div>

      {/* Recent diary entries */}
      {recentEntries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title mb-0">Recent memories</h3>
            <button onClick={() => navigate('/diary')} className="text-blossom-500 text-sm font-semibold">
              See all
            </button>
          </div>
          <div className="space-y-2">
            {recentEntries.map(entry => (
              <button
                key={entry.id}
                onClick={() => navigate('/diary')}
                className="card p-4 w-full text-left hover:border-blossom-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{entry.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{entry.content}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {entry.is_private && (
                      <span className="badge bg-gray-100 text-gray-500">🔒 Private</span>
                    )}
                    <span className="text-xs text-gray-300">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
