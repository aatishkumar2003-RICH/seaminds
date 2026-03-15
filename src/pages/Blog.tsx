import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";

interface BlogPost {
  id: string;
  title: string;
  region: string | null;
  content: string;
  excerpt: string | null;
  created_at: string;
}

const Blog = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BlogPost | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, region, content, excerpt, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });
      setPosts(data ?? []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <HomeNav />
      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        {selected ? (
          <article>
            <Button
              variant="ghost"
              className="mb-6 text-muted-foreground hover:text-primary"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to articles
            </Button>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">{selected.title}</h1>
            <div className="flex items-center gap-4 mb-8 text-muted-foreground text-sm">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(selected.created_at)}</span>
              {selected.region && (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <MapPin className="w-3 h-3 mr-1" />{selected.region}
                </Badge>
              )}
            </div>
            <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {selected.content}
            </div>
          </article>
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              SeaMinds <span className="text-primary">Blog</span>
            </h1>
            <p className="text-muted-foreground mb-10">Maritime insights, updates & knowledge for seafarers worldwide.</p>

            {loading ? (
              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse h-52" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-muted-foreground text-center py-20">No articles published yet. Check back soon!</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {posts.map((post) => (
                  <Card
                    key={post.id}
                    className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
                    onClick={() => setSelected(post)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{formatDate(post.created_at)}
                        </span>
                        {post.region && (
                          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                            <MapPin className="w-3 h-3 mr-1" />{post.region}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{post.title}</CardTitle>
                      {post.excerpt && <CardDescription className="line-clamp-2">{post.excerpt}</CardDescription>}
                    </CardHeader>
                    <CardFooter>
                      <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80">
                        Read more →
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <HomeFooter />
    </div>
  );
};

export default Blog;
