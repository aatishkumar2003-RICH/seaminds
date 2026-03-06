import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Eye, Download, RefreshCw, Upload, Plus, Trash2, ChevronDown, Shield, Award, Anchor } from "lucide-react";
import { toast } from "sonner";

interface MyDocumentsSectionProps {
  profileId: string;
}

interface DocRecord {
  id: string;
  category: string;
  file_name: string;
  storage_path: string;
  source: string;
  created_at: string;
  signedUrl?: string;
}

const DOC_CATEGORIES = [
  { value: "cv", label: "CV / Resume", icon: "📄" },
  { value: "coc", label: "Certificate of Competency (COC)", icon: "🎓" },
  { value: "cdc", label: "Continuous Discharge Certificate (CDC)", icon: "📋" },
  { value: "bst", label: "Basic Safety Training (BST)", icon: "🛡️" },
  { value: "gmdss", label: "GMDSS Certificate", icon: "📡" },
  { value: "tanker", label: "Tanker Endorsement", icon: "⛽" },
  { value: "medical", label: "Medical Certificate", icon: "🏥" },
  { value: "sea_service", label: "Sea Service Record", icon: "⚓" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label])
);
const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.icon])
);

const MyDocumentsSection = ({ profileId }: MyDocumentsSectionProps) => {
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("coc");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoading(true);
    const allDocs: DocRecord[] = [];

    // 1. Load manually uploaded documents from crew_documents table
    const { data: dbDocs } = await supabase
      .from("crew_documents")
      .select("*")
      .eq("crew_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (dbDocs) {
      for (const doc of dbDocs) {
        const bucket = doc.source === "smc" ? "smc-documents" : "crew-documents";
        const { data: urlData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(doc.storage_path, 3600);
        allDocs.push({
          ...doc,
          signedUrl: urlData?.signedUrl || undefined,
        });
      }
    }

    // 2. Load CV from crew-cvs bucket
    const { data: cvFiles } = await supabase.storage
      .from("crew-cvs")
      .list(profileId, { limit: 1 });

    if (cvFiles && cvFiles.length > 0) {
      const cvFile = cvFiles[0];
      const cvPath = `${profileId}/${cvFile.name}`;
      const { data: cvUrlData } = await supabase.storage
        .from("crew-cvs")
        .createSignedUrl(cvPath, 3600);

      // Only add if not already tracked in crew_documents
      const alreadyTracked = allDocs.some((d) => d.category === "cv");
      if (!alreadyTracked) {
        allDocs.unshift({
          id: `cv-${cvFile.name}`,
          category: "cv",
          file_name: cvFile.name,
          storage_path: cvPath,
          source: "onboarding",
          created_at: (cvFile as any).created_at || new Date().toISOString(),
          signedUrl: cvUrlData?.signedUrl || undefined,
        });
      }
    }

    // 3. Load SMC assessment documents from smc-documents bucket
    const { data: smcAssessment } = await supabase
      .from("smc_assessments")
      .select("id")
      .eq("crew_profile_id", profileId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (smcAssessment) {
      const smcPath = `${profileId}/${smcAssessment.id}`;
      const { data: smcFiles } = await supabase.storage
        .from("smc-documents")
        .list(smcPath, { limit: 20 });

      if (smcFiles && smcFiles.length > 0) {
        for (const file of smcFiles) {
          const fullPath = `${smcPath}/${file.name}`;
          // Check if already tracked
          const alreadyTracked = allDocs.some((d) => d.storage_path === fullPath);
          if (alreadyTracked) continue;

          // Determine category from filename
          let category = "additional";
          if (file.name.startsWith("cdc")) category = "cdc";
          else if (file.name.startsWith("coc")) category = "coc";
          else if (file.name.startsWith("bst")) category = "bst";

          const { data: urlData } = await supabase.storage
            .from("smc-documents")
            .createSignedUrl(fullPath, 3600);

          allDocs.push({
            id: `smc-${file.name}`,
            category,
            file_name: file.name,
            storage_path: fullPath,
            source: "smc",
            created_at: (file as any).created_at || new Date().toISOString(),
            signedUrl: urlData?.signedUrl || undefined,
          });
        }
      }
    }

    setDocuments(allDocs);
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, [profileId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${profileId}/${selectedCategory}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("crew-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("crew_documents")
        .insert({
          crew_profile_id: profileId,
          category: selectedCategory,
          file_name: file.name,
          storage_path: path,
          source: "manual",
        });
      if (dbError) throw dbError;

      toast.success(`${CATEGORY_LABELS[selectedCategory] || selectedCategory} uploaded`);
      await loadDocuments();
      setShowCategoryPicker(false);
    } catch (e) {
      console.error("Document upload error:", e);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocRecord) => {
    if (doc.source === "smc") {
      toast.error("SMC assessment documents cannot be deleted");
      return;
    }

    try {
      if (doc.id.startsWith("cv-")) {
        // Delete from crew-cvs bucket
        await supabase.storage.from("crew-cvs").remove([doc.storage_path]);
      } else {
        // Delete from crew-documents bucket and DB
        await supabase.storage.from("crew-documents").remove([doc.storage_path]);
        await supabase.from("crew_documents").delete().eq("id", doc.id);
      }
      toast.success("Document removed");
      await loadDocuments();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const docCount = documents.length;

  return (
    <div className="mx-4 mb-4 bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
          <FileText size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">My Documents</p>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading..." : `${docCount} document${docCount !== 1 ? "s" : ""} on file`}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Document list */}
          {documents.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No documents uploaded yet
            </p>
          )}

          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3"
            >
              <span className="text-lg shrink-0">
                {CATEGORY_ICONS[doc.category] || "📎"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {CATEGORY_LABELS[doc.category] || doc.category}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{doc.file_name}</p>
                {doc.source === "smc" && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-primary mt-0.5">
                    <Shield size={8} /> SMC Assessment
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {doc.signedUrl && (
                  <>
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                      title="View"
                    >
                      <Eye size={12} className="text-primary" />
                    </a>
                    <a
                      href={doc.signedUrl}
                      download={doc.file_name}
                      className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
                      title="Download"
                    >
                      <Download size={12} className="text-muted-foreground" />
                    </a>
                  </>
                )}
                {doc.source !== "smc" && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} className="text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add document */}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />

          {showCategoryPicker ? (
            <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Select document type:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DOC_CATEGORIES.filter((c) => c.value !== "cv").map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      setSelectedCategory(cat.value);
                      fileRef.current?.click();
                    }}
                    className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                      selectedCategory === cat.value
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary text-foreground hover:bg-secondary/80"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label.split("(")[0].trim()}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCategoryPicker(false)}
                className="w-full text-xs text-muted-foreground py-1"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCategoryPicker(true)}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {uploading ? "Uploading..." : "Add Document"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MyDocumentsSection;
