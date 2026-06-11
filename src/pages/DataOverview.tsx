import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { GrowthEntry, PregnancyEntry } from '../lib/types';
import { getBabyAgeDisplay } from '../lib/babyData';

type Section = 'pregnancy' | 'baby';

interface ChartPoint {
  label: string;
  weight?: number | null;
  height?: number | null;
  head?: number | null;
  belly?: number | null;
  momWeight?: number | null;
  week?: number;
}

export default function DataOverview() {
  const { baby } = useBaby();
  const [section, setSection] = useState<Section>('baby');
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([]);
  const [pregEntries, setPregEntries] = useState<PregnancyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!baby) { setLoading(false); return; }
    const hasPreg = !baby.birth_date || baby.due_date;
    const hasBaby = !!baby.birth_date;
    setSection(hasBaby ? 'baby' : 'pregnancy');

    Promise.all([
      hasBaby
        ? supabase.from('growth_entries').select('*').eq('baby_id', baby.id).order('measured_at')
        : Promise.resolve({ data: [] }),
      hasPreg
        ? supabase.from('pregnancy_entries').select('*').eq('baby_id', baby.id).order('week')
        : Promise.resolve({ data: [] }),
    ]).then(([{ data: g }, { data: p }]) => {
      setGrowthEntries((g as GrowthEntry[]) ?? []);
      setPregEntries((p as PregnancyEntry[]) ?? []);
      setLoading(false);
    });
  }, [baby]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">📊</div>
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="text-5xl mb-3">📊</div>
        <p className="text-gray-400 text-sm">No baby profile found. Add one in Settings.</p>
      </div>
    );
  }

  const babyChartData: ChartPoint[] = growthEntries.map(e => ({
    label: new Date(e.measured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    weight: e.weight_grams ? +(e.weight_grams / 1000).toFixed(3) : null,
    height: e.height_cm ?? null,
    head: e.head_circumference_cm ?? null,
  }));

  const pregChartData: ChartPoint[] = pregEntries.map(e => ({
    label: `W${e.week}`,
    week: e.week,
    belly: e.belly_circumference_cm ?? null,
    momWeight: e.mother_weight_kg ?? null,
  }));

  const latestGrowth = growthEntries[growthEntries.length - 1];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl text-gray-800">Data & Trends</h2>
        {baby.birth_date && (
          <p className="text-gray-400 text-sm">{getBabyAgeDisplay(baby.birth_date)}</p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        {baby.birth_date && latestGrowth?.weight_grams && (
          <StatCard
            emoji="⚖️"
            label="Weight"
            value={`${(latestGrowth.weight_grams / 1000).toFixed(2)} kg`}
            sub={new Date(latestGrowth.measured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            color="blossom"
          />
        )}
        {baby.birth_date && latestGrowth?.height_cm && (
          <StatCard
            emoji="📏"
            label="Height"
            value={`${latestGrowth.height_cm} cm`}
            sub="Latest measurement"
            color="powder"
          />
        )}
        {baby.birth_weight_grams && (
          <StatCard
            emoji="🍼"
            label="Birth weight"
            value={`${(baby.birth_weight_grams / 1000).toFixed(3)} kg`}
            sub={baby.birth_date ? new Date(baby.birth_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''}
            color="meadow"
          />
        )}
        {baby.birth_height_cm && (
          <StatCard
            emoji="📐"
            label="Birth height"
            value={`${baby.birth_height_cm} cm`}
            sub="At birth"
            color="sunshine"
          />
        )}
        {!baby.birth_date && baby.due_date && pregEntries.length > 0 && (
          <StatCard
            emoji="⚖️"
            label="Mom's weight"
            value={`${pregEntries[pregEntries.length - 1].mother_weight_kg ?? '–'} kg`}
            sub={`Week ${pregEntries[pregEntries.length - 1].week}`}
            color="blossom"
          />
        )}
        {!baby.birth_date && baby.due_date && pregEntries.length > 0 && (
          <StatCard
            emoji="📏"
            label="Belly size"
            value={`${pregEntries[pregEntries.length - 1].belly_circumference_cm ?? '–'} cm`}
            sub={`Week ${pregEntries[pregEntries.length - 1].week}`}
            color="powder"
          />
        )}
      </div>

      {/* Section tabs (only show if both pregnancy and baby data exist) */}
      {baby.birth_date && baby.due_date && (
        <div className="flex gap-2">
          <button onClick={() => setSection('baby')}
            className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-colors ${section === 'baby' ? 'bg-blossom-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            👶 Baby
          </button>
          <button onClick={() => setSection('pregnancy')}
            className={`flex-1 py-2 rounded-2xl text-sm font-semibold transition-colors ${section === 'pregnancy' ? 'bg-blossom-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            🤰 Pregnancy
          </button>
        </div>
      )}

      {/* Charts */}
      {section === 'baby' && (
        <>
          {babyChartData.length >= 2 ? (
            <>
              <ChartCard title="Weight (kg)" color="#ec4899" dataKey="weight" data={babyChartData} unit="kg" />
              <ChartCard title="Height (cm)" color="#38bdf8" dataKey="height" data={babyChartData} unit="cm" />
              {babyChartData.some(d => d.head != null) && (
                <ChartCard title="Head circumference (cm)" color="#a855f7" dataKey="head" data={babyChartData} unit="cm" />
              )}
            </>
          ) : (
            <EmptyChart message="Add at least 2 measurements to see the growth chart." />
          )}

          {/* Measurements table */}
          {growthEntries.length > 0 && (
            <div>
              <h3 className="section-title">All measurements</h3>
              <div className="space-y-2">
                {[...growthEntries].reverse().map(e => (
                  <div key={e.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-gray-700">
                        {new Date(e.measured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {e.weight_grams && <span className="badge bg-blossom-50 text-blossom-600">⚖️ {(e.weight_grams / 1000).toFixed(3)} kg</span>}
                      {e.height_cm && <span className="badge bg-powder-50 text-powder-600">📏 {e.height_cm} cm</span>}
                      {e.head_circumference_cm && <span className="badge bg-lilac-50 text-lilac-600">🔵 {e.head_circumference_cm} cm</span>}
                    </div>
                    {e.notes && <p className="text-xs text-gray-400 mt-2">{e.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {section === 'pregnancy' && (
        <>
          {pregChartData.length >= 2 ? (
            <>
              {pregChartData.some(d => d.momWeight != null) && (
                <ChartCard title="Mom's weight (kg)" color="#ec4899" dataKey="momWeight" data={pregChartData} unit="kg" />
              )}
              {pregChartData.some(d => d.belly != null) && (
                <ChartCard title="Belly circumference (cm)" color="#38bdf8" dataKey="belly" data={pregChartData} unit="cm" />
              )}
            </>
          ) : (
            <EmptyChart message="Log measurements in the Timeline to see pregnancy trends." />
          )}

          {/* Pregnancy log table */}
          {pregEntries.length > 0 && (
            <div>
              <h3 className="section-title">Weekly log</h3>
              <div className="space-y-2">
                {[...pregEntries].reverse().map(e => (
                  <div key={e.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display font-bold text-blossom-600">Week {e.week}</span>
                      <span className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {e.mother_weight_kg && <span className="badge bg-blossom-50 text-blossom-600">⚖️ {e.mother_weight_kg} kg</span>}
                      {e.belly_circumference_cm && <span className="badge bg-powder-50 text-powder-600">📏 {e.belly_circumference_cm} cm</span>}
                      {e.mood && <span className="badge bg-sunshine-50 text-sunshine-700">{e.mood}</span>}
                    </div>
                    {e.symptoms && e.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {e.symptoms.map(s => (
                          <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                    {e.notes && <p className="text-sm text-gray-500 mt-1">{e.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub: string;
  color: 'blossom' | 'powder' | 'meadow' | 'sunshine';
}) {
  const bg: Record<string, string> = {
    blossom: 'bg-blossom-50 border-blossom-100',
    powder: 'bg-powder-50 border-powder-100',
    meadow: 'bg-meadow-50 border-meadow-100',
    sunshine: 'bg-sunshine-50 border-sunshine-100',
  };
  return (
    <div className={`card p-4 border ${bg[color]}`}>
      <p className="text-2xl mb-1">{emoji}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="font-display font-bold text-xl text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, color, dataKey, data, unit }: {
  title: string; color: string; dataKey: string; data: ChartPoint[]; unit: string;
}) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm text-gray-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #fce7f3', fontSize: '12px' }}
            formatter={(v: number) => [`${v} ${unit}`, '']}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-2">📈</div>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
