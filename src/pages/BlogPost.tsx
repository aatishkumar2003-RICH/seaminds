import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";

interface BlogPostData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  language: string;
  created_at: string;
  region: string | null;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      // Try slug first, then id
      let { data } = await supabase
        .from("blog_posts")
        .select("id, title, content, image_url, language, created_at, region")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (!data) {
        const res = await supabase
          .from("blog_posts")
          .select("id, title, content, image_url, language, created_at, region")
          .eq("id", slug)
          .eq("published", true)
          .maybeSingle();
        data = res.data;
      }
      setPost(data as BlogPostData | null);
      setLoading(false);
    };
    fetchPost();
  }, [slug]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
        <HomeNav />
        <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
          <div className="animate-pulse space-y-4">
            <div className="h-64 rounded-lg" style={{ background: "#112240" }} />
            <div className="h-8 w-2/3 rounded" style={{ background: "#112240" }} />
            <div className="h-4 w-1/3 rounded" style={{ background: "#112240" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
        <HomeNav />
        <div className="max-w-3xl mx-auto px-4 pt-24 pb-16 text-center">
          <h1 className="text-2xl font-bold mb-4" style={{ color: "#E0E6ED" }}>Article not found</h1>
          <Button onClick={() => navigate("/blog")} style={{ background: "#D4AF37", color: "#0D1B2A" }}>
            Back to Blog
          </Button>
        </div>
        <HomeFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0D1B2A" }}>
      <Helmet>
        <title>{post.title} — SeaMinds Blog</title>
        <meta name="description" content={post.content.replace(/\n/g, " ").trim().slice(0, 155) + "…"} />
        <link rel="canonical" href={`https://seaminds.life/blog/${slug}`} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.content.replace(/\n/g, " ").trim().slice(0, 155) + "…"} />
        <meta property="og:url" content={`https://seaminds.life/blog/${slug}`} />
        <meta property="og:type" content="article" />
        {post.image_url && <meta property="og:image" content={post.image_url} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.content.replace(/\n/g, " ").trim().slice(0, 155) + "…"} />
        {post.image_url && <meta name="twitter:image" content={post.image_url} />}
      </Helmet>
      <HomeNav />
      <article className="max-w-3xl mx-auto px-4 pt-24 pb-16">
        <Button
          variant="ghost"
          className="mb-6 hover:opacity-80"
          style={{ color: "#D4AF37" }}
          onClick={() => navigate("/blog")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to articles
        </Button>

        {/* Hero image */}
        {post.image_url && (
          <div className="w-full h-64 md:h-80 rounded-lg overflow-hidden mb-8">
            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: "#E0E6ED" }}>
          {post.title}
        </h1>
        <p className="text-sm mb-10" style={{ color: "#64748B" }}>
          {formatDate(post.created_at)}
          {post.region && <> · {post.region}</>}
        </p>

        {/* Article content */}
        <div
          className="text-base leading-relaxed space-y-4"
          style={{ color: "#CBD5E1" }}
        >
          {post.content.split("\n").filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* CTA box */}
        <div
          className="mt-16 rounded-lg p-8 text-center"
          style={{ background: "#0D1B2A", border: "2px solid #D4AF37" }}
        >
          <h3 className="text-xl font-bold mb-2" style={{ color: "#E0E6ED" }}>
            Know your rights. Get your free SeaMinds Command Score
          </h3>
          <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
            Join thousands of seafarers building their maritime career with SeaMinds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/app")}
            style={{ background: "#D4AF37", color: "#0D1B2A" }}
            className="font-bold"
          >
            Join SeaMinds Free
          </Button>
        </div>
      </article>
      <HomeFooter />
    </div>
  );
};

export default BlogPost;
