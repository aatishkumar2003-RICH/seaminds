import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface Message {
  id: number;
  role: "ai" | "user";
  text: string;
}

const GREETING = `Hey Rajan, it's SeaMinds. 👋

How are you feeling today? No right or wrong answer — just checking in.`;

const AI_RESPONSES = [
  "Thanks for sharing that with me. That sounds like a lot to carry. What's been weighing on you most?",
  "I hear you. Being away from family is one of the hardest parts of life at sea. How long until your next leave?",
  "That makes sense. Sleep can be tough with the watch schedule. Have you tried anything that helps, even a little?",
  "You're not alone in feeling that way. A lot of crew go through the same thing. Want to talk more about it?",
  "I appreciate you opening up. That takes strength. What would make today even a little bit better for you?",
];

const CrewChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const responseIndex = useRef(0);

  useEffect(() => {
    // AI sends first message automatically
    const timer = setTimeout(() => {
      setMessages([{ id: 1, role: "ai", text: GREETING }]);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: "user", text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const aiText = AI_RESPONSES[responseIndex.current % AI_RESPONSES.length];
      responseIndex.current += 1;
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "ai", text: aiText }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-border">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">Good evening</p>
        <h1 className="text-xl font-semibold text-foreground">Rajan</h1>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-fade-in max-w-[85%] ${
              msg.role === "ai" ? "mr-auto" : "ml-auto"
            }`}
          >
            {msg.role === "ai" && (
              <p className="text-xs font-medium text-primary mb-1 ml-1">SeaMinds</p>
            )}
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "ai"
                  ? "bg-secondary text-secondary-foreground rounded-tl-md"
                  : "bg-primary text-primary-foreground rounded-tr-md"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
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
            disabled={!input.trim() || isTyping}
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
