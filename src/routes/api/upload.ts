import { Hono } from "hono";
import type { AppEnv } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth";
import { getLimits } from "../../lib/plans";

export const uploadApi = new Hono<AppEnv>();

// The asset stream route is public (logos are embedded in shareable QR images);
// only the upload itself requires auth.
uploadApi.use("/api/upload", requireAuth);

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

const MAX_BYTES = 1_000_000; // 1MB — a logo, not a hero image.

interface Base64Body {
  /** data URI or bare base64 */
  data?: string;
  contentType?: string;
}

// ---------------------------------------------------------------------------
// POST /api/upload — store a logo image in R2 (multipart or base64 JSON)
// ---------------------------------------------------------------------------

uploadApi.post("/api/upload", async (c) => {
  const user = c.get("user")!;

  if (!getLimits(user.plan_id).logoUpload) {
    return c.json(
      { ok: false, error: "Logo upload isn't available on your plan.", code: "plan_limit" },
      402,
    );
  }

  const reqType = c.req.header("content-type") ?? "";
  let bytes: Uint8Array;
  let contentType: string;

  try {
    if (reqType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file") ?? form.get("logo");
      // formData entries are `string | File`; a File is a Blob with `type` +
      // `arrayBuffer`. workers-types doesn't expose the File global, so narrow
      // structurally rather than via instanceof.
      if (!isBlobLike(file)) {
        return c.json({ ok: false, error: "No file provided." }, 400);
      }
      contentType = file.type || "application/octet-stream";
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await c.req.json<Base64Body>();
      const parsed = decodeDataUri(body.data ?? "", body.contentType);
      if (!parsed) {
        return c.json({ ok: false, error: "No image data provided." }, 400);
      }
      contentType = parsed.contentType;
      bytes = parsed.bytes;
    }
  } catch {
    return c.json({ ok: false, error: "Could not read the uploaded image." }, 400);
  }

  if (!ALLOWED_TYPES.has(contentType)) {
    return c.json({ ok: false, error: "Unsupported image type. Use PNG, JPG, WebP, GIF or SVG." }, 415);
  }
  if (bytes.byteLength === 0) {
    return c.json({ ok: false, error: "The image is empty." }, 400);
  }
  if (bytes.byteLength > MAX_BYTES) {
    return c.json({ ok: false, error: "Logo must be 1MB or smaller." }, 413);
  }

  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  const key = `logos/${user.id}/${crypto.randomUUID()}.${ext}`;

  await c.env.ASSETS_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  });

  return c.json({ ok: true, key, url: `/assets/${key}` }, 201);
});

// ---------------------------------------------------------------------------
// GET /assets/:key{.+} — stream an asset from R2 (standalone fallback)
// ---------------------------------------------------------------------------

uploadApi.get("/assets/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.ASSETS_BUCKET.get(key);
  if (!obj) {
    return c.text("Not Found", 404);
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(obj.body, { headers });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BlobLike {
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Structurally detect a File/Blob form entry (workers-types omits the File global). */
function isBlobLike(value: unknown): value is BlobLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

/** Decode a data URI (or bare base64 + explicit type) into bytes + content type. */
function decodeDataUri(
  data: string,
  explicitType?: string,
): { bytes: Uint8Array; contentType: string } | null {
  if (!data) return null;
  let b64 = data;
  let contentType = explicitType ?? "application/octet-stream";

  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(data);
  if (match) {
    contentType = match[1] || contentType;
    b64 = match[3] ?? "";
    if (!match[2]) {
      // Non-base64 data URI (URL-encoded text, e.g. inline SVG).
      const text = decodeURIComponent(b64);
      return { bytes: new TextEncoder().encode(text), contentType };
    }
  }

  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return { bytes: out, contentType };
  } catch {
    return null;
  }
}
