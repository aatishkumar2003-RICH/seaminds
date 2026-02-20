import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface CrewChatProps {
  profileId: string;
  firstName: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const CrewChat = ({ profileId, firstName }: CrewChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const GREETING = `Hey ${firstName}, it's SeaMinds. 👋\n\nHow are you feeling today? No right or wrong answer — just checking in.`;

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
      } else {
        // First time — insert greeting
        const { data: inserted, error: insertErr } = await supabase
          .from("chat_messages")
          .insert({ crew_profile_id: profileId, role: "assistant", content: GREETING })
          .select("id")
          .single();

        if (!insertErr && inserted) {
          setMessages([{ id: inserted.id, role: "assistant", content: GREETING }]);
        }
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

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput("");
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
      </div>

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

        {isLoading && !messages.some((m) => m.id === "streaming") && (
          <div className="chat-fade-in max-w-[85%] mr-auto">
            <p className="text-xs font-medium text-primary mb-1 ml-1">SeaMinds</p>
            <div className="bg-secondary px-4 py-3 rounded-2xl rounded-tl-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.3s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.6s" }} />
            </div>
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
            onClick={sendMessage}
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
