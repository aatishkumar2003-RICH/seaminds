import { useState, useEffect } from "react";
import { Search, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FindWork from "@/components/opportunities/FindWork";
import PostVacancy from "@/components/opportunities/PostVacancy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface OpportunitiesProps {
  profileId: string;
  firstName: string;
  role: string;
  nationality: string;
  shipName: string;
}

interface ContactNotification {
  id: string;
  company_name: string;
  rank_required: string;
  vessel_type: string;
}

const Opportunities = ({ profileId, firstName, role, nationality, shipName }: OpportunitiesProps) => {
  const [notifications, setNotifications] = useState<ContactNotification[]>([]);
  const [lastName, setLastName] = useState("");
  const [yearsAtSea, setYearsAtSea] = useState("");

  useEffect(() => {
    loadProfileExtras();
    loadNotifications();
  }, []);

  const loadProfileExtras = async () => {
    const { data } = await supabase
      .from("crew_profiles")
      .select("last_name, years_at_sea")
      .eq("id", profileId)
      .single();
    if (data) {
      setLastName(data.last_name);
      setYearsAtSea(data.years_at_sea);
    }
  };

  const loadNotifications = async () => {
    const { data } = await supabase
      .from("contact_requests")
      .select("id, company_name, rank_required, vessel_type")
      .eq("crew_profile_id", profileId)
      .eq("status", "pending");
    if (data) setNotifications(data);
  };

  const handleNotificationResponse = async (id: string, accepted: boolean) => {
    await supabase.from("contact_requests").update({ status: accepted ? "accepted" : "declined" }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast({
      title: accepted ? "Contact Shared" : "Request Declined",
      description: accepted ? "Your details have been shared with the company." : "No details were shared.",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Opportunities</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Find work or post vacancies</p>
      </div>

      {/* Contact Request Notifications */}
      {notifications.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-xl bg-primary/10 border border-primary/20 p-3 space-y-2">
              <p className="text-xs text-foreground">
                <span className="font-semibold text-primary">{n.company_name}</span> is interested in your profile for a{" "}
                <span className="font-semibold">{n.rank_required}</span> position on a {n.vessel_type}. Share your contact details?
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleNotificationResponse(n.id, true)}>Yes</Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => handleNotificationResponse(n.id, false)}>No</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Telegram Banner */}
      <div className="mx-4 mt-3" style={{
        background: "#0D2A1B",
        border: "1px solid #2D6A4F",
        borderRadius: "8px",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ color: "white", fontSize: "13px" }}>📢 Get instant job alerts</span>
        <a href="https://t.me/seamindsjobs" target="_blank" rel="noopener noreferrer"
          style={{
            background: "#2D6A4F",
            color: "white",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "12px",
            marginLeft: "8px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}>
          Join SeaMinds Jobs on Telegram →
        </a>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="find" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-3 bg-secondary">
            <TabsTrigger value="find" className="flex-1 gap-1.5 text-xs">
              <Search size={14} /> Find Work
            </TabsTrigger>
            <TabsTrigger value="post" className="flex-1 gap-1.5 text-xs">
              <FileText size={14} /> Post a Vacancy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="flex-1 overflow-y-auto px-4 pb-4">
            <FindWork
              profileId={profileId}
              firstName={firstName}
              lastName={lastName}
              role={role}
              nationality={nationality}
              yearsAtSea={yearsAtSea}
              shipName={shipName}
            />
          </TabsContent>

          <TabsContent value="post" className="flex-1 overflow-y-auto px-4 pb-4">
            <PostVacancy />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Opportunities;
