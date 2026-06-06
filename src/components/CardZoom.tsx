import { useEffect, useState } from 'react';

// ── ZoomOverlay ──────────────────────────────────────────────────────────────

interface ZoomOverlayProps {
  name: string;
  onClose: () => void;
}

export function ZoomOverlay({ name, onClose }: ZoomOverlayProps) {
  const [errored, setErrored] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function close(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4"
      onClick={close}
      onTouchEnd={close}
    >
      <button
        onClick={close}
        onTouchEnd={close}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-full text-white text-xl z-[101]"
        aria-label="Close"
      >
        ✕
      </button>

      {errored ? (
        <div
          className="bg-gray-800 border border-gray-600 rounded-xl flex items-center justify-center p-6"
          style={{ width: 'min(75vw, 320px)', minHeight: '180px' }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          <span className="text-gray-300 text-sm text-center">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          className="rounded-xl object-cover shadow-2xl"
          style={{ maxWidth: 'min(75vw, 320px)', maxHeight: '80vh' }}
          onError={() => setErrored(true)}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        />
      )}

      <p className="mt-3 text-white text-sm font-semibold text-center max-w-xs">{name}</p>
    </div>
  );
}

// ── ZoomableCard ─────────────────────────────────────────────────────────────

interface ZoomableCardProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ZoomableCard({ name, className = '', style }: ZoomableCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

  return (
    <>
      {errored ? (
        <div
          className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center cursor-pointer ${className}`}
          onClick={() => setZoomed(true)}
        >
          <span className="text-gray-400 text-xs text-center p-2">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          className={`rounded-lg object-cover cursor-pointer ${className}`}
          style={style}
          onError={() => setErrored(true)}
          onClick={() => setZoomed(true)}
        />
      )}

      {zoomed && <ZoomOverlay name={name} onClose={() => setZoomed(false)} />}
    </>
  );
}
