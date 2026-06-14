// QR Wallpaper island. Asks the server for an AI brand background + the real QR
// SVG + brand text, then composites a full branded poster onto a phone-resolution
// canvas: brand logo + wordmark on top, a glowing QR card (real scannable code)
// in the middle, and a tagline footer. The QR and ALL text are drawn
// programmatically (never AI-drawn) so the code always scans and the wordmark,
// subtitle and tagline are always spelled correctly.

interface WallpaperResponse {
  ok?: boolean;
  backgroundDataUrl?: string | null;
  aiBackground?: boolean;
  gradient?: { from: string; via: string; to: string };
  qrSvg?: string;
  title?: string;
  source?: string;
  target?: string;
  logo?: string;
  wordmark?: string;
  subtitle?: string;
  tagline?: string;
  glow?: string;
  error?: string;
}

const root = document;
const urlInput = root.getElementById("wp-url") as HTMLInputElement | null;
const brandInput = root.getElementById("wp-brand") as HTMLInputElement | null;
const genBtn = root.getElementById("wp-generate") as HTMLButtonElement | null;
const regenBtn = root.getElementById("wp-regen") as HTMLButtonElement | null;
const downloadBtn = root.getElementById("wp-download") as HTMLButtonElement | null;
const statusEl = root.getElementById("wp-status");
const actions = root.getElementById("wp-actions");
const canvas = root.getElementById("wp-canvas") as HTMLCanvasElement | null;
const empty = root.getElementById("wp-empty");

