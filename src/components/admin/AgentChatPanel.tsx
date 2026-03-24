import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  direction: 'from_admin' | 'from_agent';
  message: string;
  message_type: string;
  created_at: string;
}

const QUICK_COMMANDS = [
  { icon: '🔍', label: 'Anglo-Eastern', cmd: 'Check Anglo-Eastern for all vacancies now', urgent: true },
  { icon: '🔍', label: 'Fleet Management', cmd: 'Check Fleet Management for vacancies now', urgent: true },
  { icon: '🔍', label: 'OSM Thome', cmd: 'Check OSM Thome for vacancies now', urgent: true },
  { icon: '🔍', label: 'Bernhard Schulte', cmd: 'Check Bernhard Schulte for vacancies now', urgent: true },
  { icon: '📊', label: 'Run All', cmd: 'Check all companies now and report results', urgent: true },
  { icon: '🧹', label: 'Clean Up', cmd: 'Remove all expired vacancies older than 30 days', urgent: false },
  { icon: '📋', label: 'Knowledge Base', cmd: 'List all companies in the knowledge base with their status', urgent: false },
  { icon: '📈', label: 'Stats Report', cmd: 'Give me a summary of all vacancies collected today', urgent: false },
];

export default function AgentChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from('agent_conversations')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data || []) as Message[]);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendInstruction = async (instruction: string, urgent = false, attachment?: { type: string; name: string; content: string }) => {
    if (!instruction.trim() && !attachment) return;
    setSending(true);
    setInput('');

    const displayMsg = attachment
      ? `${instruction || 'Process this attachment:'}\n📎 ${attachment.name}`
      : instruction;

    await supabase.from('agent_conversations').insert({
      direction: 'from_admin',
      message: displayMsg,
      message_type: attachment ? 'attachment' : 'instruction',
    });

    try {
      let fullInstruction = instruction;
      if (attachment) {
        fullInstruction = `${instruction || 'Extract maritime vacancies from this attachment.'}\n\nAttachment name: ${attachment.name}\nAttachment type: ${attachment.type}\nContent preview: ${attachment.content.substring(0, 3000)}`;
      }

      const res = await supabase.functions.invoke('researcher-agent', {
        method: 'POST',
        body: { instruction: fullInstruction, urgent },
      });

      const result = res.data;
      let reply = '';
      if (result?.instructions?.length > 0) {
        reply = result.instructions.join('\n');
      } else if (result?.total_saved !== undefined) {
        reply = `✅ Done — ${result.companies_checked} companies checked, ${result.total_saved} vacancies saved.`;
        if (Object.keys(result.stats || {}).length > 0) {
          reply += '\n\nBreakdown:\n' + Object.entries(result.stats).map(([c, n]) => `• ${c}: ${n}`).join('\n');
        }
        if (result.errors?.length > 0) reply += `\n\n⚠️ Issues:\n${result.errors.slice(0, 3).join('\n')}`;
      } else {
        reply = '✅ Instruction queued — will execute on next agent run (every 6 hours).';
      }

      await supabase.from('agent_conversations').insert({
        direction: 'from_agent',
        message: reply,
        message_type: 'report',
      });
    } catch {
      await supabase.from('agent_conversations').insert({
        direction: 'from_agent',
        message: '⚠️ Agent is busy or unreachable. Instruction saved — will execute on next scheduled run.',
        message_type: 'report',
      });
    }

    await load();
    setSending(false);
  };

  const handleFile = async (file: File) => {
    const maxSize = 30 * 1024 * 1024; // 30MB limit
    if (file.size > maxSize) { alert('File too large. Max 30MB.'); return; }
    
    setSending(true);
    setInput('');

    // Show user we received the file
    await supabase.from('agent_conversations').insert({
      direction: 'from_admin',
      message: `📎 Processing: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB) — extracting text...`,
      message_type: 'attachment',
    });

    let extractedText = '';
    let attachType = 'file';

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        attachType = 'pdf';
        // Extract text from PDF using FileReader + basic text extraction
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        
        // Basic PDF text extraction - find text between BT and ET markers
        let pdfText = '';
        const decoder = new TextDecoder('latin1');
        const rawText = decoder.decode(uint8);
        
        // Extract text streams from PDF
        const textMatches = rawText.matchAll(/BT[\s\S]*?ET/g);
        for (const match of textMatches) {
          const block = match[0];
          // Extract strings in parentheses (PDF text format)
          const strMatches = block.matchAll(/\(([^)]{1,200})\)/g);
          for (const s of strMatches) {
            const clean = s[1].replace(/\\[nrt]/g, ' ').replace(/[^\x20-\x7E]/g, '').trim();
            if (clean.length > 2) pdfText += clean + ' ';
          }
        }
        
        // Also try to find hex strings
        const hexMatches = rawText.matchAll(/<([0-9A-Fa-f]{4,})>/g);
        for (const h of hexMatches) {
          try {
            const hex = h[1];
            let str = '';
            for (let i = 0; i < hex.length - 1; i += 4) {
              const code = parseInt(hex.substring(i, i+4), 16);
              if (code > 31 && code < 127) str += String.fromCharCode(code);
            }
            if (str.length > 3) pdfText += str + ' ';
          } catch {}
        }
        
        extractedText = pdfText.replace(/\s+/g, ' ').trim().substring(0, 15000);
        
        if (!extractedText || extractedText.length < 50) {
          extractedText = `PDF file: ${file.name}. Size: ${(file.size/1024/1024).toFixed(1)}MB. Text extraction yielded minimal content — PDF may be image-based or encrypted. Please use a text-based PDF.`;
        }

      } else if (file.type.startsWith('image/')) {
        attachType = 'image';
        extractedText = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file);
        });
      } else {
        attachType = 'text';
        extractedText = await file.text();
      }
    } catch (e) {
      extractedText = `Error reading file ${file.name}: ${String(e)}`;
    }

    // Send extracted content to agent — NOT the raw file
    const instruction = `Extract all maritime job vacancies from this ${attachType} file named "${file.name}". File has been parsed — here is the extracted content:\n\n${extractedText.substring(0, 12000)}`;

    try {
      const res = await supabase.functions.invoke('researcher-agent', {
        method: 'POST',
        body: { instruction, urgent: true },
      });

      const result = res.data;
      let reply = '';
      if (result?.instructions?.length > 0) {
        reply = result.instructions.join('\n');
      } else if (result?.total_saved !== undefined) {
        reply = `✅ Processed "${file.name}"\nFound ${result.total_saved} vacancies saved to database.`;
      } else {
        reply = `✅ File processed. Agent is extracting vacancies from "${file.name}".`;
      }

      await supabase.from('agent_conversations').insert({
        direction: 'from_agent',
        message: reply,
        message_type: 'report',
      });
    } catch {
      await supabase.from('agent_conversations').insert({
        direction: 'from_agent',
        message: `⚠️ Could not process "${file.name}" — try a smaller file or paste the text directly.`,
        message_type: 'report',
      });
    }

    await load();
    setSending(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(i => i.type.startsWith('image/'));
    if (imageItem) { e.preventDefault(); const file = imageItem.getAsFile(); if (file) await handleFile(file); }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const handleSend = () => {
    if (!input.trim() || sending) return;
    const urlMatch = input.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      sendInstruction(`Fetch this URL and extract all maritime job vacancies from it: ${input}`, true);
    } else {
      sendInstruction(input, false);
    }
  };

  const fmt = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ color: '#D4AF37', fontSize: 18, fontWeight: 700, margin: 0 }}>
              🤖 Agent Command Center
            </h3>
            <p style={{ color: '#556', fontSize: 11, marginTop: 4 }}>
              Type instructions · Paste links · Drop PDFs or images · Agent learns and executes
            </p>
          </div>
          <button onClick={load} style={{
            background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
            color: '#D4AF37', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Quick commands */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {QUICK_COMMANDS.map(qc => (
          <button key={qc.label} onClick={() => sendInstruction(qc.cmd, qc.urgent)} disabled={sending}
            style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.18)', color: '#D4AF37', padding: '5px 11px', borderRadius: 20, cursor: sending ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600, opacity: sending ? 0.5 : 1 }}>
            {qc.icon} {qc.label}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div
        style={{
          background: '#0a1628', borderRadius: 12, padding: 16,
          maxHeight: 420, overflowY: 'auto', marginBottom: 16,
          border: dragOver ? '2px dashed #D4AF37' : '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#334' }}>
            <p style={{ fontSize: 40 }}>🤖</p>
            <p style={{ color: '#556', marginTop: 8 }}>Agent ready. Try a quick command or type below.</p>
            <p style={{ color: '#334', fontSize: 11, marginTop: 4 }}>Drop a PDF or image of a job flier here</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', justifyContent: msg.direction === 'from_admin' ? 'flex-end' : 'flex-start',
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
              background: msg.direction === 'from_admin' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${msg.direction === 'from_admin' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <p style={{ fontSize: 9, color: '#556', marginBottom: 4 }}>
                {msg.direction === 'from_admin' ? '👤 You (Admin)' : '🤖 SeaMinds Agent'} · {fmt(msg.created_at)} WIB
              </p>
              <p style={{
                fontSize: 12, color: msg.direction === 'from_admin' ? '#D4AF37' : '#ccc',
                whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0,
              }}>
                {msg.message}
              </p>
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <p style={{ fontSize: 12, color: '#888' }}>⏳ Agent is processing...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <button onClick={() => fileRef.current?.click()} disabled={sending} title="Attach PDF, image, or screenshot"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: 10, width: 42, height: 42, flexShrink: 0, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          📎
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !sending) {
              e.preventDefault();
              handleSend();
            }
          }}
          onPaste={handlePaste}
          placeholder='Type instruction or paste a link... e.g. "Check https://angloeastern.com/careers for LNG vacancies" or paste a screenshot'
          disabled={sending}
          rows={2}
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', color: 'white', fontSize: 12, outline: 'none', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' as const }}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()}
          style={{ background: input.trim() && !sending ? 'linear-gradient(135deg,#D4AF37,#e8c547)' : '#1a1a1a', color: input.trim() && !sending ? '#0a1628' : '#333', border: 'none', borderRadius: 10, width: 42, height: 42, flexShrink: 0, fontWeight: 800, fontSize: 18, cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sending ? '⏳' : '→'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {['↵ Enter to send', 'Shift+Enter for new line', '📎 Attach PDF/image', 'Paste screenshot directly', 'Drop files anywhere above'].map(hint => (
          <span key={hint} style={{ color: '#333', fontSize: 10 }}>{hint}</span>
        ))}
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}
