import { useEffect, useState, ChangeEvent } from 'react';
import { Upload, Lock, Globe, X, Image } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useBaby } from '../hooks/useBaby';
import { supabase } from '../lib/supabase';
import type { Photo } from '../lib/types';

export default function Gallery() {
  const { profile } = useAuth();
  const { baby } = useBaby();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [filterPrivate, setFilterPrivate] = useState<boolean | null>(null);
  const [caption, setCaption] = useState('');
  const [uploadPrivate, setUploadPrivate] = useState(false);

  const isParent = profile?.role === 'parent';

  const fetchPhotos = async () => {
    if (!baby) return;
    let query = supabase
      .from('photos')
      .select('*')
      .eq('baby_id', baby.id)
      .order('created_at', { ascending: false });

    if (filterPrivate === true) query = query.eq('is_private', true);
    if (filterPrivate === false) query = query.eq('is_private', false);

    const { data } = await query;
    const photosWithUrls = ((data as Photo[]) ?? []).map(p => ({
      ...p,
      public_url: supabase.storage.from('photos').getPublicUrl(p.storage_path).data.publicUrl,
    }));
    setPhotos(photosWithUrls);
    setLoading(false);
  };

  useEffect(() => { fetchPhotos(); }, [baby, filterPrivate]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !baby || !isParent) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${baby.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(path, file, { contentType: file.type });

    if (!uploadError) {
      await supabase.from('photos').insert({
        baby_id: baby.id,
        storage_path: path,
        caption: caption || null,
        is_private: uploadPrivate,
        taken_at: new Date().toISOString(),
        created_by: profile!.id,
      });
      setCaption('');
      fetchPhotos();
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (photo: Photo) => {
    if (!isParent) return;
    if (!confirm('Delete this photo?')) return;
    await supabase.storage.from('photos').remove([photo.storage_path]);
    await supabase.from('photos').delete().eq('id', photo.id);
    fetchPhotos();
  };

  if (!baby) {
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-5xl mb-3">📷</div>
        <p className="text-gray-500">No baby profile found. Add one in Settings.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-gray-800">Gallery</h2>
          <p className="text-gray-400 text-sm">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Upload */}
      {isParent && (
        <div className="card p-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Add a photo</h3>
          <input
            type="text"
            className="input"
            placeholder="Caption (optional)"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input
                type="checkbox"
                checked={uploadPrivate}
                onChange={e => setUploadPrivate(e.target.checked)}
                className="w-4 h-4 accent-blossom-500"
              />
              <Lock size={14} />
              Private (parents only)
            </label>
          </div>
          <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Choose photo'}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      )}

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

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="text-3xl animate-bounce">📷</div>
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">🖼️</div>
          <p className="text-gray-400 text-sm">No photos yet.</p>
          {isParent && <p className="text-gray-300 text-xs mt-1">Upload your first memory above!</p>}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group"
            >
              {photo.public_url ? (
                <img
                  src={photo.public_url}
                  alt={photo.caption ?? ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image size={24} className="text-gray-300" />
                </div>
              )}
              {photo.is_private && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                  <Lock size={10} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white p-2"
            >
              <X size={24} />
            </button>

            {selectedPhoto.public_url && (
              <img
                src={selectedPhoto.public_url}
                alt={selectedPhoto.caption ?? ''}
                className="w-full rounded-3xl"
              />
            )}

            <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3">
              {selectedPhoto.caption && (
                <p className="text-white font-medium text-sm mb-1">{selectedPhoto.caption}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/50 text-xs">
                  {selectedPhoto.is_private ? (
                    <><Lock size={12} /><span>Private</span></>
                  ) : (
                    <><Globe size={12} /><span>Shared</span></>
                  )}
                  {selectedPhoto.taken_at && (
                    <span>• {new Date(selectedPhoto.taken_at).toLocaleDateString()}</span>
                  )}
                </div>
                {isParent && (
                  <button
                    onClick={() => { handleDelete(selectedPhoto); setSelectedPhoto(null); }}
                    className="text-red-400 text-xs font-semibold hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
