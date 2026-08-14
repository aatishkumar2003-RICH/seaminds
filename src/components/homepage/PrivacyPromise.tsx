const PrivacyPromise = () => (
  <section className="relative py-12 sm:py-16">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-4 md:grid-cols-2">
      <div
        className="rounded-2xl px-5 py-5 backdrop-blur-sm"
        style={{
          border: "1px solid rgba(20,184,166,0.45)",
          background: "rgba(17,34,64,0.7)",
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.25em] font-mono-score mb-2"
          style={{ color: "#14B8A6" }}
        >
          For Crew
        </p>
        <h3 className="text-lg md:text-xl font-bold mb-2 leading-snug">
          Your Private Life Does Not Become Your Employer's Data.
        </h3>
        <p className="text-sm text-muted-foreground">
          Wellness chats and mood check-ins are sealed — never visible to any company.
        </p>
      </div>

      <div
        className="rounded-2xl px-5 py-5 backdrop-blur-sm"
        style={{
          border: "1px solid rgba(212,175,55,0.45)",
          background: "rgba(17,34,64,0.7)",
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-mono-score mb-2">
          For Companies
        </p>
        <h3 className="text-lg md:text-xl font-bold mb-2 leading-snug">
          You See Professional Information — Never Private Wellness Conversations.
        </h3>
        <p className="text-sm text-muted-foreground">
          Professional profiles, assessments and documents — with crew consent, nothing else.
        </p>
      </div>
    </div>
  </section>
);

export default PrivacyPromise;
