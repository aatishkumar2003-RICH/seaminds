// Pure email builder for interview reminders and improvement plans. No imports (vitest-testable).
export type FollowupRow = {
  kind: "reminder" | "improvement"; invite_id: string; token: string; email: string | null; crew_id: string | null;
  name: string | null; company: string | null; rank: string | null; language: string | null; prep_tracks: string[] | null;
  score: number | null; attempt: number; modules: { title: string; token: string }[];
};
const SITE = "https://seaminds.life";
const esc = (v: unknown) => String(v ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const TRACK: Record<string, { en: string; vi: string; url: string }> = {
  english: { en: "Maritime English practice", vi: "Luyện tiếng Anh hàng hải", url: `${SITE}/training?tab=english` },
  technical: { en: "Rank-based technical practice (AI examiner)", vi: "Luyện kỹ thuật theo chức danh (AI)", url: `${SITE}/maritime-interview` },
  vetting: { en: "Vetting & regulatory briefings", vi: "Bài học kiểm tra vetting & quy định", url: `${SITE}/training` },
};

export function followupEmail(r: FollowupRow) {
  const vi = r.language === "vi";
  const co = r.company || "The company";
  const hi = r.name ? `Dear ${esc(r.name)},` : "Hello,";
  const tracks = (r.prep_tracks || []).filter((t) => TRACK[t]);
  const btn = (href: string, label: string) => `<p><a href="${esc(href)}" style="background:#D4AF37;color:#0D1B2A;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;
  let subject: string, en: string, vn = "", text: string[];
  if (r.kind === "reminder") {
    const link = `${SITE}/interview/${encodeURIComponent(r.token)}`;
    subject = `Friendly reminder: your ${r.rank || "crew"} assessment with ${co}`;
    en = `<p>${hi}</p><p><b>${esc(co)}</b> is still waiting for your self-paced assessment${r.rank ? ` for <b>${esc(r.rank)}</b>` : ""}. There is no fixed time — do it when you are off watch. It takes about 10–15 minutes on your phone.</p>${btn(link, "Start when ready")}`;
    if (vi) vn = `<p><b>${esc(co)}</b> đang chờ bài đánh giá của bạn. Không có giờ cố định — hãy làm khi bạn rảnh ca, khoảng 10–15 phút trên điện thoại.</p>`;
    text = [hi.replace(/<[^>]+>/g, ""), `${co} is still waiting for your self-paced assessment. No fixed time; about 10-15 minutes.`, link];
  } else {
    const items = r.modules.map((m) => ({ title: m.title, url: `${SITE}/training/${encodeURIComponent(m.token)}` }));
    const extra = tracks.map((t) => ({ title: vi ? `${TRACK[t].en} / ${TRACK[t].vi}` : TRACK[t].en, url: TRACK[t].url }));
    const all = [...items, ...extra];
    subject = r.attempt > 1 ? `Reminder: finish your refresher training for ${co}` : `Your improvement plan from ${co}`;
    en = `<p>${hi}</p><p>Thank you for completing your assessment with <b>${esc(co)}</b>. Your result is saved. To strengthen your application, please complete these short refreshers (3–5 minutes each):</p><ol>${all.map((i) => `<li><a href="${esc(i.url)}" style="color:#D4AF37">${esc(i.title)}</a></li>`).join("")}</ol><p>The company can see when you finish them.</p>`;
    if (vi) vn = `<p>Cảm ơn bạn đã hoàn thành bài đánh giá với <b>${esc(co)}</b>. Để hồ sơ mạnh hơn, hãy hoàn thành các bài ôn tập ngắn ở trên (3–5 phút mỗi bài). Công ty sẽ thấy khi bạn hoàn thành.</p>`;
    text = [hi.replace(/<[^>]+>/g, ""), `Thank you for completing your assessment with ${co}. Please complete these short refreshers:`, ...all.map((i, n) => `${n + 1}. ${i.title}: ${i.url}`)];
  }
  const html = `<div style="background:#0D1B2A;border-radius:14px;padding:24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;line-height:1.6">${en}${vn ? `<hr style="border-color:rgba(212,175,55,0.3)">${vn}` : ""}<p style="color:#94A3B8;font-size:12px;margin-top:20px">Free for crew. Need help? support@seaminds.life · The SeaMinds Team</p></div>`;
  return { subject, html, text: [...text, "", "Free for crew. Help: support@seaminds.life — The SeaMinds Team"].join("\n") };
}
