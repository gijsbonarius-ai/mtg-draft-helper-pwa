import { useEffect, useRef, useState } from 'react';

// ── ZoomOverlay ──────────────────────────────────────────────────────────────

interface ZoomOverlayProps {
  name: string;
  onClose: () => void;
}

export function ZoomOverlay({ name, onClose }: ZoomOverlayProps) {
  const [errored, setErrored] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function stopAll(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4"
      // Handle both click and touch — stopAll prevents the event reaching anything underneath
      onClick={e => { stopAll(e); onClose(); }}
      onTouchEnd={e => { stopAll(e); onClose(); }}
      // Absorb touchstart too so no long-press timer starts on the card below
      onTouchStart={e => e.stopPropagation()}
    >
      <button
        className="absolute top-4 right-4 w-14 h-14 flex items-center justify-center bg-gray-800 hover:bg-gray-700 active:bg-gray-600 rounded-full text-white text-2xl z-[101]"
        aria-label="Close"
        onClick={e => { stopAll(e); onClose(); }}
        onTouchEnd={e => { stopAll(e); onClose(); }}
      >
        ✕
      </button>

      {errored ? (
        <div
          className="bg-gray-800 border border-gray-600 rounded-xl flex items-center justify-center p-6"
          style={{ width: 'min(80vw, 340px)', minHeight: '180px' }}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        >
          <span className="text-gray-300 text-sm text-center">{name}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={name}
          className="rounded-xl object-cover shadow-2xl"
          style={{ maxWidth: 'min(80vw, 340px)', maxHeight: '82vh' }}
          onError={() => setErrored(true)}
          onClick={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        />
      )}

      <p className="mt-3 text-white text-sm font-semibold text-center max-w-xs">{name}</p>
    </div>
  );
}

// ── ZoomableCard ─────────────────────────────────────────────────────────────
// Tap to zoom. Use where tap has no other action.

interface ZoomableCardProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ZoomableCard({ name, className = '', style }: ZoomableCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const justClosed = useRef(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

  function open() {
    if (!justClosed.current) setZoomed(true);
  }

  function close() {
    setZoomed(false);
    // Ignore any click/touch that arrives in the next 400ms (synthetic post-touch click)
    justClosed.current = true;
    setTimeout(() => { justClosed.current = false; }, 400);
  }

  return (
    <>
      {errored ? (
        <div className={`bg-gray-800 border border-gray-600 rounded-lg flex items-center justify-center cursor-pointer ${className}`} onClick={open}>
          <span className="text-gray-400 text-xs text-center p-2">{name}</span>
        </div>
      ) : (
        <img src={src} alt={name} draggable={false}
          className={`rounded-lg object-cover cursor-pointer ${className}`}
          style={style}
          onError={() => setErrored(true)}
          onClick={open}
        />
      )}
      {zoomed && <ZoomOverlay name={name} onClose={close} />}
    </>
  );
}

// ── LongPressZoomCard ────────────────────────────────────────────────────────
// Long-press (500ms) to zoom. Use where tap already has another action.

interface LongPressZoomCardProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export function LongPressZoomCard({ name, className = '', style, onClick }: LongPressZoomCardProps) {
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didZoom = useRef(false);
  const justClosed = useRef(false);

  function startPress() {
    didZoom.current = false;
    timer.current = setTimeout(() => { didZoom.current = true; setZoomed(true); }, 500);
  }
  function cancelPress() { if (timer.current) clearTimeout(timer.current); }
  function handleClick(e: React.MouseEvent) {
    if (!didZoom.current && !justClosed.current) onClick?.(e);
  }

  function close() {
    setZoomed(false);
    didZoom.current = false;
    justClosed.current = true;
    setTimeout(() => { justClosed.current = false; }, 400);
  }

  const pressProps = {
    onMouseDown: startPress, onMouseUp: cancelPress, onMouseLeave: cancelPress,
    onTouchStart: startPress, onTouchEnd: cancelPress,
    onClick: handleClick,
  };

  return (
    <>
      {errored ? (
        <div className={`bg-gray-800 border border-gray-600 rounded flex items-center justify-center p-1 cursor-pointer ${className}`} style={style} {...pressProps}>
          <span className="text-gray-400 text-xs text-center leading-tight">{name}</span>
        </div>
      ) : (
        <img src={src} alt={name} draggable={false}
          className={`rounded object-cover cursor-pointer ${className}`}
          style={style}
          onError={() => setErrored(true)}
          onContextMenu={e => { e.preventDefault(); setZoomed(true); }}
          {...pressProps}
        />
      )}
      {zoomed && <ZoomOverlay name={name} onClose={close} />}
    </>
  );
}
