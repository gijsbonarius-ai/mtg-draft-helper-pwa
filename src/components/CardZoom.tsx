import { useEffect, useRef, useState } from 'react';

function scryfallUrl(name: string, back = false) {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal${back ? '&face=back' : ''}`;
}

// touch-action: manipulation removes the 300ms tap delay on mobile without needing onTouchEnd hacks
const TAP_STYLE: React.CSSProperties = { touchAction: 'manipulation' };

// ── ZoomOverlay ──────────────────────────────────────────────────────────────

interface ZoomOverlayProps {
  name: string;
  face?: 'back';
  onClose: () => void;
}

export function ZoomOverlay({ name, face, onClose }: ZoomOverlayProps) {
  const [errored, setErrored] = useState(false);
  const src = scryfallUrl(name, face === 'back' && !errored);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
      style={TAP_STYLE}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 w-14 h-14 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full text-white text-2xl z-[101]"
        style={TAP_STYLE}
        onClick={e => { e.stopPropagation(); onClose(); }}
      >
        ✕
      </button>

      {/* Card image — stopPropagation so tapping the card doesn't close */}
      {errored && face !== 'back' ? (
        <div
          className="bg-gray-800 border border-gray-600 rounded-xl flex items-center justify-center p-6"
          style={{ width: 'min(80vw, 340px)', minHeight: '180px' }}
          onClick={e => e.stopPropagation()}
        >
          <span className="text-gray-300 text-sm text-center">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          className="rounded-xl shadow-2xl"
          style={{ maxWidth: 'min(90vw, 480px)', maxHeight: '88vh', width: 'auto', height: 'auto' }}
          onError={() => setErrored(true)}
          onClick={e => e.stopPropagation()}
        />
      )}

      <p className="mt-3 text-white text-sm font-semibold text-center max-w-xs" onClick={e => e.stopPropagation()}>
        {name}
      </p>
    </div>
  );
}

// ── ZoomableCard ─────────────────────────────────────────────────────────────

interface ZoomableCardProps {
  name: string;
  face?: 'back';
  className?: string;
  style?: React.CSSProperties;
}

export function ZoomableCard({ name, face, className = '', style }: ZoomableCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = scryfallUrl(name, face === 'back' && !errored);

  return (
    <>
      {errored && face !== 'back' ? (
        <div
          className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center cursor-pointer ${className}`}
          style={{ ...style, ...TAP_STYLE }}
          onClick={e => { e.stopPropagation(); setZoomed(true); }}
        >
          <span className="text-gray-400 text-xs text-center p-2">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          draggable={false}
          className={`rounded-lg object-contain cursor-pointer ${className}`}
          style={{ ...style, ...TAP_STYLE }}
          onError={() => setErrored(true)}
          onClick={e => { e.stopPropagation(); setZoomed(true); }}
        />
      )}
      {zoomed && <ZoomOverlay name={name} face={face} onClose={() => setZoomed(false)} />}
    </>
  );
}

// ── LongPressZoomCard ────────────────────────────────────────────────────────

interface LongPressZoomCardProps {
  name: string;
  face?: 'back';
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export function LongPressZoomCard({ name, face, className = '', style, onClick }: LongPressZoomCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = scryfallUrl(name, face === 'back' && !errored);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didZoom = useRef(false);

  function startPress() {
    didZoom.current = false;
    timer.current = setTimeout(() => { didZoom.current = true; setZoomed(true); }, 500);
  }
  function cancelPress() {
    if (timer.current) clearTimeout(timer.current);
  }
  function handleClick(e: React.MouseEvent) {
    if (!didZoom.current) onClick?.(e);
  }

  const pressProps = {
    onMouseDown: startPress,
    onMouseUp: cancelPress,
    onMouseLeave: cancelPress,
    onTouchStart: startPress,
    onTouchEnd: cancelPress,
    onClick: handleClick,
  };

  return (
    <>
      {errored && face !== 'back' ? (
        <div
          className={`bg-gray-800 border border-gray-600 rounded flex items-center justify-center p-1 cursor-pointer ${className}`}
          style={{ ...style, ...TAP_STYLE }}
          {...pressProps}
        >
          <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          draggable={false}
          className={`rounded object-contain cursor-pointer ${className}`}
          style={{ ...style, ...TAP_STYLE }}
          onError={() => setErrored(true)}
          onContextMenu={e => { e.preventDefault(); setZoomed(true); }}
          {...pressProps}
        />
      )}
      {zoomed && <ZoomOverlay name={name} face={face} onClose={() => setZoomed(false)} />}
    </>
  );
}
