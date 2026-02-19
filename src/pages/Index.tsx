import { useState } from "react";
import { MessageCircle, LayoutDashboard } from "lucide-react";
import CrewChat from "@/components/CrewChat";
import WelfareDashboard from "@/components/WelfareDashboard";

type Screen = "chat" | "dashboard";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("chat");

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background">
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {screen === "chat" ? <CrewChat /> : <WelfareDashboard />}
      </div>

      {/* Bottom Nav */}
      <nav className="nav-glass flex items-center justify-around py-3 px-6">
        <button
          onClick={() => setScreen("chat")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            screen === "chat" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageCircle size={20} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Chat</span>
        </button>
        <button
          onClick={() => setScreen("dashboard")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            screen === "dashboard" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-medium tracking-wide uppercase">Welfare</span>
        </button>
      </nav>
    </div>
  );
};

export default Index;
