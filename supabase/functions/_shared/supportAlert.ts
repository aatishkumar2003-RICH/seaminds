// Reuse the existing support sender; never send report text or conversations in admin alerts.
export function adminSupportAlert(ticketRef: string) {
  return {
    from: "SeaMinds Support <crew@seaminds.life>",
    to: ["admin@seaminds.life"],
    reply_to: "support@seaminds.life",
    subject: `SeaMinds: new support report [${ticketRef}]`,
    text: `A user submitted a problem or suggestion.\n\nReference: ${ticketRef}\n\nReview the report in Admin > Support & Incidents:\nhttps://seaminds.life/admin\n\nOnly authorized admins can read the report.`,
  };
}

export async function sendAdminSupportAlert(key: string, ticketRef: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `support-admin-${ticketRef}` },
      body: JSON.stringify(adminSupportAlert(ticketRef)),
    });
    if (!response.ok) { console.warn("support admin alert not accepted:", response.status); return false; }
    return true;
  } catch { console.warn("support admin alert unavailable"); return false; }
  finally { clearTimeout(timeout); }
}