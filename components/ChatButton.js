"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { B } from "@/lib/constants";
import { IcChat, btnYellow } from "@/components/ui";
import { buildChatContext } from "@/lib/buildChatContext";

const SUGGESTIONS = [
  "Which students are arriving today?",
  "Who is on duty this evening?",
  "How many students are on site?",
  "What excursions are planned this week?",
  "List students with dietary requirements",
  "Who is departing tomorrow?",
];

export default function ChatButton({ centreId, centreName, centreData }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user"|"assistant", content: string }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const contextRef = useRef(null);

  // Build context once per open (cache while panel is open)
  useEffect(() => {
    if (open && centreData) {
      contextRef.current = buildChatContext(centreData, centreName);
    }
  }, [open, centreData, centreName]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Escape key closes panel
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && open) setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const send = useCallback(async (text) => {
    const userMsg = text.trim();
    if (!userMsg || loading) return;
    setInput("");
    setError(null);

    const next = [...messages, { role: "user", content: userMsg }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centreId,
          context: contextRef.current || "",
          messages: next,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [messages, loading, centreId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  if (!centreId) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open AI assistant"}
        style={{
          ...btnYellow,
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 1000,
          boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.28)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.22)"; }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={B.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <IcChat />
        )}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div
          role="dialog"
          aria-label="AI assistant"
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: "min(420px, calc(100vw - 24px))",
            maxHeight: "calc(100vh - 120px)",
            background: B.white,
            border: `1px solid ${B.border}`,
            borderRadius: 14,
            boxShadow: "0 8px 40px rgba(28,48,72,0.18)",
            display: "flex",
            flexDirection: "column",
            zIndex: 999,
            overflow: "hidden",
            animation: "slideUpIn 0.18s ease-out",
          }}
        >
          {/* Header */}
          <div style={{
            background: B.navy,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{ color: B.yellow, display: "flex" }}><IcChat /></div>
            <div style={{ flex: 1 }}>
              <div style={{ color: B.white, fontWeight: 700, fontSize: 13, fontFamily: "'Raleway', sans-serif" }}>Centre Assistant</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{centreName}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "rgba(255,255,255,0.7)", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minHeight: 120 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 16 }}>
                <div style={{ fontSize: 12, color: B.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
                  Ask anything about <strong>{centreName}</strong>.<br />
                  I can see your students, staff, rota, and more.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        background: B.ice, border: `1px solid ${B.border}`,
                        borderRadius: 20, padding: "5px 12px",
                        fontSize: 11, color: B.navy, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = B.border; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = B.ice; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "85%",
                  padding: "9px 13px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? B.navy : B.ice,
                  color: m.role === "user" ? B.white : B.text,
                  fontSize: 12,
                  lineHeight: 1.6,
                  border: m.role === "assistant" ? `1px solid ${B.border}` : "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: B.ice, border: `1px solid ${B.border}`, borderRadius: "14px 14px 14px 4px", padding: "10px 14px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: B.textLight, display: "block", animation: `typingDot 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: B.dangerBg, border: `1px solid #fca5a5`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: B.danger }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{ borderTop: `1px solid ${B.border}`, padding: "10px 12px", display: "flex", gap: 8, background: B.bg, flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about students, rota, transfers…"
              disabled={loading}
              style={{
                flex: 1,
                border: `1px solid ${B.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "inherit",
                background: B.white,
                color: B.text,
                outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = B.navy; }}
              onBlur={(e) => { e.target.style.borderColor = B.border; }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send"
              style={{
                ...btnYellow,
                width: 36,
                height: 36,
                borderRadius: 8,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: (!input.trim() || loading) ? 0.45 : 1,
                cursor: (!input.trim() || loading) ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={B.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}
