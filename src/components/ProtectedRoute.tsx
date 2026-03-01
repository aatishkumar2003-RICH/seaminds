import { Navigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { authUser, user, loading } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  if (!authUser) return <Navigate to="/auth" replace />;

  // If profile not completed (no full_name), redirect to completion
  if (user && !user.full_name) return <Navigate to="/complete-profile" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
