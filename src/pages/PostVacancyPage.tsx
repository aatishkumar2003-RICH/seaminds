import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PostVacancy from "@/components/opportunities/PostVacancy";

const PostVacancyPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: "#0D1B2A" }}>
      <header style={{ borderBottom: "1px solid #1e3a5f", padding: "14px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => navigate("/manager/dashboard")}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
          >
            <ArrowLeft size={16} /> Dashboard
          </button>
          <div style={{ marginLeft: "auto" }}>
            <h1 style={{ color: "#D4AF37", fontSize: 16, fontWeight: 800 }}>Post a Vacancy</h1>
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 40px" }}>
        <PostVacancy />
      </main>
    </div>
  );
};

export default PostVacancyPage;
