import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  player_name: string;
  message: string;
  created_at: string;
}

interface ChatProps {
  roomCode: string;
  playerName: string;
}

export default function Chat({ roomCode, playerName }: ChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent messages
  useEffect(() => {
    supabase
      .from('chat_messages')
      .select('*')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => { if (data) setMessages(data); });
  }, [roomCode]);

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat_${roomCode}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_code=eq.${roomCode}` },
        payload => {
          const msg = payload.new as Message;
          setMessages(prev => [...prev, msg]);
          if (!open) setUnread(n => n + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomCode, open]);

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Clear unread + focus input when opening
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    await supabase.from('chat_messages').insert({
      room_code: roomCode,
      player_name: playerName || 'Anonymous',
      message: text,
    });
    setSending(false);
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 text-gray-900 rounded-full shadow-lg flex items-center justify-center text-xl transition-transform active:scale-95"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(420px, 60vh)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 shrink-0">
            <span className="font-semibold text-white text-sm">Chat</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white w-7 h-7 flex items-center justify-center rounded">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-4">No messages yet. Say hi! 👋</p>
            )}
            {messages.map(msg => {
              const isMe = msg.player_name === playerName;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-xs text-gray-500 mb-0.5 px-1">{msg.player_name}</span>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm break-words ${
                    isMe
                      ? 'bg-yellow-500 text-gray-900 rounded-tr-sm'
                      : 'bg-gray-700 text-white rounded-tl-sm'
                  }`}>
                    {msg.message}
                  </div>
                  <span className="text-xs text-gray-600 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-3 border-t border-gray-700 shrink-0">
            <input
              ref={inputRef}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              maxLength={300}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-300 disabled:opacity-40 text-gray-900 font-bold px-3 py-2 rounded-xl text-sm transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
