import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-foreground">
          The Ocean Does Not Wait. Neither Should You.
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => navigate('/app')} className="text-sm px-6 h-11">
            Start Free — I Am Crew
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/for-companies')} className="text-sm px-6 h-11">
            Hire Verified Crew — I Am a Company
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
