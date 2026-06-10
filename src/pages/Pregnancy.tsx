import { useEffect, useState, FormEvent } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { PregnancyEntry } from '../lib/types';
import { calculatePregnancyWeek, getDaysUntilDueDate, getWeekInfo, pregnancyWeeks } from '../lib/pregnancyData';

const MOODS = ['😊 Great', '😐 Okay', '😴 Tired', '🤢 Nauseous', '😢 Emotional', '💪 Strong'];
const SYMPTOMS = ['Nausea', 'Fatigue', 'Heartburn', 'Back pain', 'Swollen feet', 'Insomnia', 'Cravings', 'Mood swings', 'Headache', 'Frequent urination'];

export default function Pregnancy() {
  const { profile } = useAuth();
  const { baby } = useBaby();
  const [entries, setEntries] = useState<PregnancyEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formWeek, setFormWeek] = useState(1);
  const [motherWeight, setMotherWeight] = useState('');
  const [belly, setBelly] = useState('');
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const isParent = profile?.role === 'parent';
  const currentWeek = baby?.due_date ? calculatePregnancyWeek(baby.due_date) : null;
  const daysLeft = baby?.due_date ? getDaysUntilDueDate(baby.due_date) : null;

  useEffect(() => {
    if (!baby) return;
    supabase
      .from('pregnancy_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('week', { ascending: false })
      .then(({ data }) => setEntries((data as PregnancyEntry[]) ?? []));
    if (currentWeek) setFormWeek(currentWeek);
  }, [baby]);

  const displayWeekInfo = getWeekInfo(viewWeek ?? currentWeek ?? 20);

  const toggleSymptom = (s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!baby || !isParent) return;
    setSaving(true);
    await supabase.from('pregnancy_entries').upsert({
      baby_id: baby.id,
      week: formWeek,
      mother_weight_kg: motherWeight ? parseFloat(motherWeight) : null,
      belly_circumference_cm: belly ? parseFloat(belly) : null,
      mood: mood || null,
      symptoms: symptoms.length ? symptoms : null,
      notes: notes || null,
      created_by: profile!.id,
    }, { onConflict: 'baby_id,week' });
    setSaving(false);
    setShowForm(false);
    const { data } = await supabase
      .from('pregnancy_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('week', { ascending: false });
    setEntries((data as PregnancyEntry[]) ?? []);
  };

  if (!baby) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-5xl mb-3">🌸</div>
        <p className="text-gray-500">No baby profile found. Add one in Settings.</p>
      </div>
    );
  }

  if (baby.birth_date) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-5xl mb-3">👶</div>
        <h2 className="font-display font-bold text-xl text-gray-800 mb-2">{baby.name} has arrived!</h2>
        <p className="text-gray-500">The pregnancy chapter is complete. Head to Growth to track {baby.name}'s journey.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <div className="card p-5 bg-gradient-to-br from-blossom-50 to-lilac-50 border-blossom-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blossom-400 font-semibold text-sm">Pregnancy tracker</p>
            <h2 className="font-display font-bold text-xl text-gray-800">{baby.name}</h2>
          </div>
          <span className="text-3xl">{displayWeekInfo.sizeEmoji}</span>
        </div>

        {/* Week navigator */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setViewWeek(Math.max(4, (viewWeek ?? currentWeek ?? 20) - 1))}
            className="p-2 rounded-xl hover:bg-blossom-100 text-blossom-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="font-display font-bold text-2xl text-blossom-600">
              Week {viewWeek ?? currentWeek ?? '–'}
            </p>
            {viewWeek === null || viewWeek === currentWeek ? (
              <p className="text-xs text-gray-400">{daysLeft} days to go</p>
            ) : (
              <button onClick={() => setViewWeek(null)} className="text-xs text-blossom-400 underline">
                Back to today
              </button>
            )}
          </div>
          <button
            onClick={() => setViewWeek(Math.min(42, (viewWeek ?? currentWeek ?? 20) + 1))}
            className="p-2 rounded-xl hover:bg-blossom-100 text-blossom-500 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Week progress */}
        <div className="h-2 bg-blossom-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blossom-300 to-blossom-500 rounded-full"
            style={{ width: `${((viewWeek ?? currentWeek ?? 0) / 40) * 100}%` }}
          />
        </div>

        {/* Development info */}
        <div className="space-y-2">
          <div className="bg-white/60 rounded-2xl p-3">
            <p className="text-xs font-semibold text-blossom-500 mb-1">👶 Baby this week</p>
            <p className="text-sm text-gray-700">{displayWeekInfo.babyDevelopment}</p>
          </div>
          <div className="bg-white/60 rounded-2xl p-3">
            <p className="text-xs font-semibold text-powder-500 mb-1">🌸 Mom this week</p>
            <p className="text-sm text-gray-700">{displayWeekInfo.momChanges}</p>
          </div>
          <div className="bg-white/60 rounded-2xl p-3">
            <p className="text-xs font-semibold text-sunshine-500 mb-1">✨ Fun fact</p>
            <p className="text-sm text-gray-700">{displayWeekInfo.funFact}</p>
          </div>
        </div>
      </div>

      {/* Add entry button */}
      {isParent && !showForm && (
        <button onClick={() => { setShowForm(true); setFormWeek(currentWeek ?? 20); }} className="btn-primary w-full">
          <Plus size={18} />
          Log this week
        </button>
      )}

      {/* Entry form */}
      {isParent && showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-lg text-gray-800">Log week {formWeek}</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mom's weight (kg)</label>
              <input type="number" step="0.1" className="input" placeholder="65.0" value={motherWeight} onChange={e => setMotherWeight(e.target.value)} />
            </div>
            <div>
              <label className="label">Belly (cm)</label>
              <input type="number" step="0.5" className="input" placeholder="85.0" value={belly} onChange={e => setBelly(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m === mood ? '' : m)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${mood === m ? 'bg-blossom-100 border-blossom-300 text-blossom-700' : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Symptoms</label>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${symptoms.includes(s) ? 'bg-powder-100 border-powder-300 text-powder-700' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="How are you feeling? Any special moments this week..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      {/* Entry history */}
      {entries.length > 0 && (
        <div>
          <h3 className="section-title">Weekly log</h3>
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-blossom-600">Week {entry.week}</span>
                  <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {entry.mother_weight_kg && (
                    <span className="badge bg-blossom-50 text-blossom-600">⚖️ {entry.mother_weight_kg} kg</span>
                  )}
                  {entry.belly_circumference_cm && (
                    <span className="badge bg-powder-50 text-powder-600">📏 {entry.belly_circumference_cm} cm</span>
                  )}
                  {entry.mood && (
                    <span className="badge bg-sunshine-50 text-sunshine-700">{entry.mood}</span>
                  )}
                </div>
                {entry.symptoms && entry.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {entry.symptoms.map(s => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
                {entry.notes && <p className="text-sm text-gray-600">{entry.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All weeks overview */}
      <div>
        <h3 className="section-title">Pregnancy timeline</h3>
        <div className="flex flex-wrap gap-2">
          {pregnancyWeeks.map(w => {
            const hasEntry = entries.some(e => e.week === w.week);
            const isCurrent = w.week === currentWeek;
            return (
              <button
                key={w.week}
                onClick={() => setViewWeek(w.week)}
                className={`w-9 h-9 rounded-full text-sm font-semibold transition-all
                  ${isCurrent ? 'bg-blossom-500 text-white shadow-glow-pink' :
                    hasEntry ? 'bg-blossom-100 text-blossom-600' :
                    'bg-gray-100 text-gray-400'}`}
              >
                {w.week}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
