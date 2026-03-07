import { FileText } from "lucide-react";

const ResumeBuilder = () => (
  <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
    <FileText size={48} className="text-primary" />
    <h2 className="text-xl font-bold text-foreground">Seafarer CV Builder</h2>
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

export default ResumeBuilder;
