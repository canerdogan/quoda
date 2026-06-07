import type { QrType } from "../../types";
import type { QrFields } from "./types";

/**
 * Build the canonical QR payload string for a given content type.
 *
 * Each branch produces the exact textual encoding a scanner expects so that
 * scanning the rendered code triggers the intended native action (open URL,
 * join Wi-Fi, dial, add contact, etc.).
 *
 * For "rich"/dynamic types (pdf, menu, business, appstore, social) the real
 * payload is the short `/r/<code>` redirect URL assembled by the backend, so
 * we simply return `fields.url` when present.
 */
export function buildPayload(type: QrType, fields: QrFields): string {
  switch (type) {
    case "url":
      return buildUrl(fields);
    case "text":
      return buildText(fields);
    case "wifi":
      return buildWifi(fields);
    case "email":
      return buildEmail(fields);
    case "tel":
      return buildTel(fields);
    case "sms":
      return buildSms(fields);
    case "vcard":
      return buildVcard(fields);
    case "pdf":
    case "menu":
    case "business":
    case "appstore":
    case "social":
      return buildDynamic(fields);
    default:
      throw new Error(`buildPayload: unsupported QR type "${String(type)}"`);
  }
}

// --- URL --------------------------------------------------------------------

function buildUrl(fields: QrFields): string {
  const raw = (fields.url ?? "").trim();
  if (!raw) throw new Error("buildPayload(url): 'url' field is required");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^mailto:/i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

// --- Text -------------------------------------------------------------------

function buildText(fields: QrFields): string {
  const text = fields.text;
  if (text == null || text.length === 0) {
    throw new Error("buildPayload(text): 'text' field is required");
  }
  return text;
}

// --- Wi-Fi ------------------------------------------------------------------

/**
 * Escape a value for the WIFI: scheme. Per the de-facto spec, the characters
 * `\ ; , : "` must be backslash-escaped.
 */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function buildWifi(fields: QrFields): string {
  const ssid = fields.ssid;
  if (ssid == null || ssid.length === 0) {
    throw new Error("buildPayload(wifi): 'ssid' field is required");
  }
  const auth = (fields.auth ?? "WPA").trim() || "WPA";
  const password = fields.password ?? "";
  const hidden = fields.hidden === "true" ? "true" : "false";
  return (
    `WIFI:T:${escapeWifi(auth)};` +
    `S:${escapeWifi(ssid)};` +
    `P:${escapeWifi(password)};` +
    `H:${hidden};;`
  );
}

// --- Email ------------------------------------------------------------------

function buildEmail(fields: QrFields): string {
  const email = (fields.email ?? "").trim();
  if (!email) throw new Error("buildPayload(email): 'email' field is required");
  // Encode the address path so a stray ?/&/# can't corrupt query parsing,
  // while keeping @ and . readable (encodeURIComponent escapes neither anyway).
  const addr = encodeURIComponent(email).replace(/%40/g, "@");
  const params: string[] = [];
  if (fields.subject) params.push(`subject=${encodeURIComponent(fields.subject)}`);
  if (fields.body) params.push(`body=${encodeURIComponent(fields.body)}`);
  return params.length ? `mailto:${addr}?${params.join("&")}` : `mailto:${addr}`;
}

// --- Telephone --------------------------------------------------------------

/** Keep a single leading "+" and strip all other non-digit characters. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function buildTel(fields: QrFields): string {
  const phone = fields.phone ?? "";
  const normalized = normalizePhone(phone);
  if (!normalized || normalized === "+") {
    throw new Error("buildPayload(tel): 'phone' field is required");
  }
  return `tel:${normalized}`;
}

// --- SMS --------------------------------------------------------------------

function buildSms(fields: QrFields): string {
  const phone = fields.phone ?? "";
  const normalized = normalizePhone(phone);
  if (!normalized || normalized === "+") {
    throw new Error("buildPayload(sms): 'phone' field is required");
  }
  const message = fields.message ?? "";
  return `SMSTO:${normalized}:${message}`;
}

// --- vCard ------------------------------------------------------------------

/** Escape a value for vCard 3.0 text fields (RFC 6350 / 2426 escaping). */
function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function buildVcard(fields: QrFields): string {
  const first = (fields.firstName ?? "").trim();
  const last = (fields.lastName ?? "").trim();
  if (!first && !last) {
    throw new Error(
      "buildPayload(vcard): at least one of 'firstName'/'lastName' is required"
    );
  }

  const fn = [first, last].filter(Boolean).join(" ");
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${escapeVcard(last)};${escapeVcard(first)};;;`);
  lines.push(`FN:${escapeVcard(fn)}`);
  if (fields.org) lines.push(`ORG:${escapeVcard(fields.org)}`);
  if (fields.title) lines.push(`TITLE:${escapeVcard(fields.title)}`);
  if (fields.phone) lines.push(`TEL:${escapeVcard(fields.phone)}`);
  if (fields.email) lines.push(`EMAIL:${escapeVcard(fields.email)}`);
  if (fields.url) lines.push(`URL:${escapeVcard(fields.url)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// --- Dynamic / rich types ---------------------------------------------------

function buildDynamic(fields: QrFields): string {
  const url = (fields.url ?? "").trim();
  if (!url) {
    throw new Error(
      "buildPayload: dynamic QR types require a resolved 'url' (the /r/<code> redirect)"
    );
  }
  return url;
}
