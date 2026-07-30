/**
 * Mobile / WhatsApp verification provider adapters.
 *
 * The frontend only ever talks to `getMobileVerificationProvider()`, so a future
 * switch to Twilio Verify, Meta WhatsApp Cloud API, Sinch, Vonage or Bird needs
 * no UI changes — only a new adapter registered below plus the matching backend.
 */

export type MobileProviderId =
  | "whatsapp_manual"
  | "twilio_verify"
  | "meta_cloud"
  | "sinch"
  | "vonage"
  | "bird";

export interface MobileChallengeInput {
  token: string;
  phone: string;
  email: string;
  fullName: string;
}

export interface MobileChallengeResult {
  /** "deeplink" = user sends a prefilled WhatsApp message; "otp" = code flow. */
  kind: "deeplink" | "otp";
  /** URL to open (deeplink providers only). */
  url?: string;
  message: string;
}

export interface MobileVerificationProvider {
  id: MobileProviderId;
  label: string;
  /** True when the provider auto-confirms; false = admin/webhook confirms later. */
  automatic: boolean;
  startChallenge(input: MobileChallengeInput): Promise<MobileChallengeResult>;
}

/** Official SeaMinds WhatsApp Business number (E.164, no spaces). */
export const SEAMINDS_WHATSAPP_NUMBER = "+17372508034";

export function buildWhatsAppMessage({ token, phone, email, fullName }: MobileChallengeInput) {
  return [
    "Hello SeaMinds,",
    "I would like to verify my mobile number.",
    "",
    `Name: ${fullName || "-"}`,
    `Registered Email: ${email || "-"}`,
    `Mobile Number: ${phone}`,
    `Verification ID: ${token}`,
  ].join("\n");
}

const whatsappManualProvider: MobileVerificationProvider = {
  id: "whatsapp_manual",
  label: "Verify via WhatsApp",
  automatic: false,
  async startChallenge(input) {
    const text = encodeURIComponent(buildWhatsAppMessage(input));
    return {
      kind: "deeplink",
      url: `https://wa.me/${SEAMINDS_WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${text}`,
      message: "Press SEND in WhatsApp — we confirm your number once the message arrives.",
    };
  },
};

/** Placeholders: wire the backend call, keep the same interface, no UI change. */
const notConfigured = (id: MobileProviderId, label: string): MobileVerificationProvider => ({
  id,
  label,
  automatic: true,
  async startChallenge() {
    throw new Error(`${label} is not configured yet.`);
  },
});

const providers: Record<MobileProviderId, MobileVerificationProvider> = {
  whatsapp_manual: whatsappManualProvider,
  twilio_verify: notConfigured("twilio_verify", "Twilio Verify"),
  meta_cloud: notConfigured("meta_cloud", "Meta WhatsApp Cloud API"),
  sinch: notConfigured("sinch", "Sinch"),
  vonage: notConfigured("vonage", "Vonage"),
  bird: notConfigured("bird", "Bird"),
};

/** Active provider for the current launch. */
export const ACTIVE_MOBILE_PROVIDER: MobileProviderId = "whatsapp_manual";

export function getMobileVerificationProvider(id: MobileProviderId = ACTIVE_MOBILE_PROVIDER) {
  return providers[id];
}

/* ── Phone helpers ───────────────────────────────────────────── */

/** Normalise to E.164 (digits only after a leading +). */
export function toE164(raw: string, dialCode?: string): string {
  let v = String(raw || "").replace(/[^\d+]/g, "");
  if (!v) return "";
  if (!v.startsWith("+")) {
    if (dialCode) v = `${dialCode}${v.replace(/^0+/, "")}`;
    else v = `+${v}`;
  }
  return "+" + v.replace(/\+/g, "");
}

/** Returns an error string, or "" when the number looks valid. */
export function validatePhone(raw: string, dialCode?: string): string {
  const e164 = toE164(raw, dialCode);
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    return "Enter your number in international format with country code (e.g. +639171234567)";
  }
  const digits = e164.slice(1);
  if (/^(\d)\1+$/.test(digits)) return "That number doesn't look real — please check it";
  if (/^(0123456789|1234567890|9876543210)/.test(digits)) return "That number doesn't look real — please check it";
  if (dialCode && !e164.startsWith(dialCode)) {
    return `Number should start with your country code ${dialCode}`;
  }
  return "";
}