if (urlInput && genBtn && canvas) {
  let style = "mesh";
  let lastSource = "wallpaper";

  const setStatus = (m: string) => {
    if (statusEl) statusEl.textContent = m;
  };

  // chip selection
  const wireChips = (attr: string, set: (v: string) => void) => {
    root.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((chip) => {
      chip.addEventListener("click", () => {
        root.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((c) => {
          c.classList.remove("wp-chip-on");
          c.setAttribute("aria-pressed", "false");
        });
        chip.classList.add("wp-chip-on");
        chip.setAttribute("aria-pressed", "true");
        set(chip.getAttribute(attr)!);
      });
    });
  };
  wireChips("data-wp-style", (v) => (style = v));

  // --- small colour helpers (operate on #RRGGBB) ---
  const DEFAULT_GLOW = "#5B8CFF";
  function rgb(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = m ? parseInt(m[1], 16) : 0x5b8cff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexA(hex: string, a: number): string {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function lighten(hex: string, f: number): string {
    const [r, g, b] = rgb(hex);
    const L = (v: number) => Math.round(v + (255 - v) * (f - 1));
    return `rgb(${L(r)},${L(g)},${L(b)})`;
  }
  function lerp(a: string, b: string, t: number): string {
    const A = rgb(a),
      B = rgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  /**
   * The dominant VIVID colour of the brand logo (the data URL is same-origin, so
   * no canvas taint). This makes the glow/accent match the logo itself (e.g. an
   * orange play-mark → orange glow), not just the site's theme-color. null if the
   * logo is essentially greyscale.
   */
  function dominantGlow(img: HTMLImageElement): string | null {
    try {
      const s = 44;
      const oc = document.createElement("canvas");
      oc.width = s;
      oc.height = s;
      const octx = oc.getContext("2d");
      if (!octx) return null;
      octx.drawImage(img, 0, 0, s, s);
      const d = octx.getImageData(0, 0, s, s).data;
      let r = 0,
        g = 0,
        b = 0,
        wsum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i],
          G = d[i + 1],
          B = d[i + 2];
        if (d[i + 3] < 128) continue;
        const max = Math.max(R, G, B),
          min = Math.min(R, G, B);
        const sat = max === 0 ? 0 : (max - min) / max;
        if (sat < 0.35 || max < 50 || max > 245) continue; // skip grey / near-black / near-white
        const w = sat * (1 - Math.abs(max - 175) / 175); // favour vivid, mid-bright
        r += R * w;
        g += G * w;
        b += B * w;
        wsum += w;
      }
      if (wsum <= 0) return null;
      const hx = (v: number) => Math.round(v / wsum).toString(16).padStart(2, "0");
      return `#${hx(r)}${hx(g)}${hx(b)}`;
    } catch {
      return null;
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function ensureFonts() {
    try {
      const f = (document as Document & { fonts?: FontFaceSet }).fonts;
      if (!f) return;
      await Promise.all([
        f.load("800 64px Inter"),
        f.load("600 22px Inter"),
        f.load("800 30px Inter"),
      ]);
      await f.ready;
    } catch {
      /* fall back to system fonts */
    }
  }

  type Ctx = CanvasRenderingContext2D;

  function paintBackground(ctx: Ctx, W: number, H: number, data: WallpaperResponse, glow: string) {
    return (async () => {
      if (data.backgroundDataUrl) {
        const bg = await loadImage(data.backgroundDataUrl);
        const scale = Math.max(W / bg.width, H / bg.height);
        const bw = bg.width * scale,
          bh = bg.height * scale;
        ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
      } else {
        const g = data.gradient ?? { from: "#0d0d12", via: "#1a2740", to: "#070709" };
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, g.from);
        grad.addColorStop(0.5, g.via);
        grad.addColorStop(1, g.to);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        const rg = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, W * 0.95);
        rg.addColorStop(0, hexA(glow, 0.22));
        rg.addColorStop(1, hexA(glow, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
      // Keep it a dark, legible poster even over a bright AI background.
      ctx.fillStyle = "rgba(6,6,9,0.16)";
      ctx.fillRect(0, 0, W, H);
      const top = ctx.createLinearGradient(0, 0, 0, H * 0.36);
      top.addColorStop(0, "rgba(6,6,9,0.74)");
      top.addColorStop(1, "rgba(6,6,9,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, H * 0.36);
      const bot = ctx.createLinearGradient(0, H * 0.6, 0, H);
      bot.addColorStop(0, "rgba(6,6,9,0)");
      bot.addColorStop(1, "rgba(6,6,9,0.8)");
      ctx.fillStyle = bot;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);
    })();
  }

  function drawWordmark(ctx: Ctx, W: number, midY: number, data: WallpaperResponse, logoImg: HTMLImageElement | null) {
    const wm = data.wordmark || data.source || "";
    if (!wm) return;
    const fs = Math.round(W * 0.062);
    ctx.save();
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "-1px";
    const textW = ctx.measureText(wm).width;
    let logoW = 0;
    let logoH = 0;
    let gap = 0;
    if (logoImg) {
      logoH = Math.round(fs * 1.08);
      logoW = (logoImg.width / logoImg.height) * logoH;
      if (!isFinite(logoW) || logoW <= 0) logoW = logoH;
      gap = Math.round(fs * 0.26);
    }
    const totalW = (logoImg ? logoW + gap : 0) + textW;
    let x = (W - totalW) / 2;
    if (logoImg) {
      ctx.drawImage(logoImg, x, midY - logoH / 2, logoW, logoH);
      x += logoW + gap;
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 18;
    ctx.fillText(wm, x, midY);
    ctx.restore();
  }

  function drawSubtitle(ctx: Ctx, W: number, y: number, text: string) {
    ctx.save();
    const fs = Math.round(W * 0.0205);
    const ls = Math.round(fs * 0.32);
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${ls}px`;
    ctx.fillText(text.toUpperCase(), W / 2 + ls / 2, y);
    ctx.restore();
  }

  function drawDivider(ctx: Ctx, cx: number, y: number, width: number, glow: string) {
    ctx.save();
    const half = width / 2;
    const grad = ctx.createLinearGradient(cx - half, y, cx + half, y);
    grad.addColorStop(0, hexA(glow, 0));
    grad.addColorStop(0.5, hexA(glow, 0.55));
    grad.addColorStop(1, hexA(glow, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGlowCard(ctx: Ctx, cx: number, cy: number, size: number, glow: string) {
    const x = cx - size / 2;
    const y = cy - size / 2;
    const r = Math.round(size * 0.085);
    // glowing brand-coloured ring
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 55;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 6;
    roundRect(ctx, x, y, size, size, r);
    ctx.stroke();
    ctx.stroke();
    ctx.restore();
    // white card (the QR's quiet zone — guarantees a clean scan)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRect(ctx, x, y, size, size, r);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();
  }

  function drawTagline(ctx: Ctx, W: number, y: number, tagline: string, glow: string) {
    const words = tagline.split(/\s*[·.|]\s*/).filter(Boolean);
    if (!words.length) return;
    ctx.save();
    const fs = Math.round(W * 0.0265);
    ctx.font = `800 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.letterSpacing = `${Math.round(fs * 0.1)}px`;
    const sep = "   ·   ";
    const sepW = ctx.measureText(sep).width;
    const wordW = words.map((w) => ctx.measureText(w).width);
    const total = wordW.reduce((a, b) => a + b, 0) + sepW * (words.length - 1);
    let x = (W - total) / 2;
    const light = lighten(glow, 1.4);
    for (let i = 0; i < words.length; i++) {
      const t = words.length > 1 ? i / (words.length - 1) : 0;
      ctx.fillStyle = lerp(glow, light, t);
      ctx.shadowColor = hexA(glow, 0.5);
      ctx.shadowBlur = 12;
      ctx.fillText(words[i], x, y);
      x += wordW[i];
      if (i < words.length - 1) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = hexA(glow, 0.4);
        ctx.fillText(sep, x, y);
        x += sepW;
      }
    }
    ctx.restore();
  }

  async function compose(data: WallpaperResponse) {
    const ctx = canvas!.getContext("2d")!;
    const W = canvas!.width;
    const H = canvas!.height;
    const cx = W / 2;

    await ensureFonts();
    ctx.clearRect(0, 0, W, H);

    const qr = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.qrSvg!));
    let logoImg: HTMLImageElement | null = null;
    if (data.logo) {
      try {
        logoImg = await loadImage(data.logo);
      } catch {
        logoImg = null;
      }
    }
    // Glow/accent: prefer the logo's own vivid colour, then the server glow.
    const glow = (logoImg && dominantGlow(logoImg)) || data.glow || DEFAULT_GLOW;

    await paintBackground(ctx, W, H, data, glow);

    // Top brand block
    drawWordmark(ctx, W, Math.round(H * 0.16), data, logoImg);
    if (data.subtitle) drawSubtitle(ctx, W, Math.round(H * 0.205), data.subtitle);
    drawDivider(ctx, cx, Math.round(H * 0.245), Math.round(W * 0.3), glow);

    // QR card
    const qrSize = Math.round(W * 0.46);
    const pad = Math.round(qrSize * 0.11);
    const cardSize = qrSize + pad * 2;
    const cy = Math.round(H * 0.52);
    drawGlowCard(ctx, cx, cy, cardSize, glow);
    ctx.drawImage(qr, cx - qrSize / 2, cy - qrSize / 2, qrSize, qrSize);

    // Footer tagline
    if (data.tagline) {
      drawDivider(ctx, cx, Math.round(H * 0.79), Math.round(W * 0.3), glow);
      drawTagline(ctx, W, Math.round(H * 0.835), data.tagline, glow);
    }

    empty?.setAttribute("hidden", "");
    canvas!.style.display = "block";
    actions?.removeAttribute("hidden");
  }

  async function generate() {
    const url = (urlInput!.value || "").trim();
    if (!url) {
      setStatus("Add a destination URL first.");
      return;
    }
    const brandUrl = (brandInput?.value || "").trim();
    genBtn!.disabled = true;
    if (regenBtn) regenBtn.setAttribute("disabled", "");
    setStatus("Designing your poster… this takes a few seconds.");
    try {
      const res = await fetch("/api/wallpaper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, brandUrl, style }),
      });
      if (res.status === 429) {
        setStatus("Busy right now — give it a moment, then try again.");
        return;
      }
      const data = (await res.json()) as WallpaperResponse;
      if (!res.ok || !data.ok || !data.qrSvg) {
        setStatus("Couldn't generate that wallpaper — try another URL or style.");
        return;
      }
      lastSource = data.source || "wallpaper";
      await compose(data);
      const themed = data.wordmark || data.title || data.source || "your site";
      const where = data.aiBackground === false ? " (brand gradient)" : "";
      const decoupled = data.target && data.source && data.target !== data.source;
      const opens = decoupled ? ` Code opens ${data.target}.` : "";
      setStatus(`Styled like ${themed}${where}.${opens} Set it as your wallpaper.`);
    } catch {
      setStatus("Couldn't reach the wallpaper service. Check your connection.");
    } finally {
      genBtn!.disabled = false;
      if (regenBtn) regenBtn.removeAttribute("disabled");
    }
  }

  genBtn.addEventListener("click", generate);
  regenBtn?.addEventListener("click", generate);

  downloadBtn?.addEventListener("click", () => {
    canvas!.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${lastSource}-quoda-wallpaper.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  });
}
