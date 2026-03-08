import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWellnessStreak } from "@/hooks/useWellnessStreak";
import StreakDisplay from "@/components/chat/StreakDisplay";
import GoDeepCard from "@/components/GoDeepCard";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface CrewChatProps {
  profileId: string;
  firstName: string;
  role: string;
  shipName: string;
  voyageStartDate: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const CrewChat = ({ profileId, firstName, role, shipName, voyageStartDate }: CrewChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showMoodButtons, setShowMoodButtons] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { streak, recordCheckin } = useWellnessStreak(profileId);

  const FIRST_VISIT_GREETING = `Hey ${firstName}. ${role} on ${shipName} — that's a life most people can't imagine. I don't know your story yet, but I'm here and nothing you tell me goes anywhere else. What's been on your mind lately?`;

  // Load existing messages from DB
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("crew_profile_id", profileId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load messages:", error);
      }

      if (data && data.length > 0) {
        setMessages(data.map((m) => ({ id: m.id, role: m.role as "assistant" | "user", content: m.content })));
        
        // Returning user — generate a contextual re-greeting via AI
        setIsLoading(true);
        try {
          const existingMessages = data.map((m) => ({ role: m.role, content: m.content }));
          const resp = await fetch(CHAT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [
                ...existingMessages,
                { role: "user", content: "[SYSTEM: The crew member has returned to the chat. Generate a warm, brief welcome-back message. Reference something specific from the previous conversation naturally. Start with their first name. Keep it to 2-3 sentences max. Do NOT repeat the safety protocols unless relevant.]" },
              ],
              profileId,
            }),
          });

          if (resp.ok && resp.body) {
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let textBuffer = "";
            let assistantContent = "";
            let streamDone = false;
            const streamId = "welcome-stream";

            while (!streamDone) {
              const { done, value } = await reader.read();
              if (done) break;
              textBuffer += decoder.decode(value, { stream: true });

              let newlineIndex: number;
              while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
                let line = textBuffer.slice(0, newlineIndex);
                textBuffer = textBuffer.slice(newlineIndex + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (line.startsWith(":") || line.trim() === "") continue;
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") { streamDone = true; break; }
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (content) {
                    assistantContent += content;
                    const current = assistantContent;
                    setMessages((prev) => {
                      const last = prev[prev.length - 1];
                      if (last?.id === streamId) {
                        return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
                      }
                      return [...prev, { id: streamId, role: "assistant", content: current }];
                    });
                  }
                } catch {
                  textBuffer = line + "\n" + textBuffer;
                  break;
                }
              }
            }

            // Save the welcome-back message to DB
            const { data: saved } = await supabase
              .from("chat_messages")
              .insert({ crew_profile_id: profileId, role: "assistant", content: assistantContent })
              .select("id")
              .single();

            setMessages((prev) =>
              prev.map((m) => (m.id === streamId ? { ...m, id: saved?.id || crypto.randomUUID() } : m))
            );
          }
        } catch (e) {
          console.error("Failed to generate welcome-back:", e);
        } finally {
          setIsLoading(false);
          setShowMoodButtons(true);
        }
      } else {
        // First time — insert personalized greeting
        const { data: inserted, error: insertErr } = await supabase
          .from("chat_messages")
          .insert({ crew_profile_id: profileId, role: "assistant", content: FIRST_VISIT_GREETING })
          .select("id")
          .single();

        if (!insertErr && inserted) {
          setMessages([{ id: inserted.id, role: "assistant", content: FIRST_VISIT_GREETING }]);
        }
        setShowMoodButtons(true);
      }
      setInitialLoading(false);
    };
    load();
  }, [profileId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const sendMessage = async (overrideContent?: string) => {
    const userContent = (overrideContent || input).trim();
    if (!userContent || isLoading) return;
    if (!overrideContent) setInput("");
    setShowMoodButtons(false);
    setIsLoading(true);

    // Save user message to DB
    const { data: savedUser, error: saveErr } = await supabase
      .from("chat_messages")
      .insert({ crew_profile_id: profileId, role: "user", content: userContent })
      .select("id")
      .single();

    if (saveErr) {
      console.error("Failed to save message:", saveErr);
      toast.error("Failed to send message");
      setIsLoading(false);
      return;
    }

    const userMsg: Message = { id: savedUser.id, role: "user", content: userContent };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    let assistantSoFar = "";
    const streamId = "streaming";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          profileId,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const current = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.id === streamId) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: current } : m));
                }
                return [...prev, { id: streamId, role: "assistant", content: current }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant response to DB
      const { data: savedAssistant } = await supabase
        .from("chat_messages")
        .insert({ crew_profile_id: profileId, role: "assistant", content: assistantSoFar })
        .select("id")
        .single();

      // Replace streaming message with real id
      setMessages((prev) =>
        prev.map((m) => (m.id === streamId ? { ...m, id: savedAssistant?.id || crypto.randomUUID() } : m))
      );
      setMessageCount(prev => prev + 1);
    } catch (e: any) {
      console.error("Chat error:", e);
      toast.error(e.message || "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const MOOD_OPTIONS = [
    { emoji: "😊", label: "Good" },
    { emoji: "😐", label: "Okay" },
    { emoji: "😔", label: "Struggling" },
    { emoji: "😤", label: "Angry" },
  ];

  const handleMoodSelect = (mood: { emoji: string; label: string }) => {
    setShowMoodButtons(false);
    recordCheckin();
    sendMessage(`I'm feeling ${mood.label.toLowerCase()}`);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-border">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">{getTimeGreeting()}</p>
        <h1 className="text-xl font-semibold text-foreground">{firstName}</h1>
        {voyageStartDate && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Day {Math.max(1, Math.ceil((Date.now() - new Date(voyageStartDate).getTime()) / 86400000))} of voyage
          </p>
        )}
      </div>

      {/* AI Disclaimer */}
      <div className="px-4 py-1.5" style={{ background: "rgba(13,27,42,0.6)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-[10px] text-muted-foreground text-center leading-tight">
          ⚕️ This AI is not a medical professional. If you are in crisis, contact ISWAN:{" "}
          <a href="tel:+442073232737" className="underline" style={{ color: "#D4AF37" }}>+44 20 7323 2737</a>
        </p>
      </div>

      {/* Wellness Streak */}
      <StreakDisplay
        currentStreak={streak.currentStreak}
        longestStreak={streak.longestStreak}
        checkedInToday={streak.checkedInToday}
      />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-fade-in max-w-[85%] ${msg.role === "assistant" ? "mr-auto" : "ml-auto"}`}
          >
            {msg.role === "assistant" && (
              <p className="text-xs font-medium text-primary mb-1 ml-1">SeaMinds</p>
            )}
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "assistant"
                  ? "bg-secondary text-secondary-foreground rounded-tl-md"
                  : "bg-primary text-primary-foreground rounded-tr-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && !messages.some((m) => m.id === "streaming") && !messages.some((m) => m.id === "welcome-stream") && (
          <div className="chat-fade-in max-w-[85%] mr-auto">
            <p className="text-xs font-medium text-primary mb-1 ml-1">SeaMinds</p>
            <div className="bg-secondary px-4 py-3 rounded-2xl rounded-tl-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.3s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.6s" }} />
            </div>
          </div>
        )}

        {/* Go Deeper card after 5 AI replies */}
        {messageCount >= 5 && messages[messages.length - 1]?.role === "assistant" && !isLoading && (() => {
          const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
          if (!lastUserMsg) return null;
          return (
            <GoDeepCard
              lastQuery={lastUserMsg.content}
              header="💡 Explore more support resources"
              subtext="Open this topic in a free AI with no message limits"
            />
          );
        })()}

        {showMoodButtons && !isLoading && (
          <div className="chat-fade-in flex flex-wrap gap-2 justify-center py-2">
            {MOOD_OPTIONS.map((mood) => (
              <button
                key={mood.label}
                onClick={() => handleMoodSelect(mood)}
                className="px-4 py-2.5 rounded-2xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition-colors"
              >
                {mood.emoji} {mood.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2">
        <div className="flex items-center gap-2 bg-secondary rounded-2xl px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type how you're feeling..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-30 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrewChat;
