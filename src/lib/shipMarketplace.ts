import { supabase } from "@/integrations/supabase/client";

export const VESSEL_TYPES = ["Tanker", "Bulk Carrier", "Container", "Gas Carrier", "General Cargo", "Offshore / Tug", "Other"] as const;
export const MAX_PHOTOS = 8;

export const MARKETPLACE_NOTICE =
  "Marketplace Notice & Disclaimer: SeaMinds is an introductory noticeboard platform only. SeaMinds is not a shipbroker, maritime agent, surveyor, valuer, escrow agent, or party to any contract or transaction. All vessel particulars, specifications, classification records, equipment statuses, photos and price indications are supplied solely by the listing party and are not verified, inspected or guaranteed by SeaMinds. Prospective buyers are solely responsible for independent technical inspections, class record reviews, title and lien searches, sanctions checks, and for negotiating their own Memorandum of Agreement (e.g. BIMCO SALEFORM) and escrow arrangements directly with the seller. To the fullest extent permitted by law, SeaMinds disclaims all liability for any errors, misrepresentations, transactions, losses or disputes arising from any listing.";

export const SELLER_DECLARATION = [
  "Authority: I am the registered owner, an officer of the owning entity, the appointed manager with documented owner authorisation, or a broker holding a valid written mandate from the registered owner.",
  "Accuracy: all information, particulars, survey statuses, photos and compliance statements are accurate, truthful and not misleading.",
  "Sanctions & title: the vessel, its registered and beneficial owners and operators are not subject to UN, US (OFAC), EU, UK or other applicable sanctions, and the vessel is not under undisclosed arrest, maritime liens or ownership dispute.",
  "Indemnity: I will indemnify and hold harmless SeaMinds, its directors and affiliates from any claims, penalties or damages arising from an unauthorised listing, false particulars or infringing materials.",
];

/** Resize + convert an image to WebP (max 1920px, q≈0.82) to keep uploads small on ship connections. */
export async function compressPhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("compress failed"))), "image/webp", 0.82));
}

export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("ship-listings").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

/** Listing is locked behind SeaMinds email approval (marketplace_sellers, admin-granted). */
export const marketplaceApprovalMailto = (company?: string | null, email?: string | null) =>
  `mailto:admin@seaminds.life?subject=${encodeURIComponent("Ship Marketplace Listing Approval Request")}&body=${encodeURIComponent(
    `Hello SeaMinds team,\n\nPlease approve our account to list vessels on the Ship Marketplace.\n\nCompany: ${company || ""}\nAccount email: ${email || ""}\nVessel(s) to list (type / IMO):\nBasis of selling authority (owner / mandate / broker):\n\nWe can provide the mandate or ownership documents on request.\n`)}`;
