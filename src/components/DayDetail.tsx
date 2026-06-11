import { useState, useEffect, ChangeEvent } from 'react';
import { X, Upload, Lock, Globe, Trash2, Image } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Baby, DiaryEntry, Photo, PregnancyEntry, GrowthEntry } from '../lib/types';
import type { TimelineItem } from '../lib/timelineData';
import { getEntryDateForItem } from '../lib/timelineData';

const MOODS = ['😊 Great', '😐 Okay', '😴 Tired', '🤢 Nauseous', '😢 Emotional', '💪 Strong'];
const SYMPTOMS = ['Nausea', 'Fatigue', 'Heartburn', 'Back pain', 'Swollen feet', 'Insomnia', 'Cravings', 'Mood swings'];

type Tab = 'story' | 'photos' | 'data';

interface Props {
  item: TimelineItem;
  baby: Baby;
  onClose: () => void;
  onSave: () => void;
}

export default function DayDetail({ item, baby, onClose, onSave }: Props) {
  const { profile } = useAuth();
  const isParent = profile?.role === 'parent';
  const isPregnancy = !baby.birth_date;
  const entryDate = getEntryDateForItem(item, baby);

  const [tab, setTab] = useState<Tab>('story');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Story state
  const [storyContent, setStoryContent] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyPrivate, setStoryPrivate] = useState(false);
  const [existingStory, setExistingStory] = useState<DiaryEntry | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoPrivate, setPhotoPrivate] = useState(false);

  // Data state (pregnancy)
  const [motherWeight, setMotherWeight] = useState('');
  const [belly, setBelly] = useState('');
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [dataNotesPreg, setDataNotesPreg] = useState('');
  const [existingPregEntry, setExistingPregEntry] = useState<PregnancyEntry | null>(null);

  // Data state (baby)
  const [weightG, setWeightG] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCm, setHeadCm] = useState('');
  const [dataNotesBaby, setDataNotesBaby] = useState('');
  const [existingGrowthEntry, setExistingGrowthEntry] = useState<GrowthEntry | null>(null);

  // Load existing data
  useEffect(() => {
    if (!baby) return;

    // Load diary entry
    supabase.from('diary_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .eq('entry_date', entryDate)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const e = data as DiaryEntry;
          setExistingStory(e);
          setStoryTitle(e.title);
          setStoryContent(e.content);
          setStoryPrivate(e.is_private);
        }
      });

    // Load photos
    supabase.from('photos')
      .select('*')
      .eq('baby_id', baby.id)
      .filter('taken_at', 'gte', `${entryDate}T00:00:00`)
      .filter('taken_at', 'lt', `${getNextDate(entryDate)}T00:00:00`)
      .order('created_at')
      .then(({ data }) => {
        const list = ((data as Photo[]) ?? []).map(p => ({
          ...p,
          public_url: supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl,
        }));
        setPhotos(list);
      });

    // Load measurements
    if (isPregnancy && item.weekNumber) {
      supabase.from('pregnancy_entries')
        .select('*')
        .eq('baby_id', baby.id)
        .eq('week', item.weekNumber)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const e = data as PregnancyEntry;
            setExistingPregEntry(e);
            setMotherWeight(e.mother_weight_kg ? String(e.mother_weight_kg) : '');
            setBelly(e.belly_circumference_cm ? String(e.belly_circumference_cm) : '');
            setMood(e.mood ?? '');
            setSymptoms(e.symptoms ?? []);
            setDataNotesPreg(e.notes ?? '');
          }
        });
    } else if (!isPregnancy) {
      supabase.from('growth_entries')
        .select('*')
        .eq('baby_id', baby.id)
        .eq('measured_at', entryDate)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const e = data as GrowthEntry;
            setExistingGrowthEntry(e);
            setWeightG(e.weight_grams ? String(e.weight_grams) : '');
            setHeightCm(e.height_cm ? String(e.height_cm) : '');
            setHeadCm(e.head_circumference_cm ? String(e.head_circumference_cm) : '');
            setDataNotesBaby(e.notes ?? '');
          }
        });
    }
  }, [baby, entryDate]);

  // ── Story save ──────────────────────────────────────────────
  const saveStory = async () => {
    if (!isParent || (!storyTitle.trim() && !storyContent.trim())) return;
    setSaving(true);

    const payload = {
      baby_id: baby.id,
      title: storyTitle.trim() || entryDate,
      content: storyContent.trim(),
      is_private: storyPrivate,
      entry_date: entryDate,
      created_by: profile!.id,
    };

    if (existingStory) {
      await supabase.from('diary_entries').update(payload).eq('id', existingStory.id);
    } else {
      const { data } = await supabase.from('diary_entries').insert(payload).select().maybeSingle();
      if (data) setExistingStory(data as DiaryEntry);
    }
    setSaving(false);
    onSave();
  };

  // ── Photo upload ────────────────────────────────────────────
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isParent) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${baby.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type });

    if (!error) {
      await supabase.from('photos').insert({
        baby_id: baby.id,
        storage_path: path,
        caption: photoCaption || null,
        is_private: photoPrivate,
        taken_at: `${entryDate}T12:00:00`,
        created_by: profile!.id,
      });
      // Refresh photos
      const { data } = await supabase.from('photos')
        .select('*')
        .eq('baby_id', baby.id)
        .filter('taken_at', 'gte', `${entryDate}T00:00:00`)
        .filter('taken_at', 'lt', `${getNextDate(entryDate)}T00:00:00`)
        .order('created_at');
      const list = ((data as Photo[]) ?? []).map(p => ({
        ...p,
        public_url: supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl,
      }));
      setPhotos(list);
      setPhotoCaption('');
    }
    setUploading(false);
    e.target.value = '';
    onSave();
  };

  const deletePhoto = async (photo: Photo) => {
    if (!isParent || !confirm('Delete this photo?')) return;
    await supabase.storage.from('photos').remove([photo.storage_path]);
    await supabase.from('photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setSelectedPhoto(null);
    onSave();
  };

  // ── Data save ───────────────────────────────────────────────
  const saveData = async () => {
    if (!isParent) return;
    setSaving(true);

    if (isPregnancy && item.weekNumber) {
      const payload = {
        baby_id: baby.id,
        week: item.weekNumber,
        mother_weight_kg: motherWeight ? parseFloat(motherWeight) : null,
        belly_circumference_cm: belly ? parseFloat(belly) : null,
        mood: mood || null,
        symptoms: symptoms.length ? symptoms : null,
        notes: dataNotesPreg || null,
        created_by: profile!.id,
      };
      if (existingPregEntry) {
        await supabase.from('pregnancy_entries').update(payload).eq('id', existingPregEntry.id);
      } else {
        await supabase.from('pregnancy_entries').insert(payload);
      }
    } else {
      const payload = {
        baby_id: baby.id,
        measured_at: entryDate,
        weight_grams: weightG ? parseInt(weightG) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        head_circumference_cm: headCm ? parseFloat(headCm) : null,
        notes: dataNotesBaby || null,
        created_by: profile!.id,
      };
      if (existingGrowthEntry) {
        await supabase.from('growth_entries').update(payload).eq('id', existingGrowthEntry.id);
      } else {
        await supabase.from('growth_entries').insert(payload);
      }
    }

    setSaving(false);
    onSave();
  };

  // ── Header info ─────────────────────────────────────────────
  const headerTitle = item.type === 'week'
    ? `Week ${item.weekNumber}`
    : item.shortLabel ?? entryDate;

  const headerSub = item.type === 'week' && item.weekInfo
    ? `${item.weekInfo.sizeEmoji} Size of a ${item.weekInfo.sizeComparison}`
    : item.dateLabel ?? '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-blossom-100 px-4 py-4 flex items-start gap-3">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors flex-shrink-0 mt-0.5"
        >
          <X size={18} className="text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-gray-800 leading-tight">{headerTitle}</h2>
          {headerSub && <p className="text-gray-400 text-sm mt-0.5">{headerSub}</p>}
        </div>
      </div>

      {/* Week development info (pregnancy) */}
      {item.type === 'week' && item.weekInfo && (
        <div className="flex-shrink-0 bg-gradient-to-r from-blossom-50 to-powder-50 px-4 py-3 border-b border-blossom-100">
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{item.weekInfo.babyDevelopment}</p>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'story' && (
          <div className="p-4 space-y-4">
            {!isParent && !existingStory && (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📖</div>
                <p className="text-gray-400 text-sm">No diary entry for this day yet.</p>
              </div>
            )}

            {(isParent || existingStory) && (
              <>
                {isParent && (
                  <div>
                    <label className="label">Title</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Give this memory a title..."
                      value={storyTitle}
                      onChange={e => setStoryTitle(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="label">Story</label>
                  {isParent ? (
                    <textarea
                      className="input resize-none"
                      rows={8}
                      placeholder="Write your memory here... How are you feeling? What happened today? What made you smile?"
                      value={storyContent}
                      onChange={e => setStoryContent(e.target.value)}
                    />
                  ) : (
                    <div className="input min-h-[120px] bg-gray-50 text-gray-700 whitespace-pre-wrap">
                      {storyContent}
                    </div>
                  )}
                </div>

                {isParent && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setStoryPrivate(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors ${!storyPrivate ? 'bg-white shadow-soft text-blossom-600' : 'text-gray-400'}`}
                    >
                      <Globe size={14} /> Shared
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoryPrivate(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors ${storyPrivate ? 'bg-white shadow-soft text-gray-700' : 'text-gray-400'}`}
                    >
                      <Lock size={14} /> Private
                    </button>
                  </div>
                )}

                {isParent && (
                  <button onClick={saveStory} className="btn-primary w-full" disabled={saving}>
                    {saving ? 'Saving...' : existingStory ? 'Update story' : 'Save story'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'photos' && (
          <div className="p-4 space-y-4">
            {/* Upload section (parents only) */}
            {isParent && (
              <div className="card p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700">Add a photo</h3>
                <input
                  type="text"
                  className="input"
                  placeholder="Caption (optional)"
                  value={photoCaption}
                  onChange={e => setPhotoCaption(e.target.value)}
                />
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-500">
                  <input
                    type="checkbox"
                    checked={photoPrivate}
                    onChange={e => setPhotoPrivate(e.target.checked)}
                    className="w-4 h-4 accent-blossom-500"
                  />
                  <Lock size={14} /> Private (parents only)
                </label>
                <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  <Upload size={16} />
                  {uploading ? 'Uploading...' : 'Choose photo'}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
            )}

            {/* Photos grid */}
            {photos.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-gray-300 text-sm">No photos yet for this day.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="aspect-square rounded-2xl overflow-hidden bg-gray-100 relative group"
                  >
                    {photo.public_url ? (
                      <img src={photo.public_url} alt={photo.caption ?? ''} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image size={20} className="text-gray-300" />
                      </div>
                    )}
                    {photo.is_private && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                        <Lock size={9} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Lightbox */}
            {selectedPhoto && (
              <div
                className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4"
                onClick={() => setSelectedPhoto(null)}
              >
                <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setSelectedPhoto(null)} className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white">
                    <X size={24} />
                  </button>
                  {selectedPhoto.public_url && (
                    <img src={selectedPhoto.public_url} alt={selectedPhoto.caption ?? ''} className="w-full rounded-3xl" />
                  )}
                  <div className="mt-3 bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <p className="text-white/80 text-sm">{selectedPhoto.caption ?? ''}</p>
                    {isParent && (
                      <button onClick={() => deletePhoto(selectedPhoto)} className="text-red-400 text-xs font-semibold ml-3">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'data' && (
          <div className="p-4 space-y-4">
            {!isParent ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-gray-400 text-sm">Measurements are visible to parents.</p>
              </div>
            ) : isPregnancy ? (
              <>
                <h3 className="font-semibold text-gray-700">Mom's measurements</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Weight (kg)</label>
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
                      <button key={m} type="button" onClick={() => setMood(m === mood ? '' : m)}
                        className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${mood === m ? 'bg-blossom-100 border-blossom-300 text-blossom-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Symptoms</label>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOMS.map(s => (
                      <button key={s} type="button"
                        onClick={() => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${symptoms.includes(s) ? 'bg-powder-100 border-powder-300 text-powder-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} placeholder="Doctor visit, scan results, how you're feeling..." value={dataNotesPreg} onChange={e => setDataNotesPreg(e.target.value)} />
                </div>

                <button onClick={saveData} className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Saving...' : existingPregEntry ? 'Update data' : 'Save data'}
                </button>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-700">{baby.name}'s measurements</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label text-xs">Weight (g)</label>
                    <input type="number" className="input" placeholder="4500" value={weightG} onChange={e => setWeightG(e.target.value)} />
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
                  <input type="text" className="input" placeholder="Doctor visit, checkup notes..." value={dataNotesBaby} onChange={e => setDataNotesBaby(e.target.value)} />
                </div>
                <button onClick={saveData} className="btn-primary w-full" disabled={saving}>
                  {saving ? 'Saving...' : existingGrowthEntry ? 'Update measurements' : 'Save measurements'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 flex pb-safe">
        {([
          { key: 'story', icon: '📝', label: 'Story' },
          { key: 'photos', icon: '📷', label: `Photos${photos.length > 0 ? ` (${photos.length})` : ''}` },
          { key: 'data', icon: '📊', label: 'Data' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors
              ${tab === t.key ? 'text-blossom-600 border-t-2 border-blossom-400' : 'text-gray-400 border-t-2 border-transparent'}`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getNextDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
