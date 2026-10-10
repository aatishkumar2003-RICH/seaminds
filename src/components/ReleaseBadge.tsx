import { CURRENT_RELEASE, formatWib } from "@/lib/releaseInfo";

/** Small, unobtrusive build label. */
const ReleaseBadge = ({ className = "" }: { className?: string }) => {
  const when = formatWib(CURRENT_RELEASE.buildTime);
  return (
    <p className={`text-center text-[10px] tracking-wide ${className}`} style={{ color: "#94A3B8", opacity: 0.75 }}>
      <span style={{ color: "#D4AF37" }}>Build {CURRENT_RELEASE.buildId}</span>
      {when && <> · built {when}</>}
    </p>
  );
};

export default ReleaseBadge;
