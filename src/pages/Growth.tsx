import { useEffect, useState, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { GrowthEntry, Milestone } from '../lib/types';
import { getBabyAgeDisplay } from '../lib/babyData';

type ChartView = 'weight' | 'height' | 'head';

export default function Growth() {
  const { profile } = useAuth();
  const { baby } = useBaby();
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [chartView, setChartView] = useState<ChartView>('weight');
  const [showGrowthForm, setShowGrowthForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Growth form
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().split('T')[0]);
  const [weightGrams, setWeightGrams] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [growthNotes, setGrowthNotes] = useState('');

  // Milestone form
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(new Date().toISOString().split('T')[0]);
  const [milestoneType, setMilestoneType] = useState<Milestone['milestone_type']>('motor');
  const [milestonePrivate, setMilestonePrivate] = useState(false);

  const isParent = profile?.role === 'parent';

  const fetchData = async () => {
    if (!baby) return;
    const { data: g } = await supabase
      .from('growth_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('measured_at');
    setEntries((g as GrowthEntry[]) ?? []);

    const { data: m } = await supabase
      .from('milestones')
      .select('*')
      .eq('baby_id', baby.id)
      .order('achieved_at', { ascending: false });
    setMilestones((m as Milestone[]) ?? []);
  };

  useEffect(() => { fetchData(); }, [baby]);

  const handleGrowthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!baby || !isParent) return;
    setSaving(true);
    await supabase.from('growth_entries').insert({
      baby_id: baby.id,
      measured_at: measuredAt,
      weight_grams: weightGrams ? parseInt(weightGrams) : null,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      head_circumference_cm: headCm ? parseFloat(headCm) : null,
      notes: growthNotes || null,
      created_by: profile!.id,
    });
    setSaving(false);
    setShowGrowthForm(false);
    setWeightGrams(''); setHeightCm(''); setHeadCm(''); setGrowthNotes('');
    fetchData();
  };

  const handleMilestoneSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!baby || !isParent) return;
    setSaving(true);
    await supabase.from('milestones').insert({
      baby_id: baby.id,
      title: milestoneTitle,
      description: milestoneDesc || null,
      achieved_at: milestoneDate,
      milestone_type: milestoneType,
      is_private: milestonePrivate,
      created_by: profile!.id,
    });
    setSaving(false);
    setShowMilestoneForm(false);
    setMilestoneTitle(''); setMilestoneDesc('');
    fetchData();
  };

  const chartData = entries.map(e => ({
    date: new Date(e.measured_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    weight: e.weight_grams ? +(e.weight_grams / 1000).toFixed(3) : null,
    height: e.height_cm ?? null,
    head: e.head_circumference_cm ?? null,
  }));

  const milestoneTypeColors: Record<string, string> = {
    motor: 'bg-powder-100 text-powder-700',
    social: 'bg-blossom-100 text-blossom-700',
    language: 'bg-sunshine-100 text-sunshine-700',
    cognitive: 'bg-lilac-100 text-lilac-700',
    other: 'bg-gray-100 text-gray-600',
  };

  if (!baby) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-5xl mb-3">📈</div>
        <p className="text-gray-500">No baby profile found. Add one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Baby info */}
      <div className="card p-4 bg-gradient-to-br from-powder-50 to-meadow-50 border-powder-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-powder-500 font-semibold text-sm">Growth tracker</p>
            <h2 className="font-display font-bold text-xl text-gray-800">{baby.name}</h2>
            {baby.birth_date && (
              <p className="text-gray-400 text-sm">{getBabyAgeDisplay(baby.birth_date)}</p>
            )}
          </div>
          {entries.length > 0 && entries[entries.length - 1].weight_grams && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Latest weight</p>
              <p className="font-display font-bold text-xl text-gray-800">
                {(entries[entries.length - 1].weight_grams! / 1000).toFixed(2)} kg
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="card p-4">
          <div className="flex gap-2 mb-4">
            {(['weight', 'height', 'head'] as ChartView[]).map(v => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${chartView === v ? 'bg-blossom-500 text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {v === 'weight' ? '⚖️ Weight' : v === 'height' ? '📏 Height' : '🔵 Head'}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #fce7f3', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey={chartView}
                stroke="#ec4899"
                strokeWidth={2.5}
                dot={{ fill: '#ec4899', r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Action buttons */}
      {isParent && (
        <div className="flex gap-3">
          <button onClick={() => setShowGrowthForm(!showGrowthForm)} className="btn-primary flex-1">
            <Plus size={16} />
            Add measurement
          </button>
          <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="btn-secondary flex-1">
            <Plus size={16} />
            Milestone
          </button>
        </div>
      )}

      {/* Growth form */}
      {showGrowthForm && (
        <form onSubmit={handleGrowthSubmit} className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-lg text-gray-800">Add measurement</h3>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)} required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-xs">Weight (g)</label>
              <input type="number" className="input" placeholder="4500" value={weightGrams} onChange={e => setWeightGrams(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Height (cm)</label>
              <input type="number" step="0.1" className="input" placeholder="52.5" value={heightCm} onChange={e => setHeightCm(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Head (cm)</label>
              <input type="number" step="0.1" className="input" placeholder="34.0" value={headCm} onChange={e => setHeadCm(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="Doctor visit, checkup notes..." value={growthNotes} onChange={e => setGrowthNotes(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowGrowthForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      {/* Milestone form */}
      {showMilestoneForm && (
        <form onSubmit={handleMilestoneSubmit} className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-lg text-gray-800">Record a milestone</h3>
          <div>
            <label className="label">Milestone</label>
            <input type="text" className="input" placeholder="First smile, first step..." value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Tell the story..." value={milestoneDesc} onChange={e => setMilestoneDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={milestoneType} onChange={e => setMilestoneType(e.target.value as Milestone['milestone_type'])}>
                <option value="motor">Motor</option>
                <option value="social">Social</option>
                <option value="language">Language</option>
                <option value="cognitive">Cognitive</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={milestonePrivate} onChange={e => setMilestonePrivate(e.target.checked)} className="w-4 h-4 accent-blossom-500" />
            <span className="text-sm text-gray-600">Private (parents only)</span>
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowMilestoneForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      {/* Growth history */}
      {entries.length > 0 && (
        <div>
          <h3 className="section-title">Measurements</h3>
          <div className="space-y-2">
            {[...entries].reverse().map(entry => (
              <div key={entry.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-gray-700">
                    {new Date(entry.measured_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.weight_grams && (
                    <span className="badge bg-blossom-50 text-blossom-600">
                      ⚖️ {(entry.weight_grams / 1000).toFixed(3)} kg
                    </span>
                  )}
                  {entry.height_cm && (
                    <span className="badge bg-powder-50 text-powder-600">📏 {entry.height_cm} cm</span>
                  )}
                  {entry.head_circumference_cm && (
                    <span className="badge bg-meadow-50 text-meadow-600">🔵 {entry.head_circumference_cm} cm</span>
                  )}
                </div>
                {entry.notes && <p className="text-xs text-gray-500 mt-2">{entry.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div>
          <h3 className="section-title">Milestones 🌟</h3>
          <div className="space-y-2">
            {milestones.map(m => (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">{m.title}</p>
                    {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`badge ${milestoneTypeColors[m.milestone_type ?? 'other']}`}>
                        {m.milestone_type}
                      </span>
                      {m.is_private && <span className="badge bg-gray-100 text-gray-500">🔒 Private</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(m.achieved_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
