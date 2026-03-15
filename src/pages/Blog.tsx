import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";

interface BlogPost {
  id: string;
  title: string;
  slug: string | null;
  region: string | null;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  language: string;
  created_at: string;
}

const LANGUAGES = [
  { value: "all", label: "All" },
  { value: "en", label: "English" },
  { value: "tl", label: "Filipino" },
  { value: "hi", label: "Hindi" },
  { value: "id", label: "Bahasa Indonesia" },
];

const LANG_LABELS: Record<string, string> = {
  en: "English",
  tl: "Filipino",
  hi: "Hindi",
  id: "Bahasa",
};

const Blog = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [langFilter, setLangFilter] = useState("all");

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, region, content, excerpt, image_url, language, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      setPosts((data as BlogPost[]) ?? []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const filtered = langFilter === "all" ? posts : posts.filter((p) => p.language === langFilter);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const preview = (content: string) => {
    const text = content.replace(/\n/g, " ").trim();
    return text.length > 120 ? text.slice(0, 120) + "…" : text;
  };

  const toSlug = (post: BlogPost) => post.slug || post.id;

  return (
    <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
      <Helmet>
        <title>SeaMinds Blog — Maritime Insights for Seafarers</title>
        <meta name="description" content="Maritime insights, updates and knowledge for seafarers worldwide. Read articles in English, Filipino, Hindi and Bahasa Indonesia." />
        <link rel="canonical" href="https://seaminds.life/blog" />
        <meta property="og:title" content="SeaMinds Blog — Maritime Insights for Seafarers" />
        <meta property="og:description" content="Maritime insights, updates and knowledge for seafarers worldwide. Read articles in English, Filipino, Hindi and Bahasa Indonesia." />
        <meta property="og:url" content="https://seaminds.life/blog" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://seaminds.life/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SeaMinds Blog — Maritime Insights for Seafarers" />
        <meta name="twitter:description" content="Maritime insights, updates and knowledge for seafarers worldwide." />
        <meta name="twitter:image" content="https://seaminds.life/og-image.png" />
        <link rel="alternate" type="application/rss+xml" title="SeaMinds Blog RSS" href="https://seaminds.life/rss.xml" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://seaminds.life" },
            { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://seaminds.life/blog" }
          ]
        })}</script>
      </Helmet>
      <HomeNav />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "#E0E6ED" }}>
          SeaMinds <span style={{ color: "#D4AF37" }}>Blog</span>
        </h1>
        <p className="mb-8" style={{ color: "#94A3B8" }}>
          Maritime insights, updates &amp; knowledge for seafarers worldwide.
        </p>

        {/* Language filter bar */}
        <div className="flex flex-wrap gap-2 mb-10">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => setLangFilter(l.value)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all border"
              style={{
                background: langFilter === l.value ? "#D4AF37" : "transparent",
                color: langFilter === l.value ? "#0D1B2A" : "#94A3B8",
                borderColor: langFilter === l.value ? "#D4AF37" : "#1E3A5F",
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-lg h-80" style={{ background: "#112240" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-20" style={{ color: "#94A3B8" }}>
            No articles found. Check back soon!
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((post) => (
              <Card
                key={post.id}
                className="group cursor-pointer overflow-hidden border transition-all hover:shadow-lg"
                style={{ background: "#112240", borderColor: "#1E3A5F" }}
                onClick={() => navigate(`/blog/${toSlug(post)}`)}
              >
                {/* Card image */}
                <div className="relative w-full h-[200px] overflow-hidden" style={{ background: "#0D1B2A" }}>
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "#1E3A5F" }}>
                      <span style={{ color: "#D4AF37", fontSize: 48 }}>⚓</span>
                    </div>
                  )}
                  {/* Language badge */}
                  <span
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#0D1B2A", color: "#D4AF37", border: "1px solid #D4AF37" }}
                  >
                    {LANG_LABELS[post.language] || post.language}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-5">
                  <h2 className="text-lg font-bold mb-2 group-hover:opacity-80 transition-opacity" style={{ color: "#E0E6ED" }}>
                    {post.title}
                  </h2>
                  <p className="text-sm mb-4 leading-relaxed" style={{ color: "#94A3B8" }}>
                    {post.excerpt || preview(post.content)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs flex items-center gap-1" style={{ color: "#64748B" }}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.created_at)}
                    </span>
                    <Button
                      size="sm"
                      className="text-xs font-semibold"
                      style={{ background: "#D4AF37", color: "#0D1B2A" }}
                    >
                      Read Full Article
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <HomeFooter />
    </div>
  );
};

export default Blog;
