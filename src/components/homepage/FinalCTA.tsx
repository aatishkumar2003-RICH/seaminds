import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(32 45% 20%) 0%, hsl(32 35% 12%) 100%)" }}>
      <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 60% 50%, hsl(32 45% 64%) 0%, transparent 50%)" }} />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">
          The Ocean Does Not Wait.
          <br />
          Neither Should You.
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={() => navigate("/app")} className="text-base px-8 h-12">
            Start Free — I Am Crew
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/manager")} className="text-base px-8 h-12">
            Hire Verified Crew — I Am a Company
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
