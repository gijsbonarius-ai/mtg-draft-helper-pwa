import { useEffect, useState, FormEvent } from 'react';
import { Plus, Lock, Globe, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { DiaryEntry } from '../lib/types';

const SUGGESTED_TAGS = ['First time', 'Funny', 'Milestone', 'Doctor visit', 'Family', 'Sweet moment', 'Ultrasound', 'Craving'];

export default function Diary() {
  const { profile } = useAuth();
  const { baby } = useBaby();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterPrivate, setFilterPrivate] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');

  const isParent = profile?.role === 'parent';

  const fetchEntries = async () => {
    if (!baby) return;
    let query = supabase
      .from('diary_entries')
      .select('*')
      .eq('baby_id', baby.id)
      .order('created_at', { ascending: false });

    if (filterPrivate === true) query = query.eq('is_private', true);
    if (filterPrivate === false) query = query.eq('is_private', false);

    const { data } = await query;
    setEntries((data as DiaryEntry[]) ?? []);
  };

  useEffect(() => { fetchEntries(); }, [baby, filterPrivate]);

  const toggleTag = (t: string) => {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const addCustomTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags(prev => [...prev, customTag.trim()]);
      setCustomTag('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!baby || !isParent) return;
    setSaving(true);
    await supabase.from('diary_entries').insert({
      baby_id: baby.id,
      title,
      content,
      is_private: isPrivate,
      tags: tags.length ? tags : null,
      created_by: profile!.id,
    });
    setSaving(false);
    setShowForm(false);
    setTitle(''); setContent(''); setIsPrivate(false); setTags([]);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    if (!isParent) return;
    if (!confirm('Delete this entry?')) return;
    await supabase.from('diary_entries').delete().eq('id', id);
    fetchEntries();
  };

  if (!baby) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-5xl mb-3">📖</div>
        <p className="text-gray-500">No baby profile found. Add one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-gray-800">Diary</h2>
          <p className="text-gray-400 text-sm">{baby.name}'s memories</p>
        </div>
        {isParent && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={16} />
            New entry
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { label: 'All', value: null },
          { label: '🔒 Private', value: true },
          { label: '🌍 Shared', value: false },
        ].map(f => (
          <button
            key={String(f.value)}
            onClick={() => setFilterPrivate(f.value)}
            className={`text-sm px-3 py-1.5 rounded-full font-semibold transition-colors ${filterPrivate === f.value ? 'bg-blossom-500 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* New entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h3 className="font-display font-bold text-lg text-gray-800">New diary entry</h3>

          <div>
            <label className="label">Title</label>
            <input
              type="text"
              className="input"
              placeholder="Our first ultrasound, Baby's first kick..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Story</label>
            <textarea
              className="input resize-none"
              rows={5}
              placeholder="Write your memory here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              required
            />
          </div>

          {/* Privacy toggle */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors ${!isPrivate ? 'bg-white shadow text-blossom-600' : 'text-gray-400'}`}
            >
              <Globe size={16} />
              Shared
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors ${isPrivate ? 'bg-white shadow text-gray-700' : 'text-gray-400'}`}
            >
              <Lock size={16} />
              Private
            </button>
          </div>
          {isPrivate && (
            <p className="text-xs text-gray-400 -mt-2">🔒 Only parents can see private entries</p>
          )}

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {SUGGESTED_TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${tags.includes(t) ? 'bg-blossom-100 border-blossom-300 text-blossom-700' : 'bg-white border-gray-200 text-gray-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="input"
                placeholder="Custom tag..."
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
              />
              <button type="button" onClick={addCustomTag} className="btn-secondary px-3">Add</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(t => (
                  <span
                    key={t}
                    className="badge bg-blossom-100 text-blossom-700 cursor-pointer"
                    onClick={() => toggleTag(t)}
                  >
                    {t} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save entry'}</button>
          </div>
        </form>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-gray-400 text-sm">No diary entries yet.</p>
          {isParent && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
              Write the first memory
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.id} className="card p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display font-bold text-gray-800">{entry.title}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  {entry.is_private ? (
                    <span className="badge bg-gray-100 text-gray-500"><Lock size={10} />Private</span>
                  ) : (
                    <span className="badge bg-meadow-50 text-meadow-600"><Globe size={10} />Shared</span>
                  )}
                  {isParent && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{entry.content}</p>

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {entry.tags.map(t => (
                    <span key={t} className="badge bg-blossom-50 text-blossom-500">{t}</span>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-300 mt-3">
                {new Date(entry.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
