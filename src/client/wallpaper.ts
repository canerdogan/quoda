// QR Wallpaper island. Asks the server for an AI brand background + the real QR
// SVG, then composites them onto a phone-resolution canvas. The QR is drawn
// programmatically inside a clean white card (guaranteed quiet zone) so it always
// scans — the image model never draws the code itself.

interface WallpaperResponse {
  ok?: boolean;
  backgroundDataUrl?: string | null;
  aiBackground?: boolean;
  gradient?: { from: string; via: string; to: string };
  qrSvg?: string;
  layout?: { placement: "top" | "center" | "bottom"; qrFraction: number };
  title?: string;
  source?: string;
  error?: string;
}

const root = document;
const urlInput = root.getElementById("wp-url") as HTMLInputElement | null;
const genBtn = root.getElementById("wp-generate") as HTMLButtonElement | null;
const regenBtn = root.getElementById("wp-regen") as HTMLButtonElement | null;
const downloadBtn = root.getElementById("wp-download") as HTMLButtonElement | null;
const statusEl = root.getElementById("wp-status");
const actions = root.getElementById("wp-actions");
const canvas = root.getElementById("wp-canvas") as HTMLCanvasElement | null;
const empty = root.getElementById("wp-empty");

if (urlInput && genBtn && canvas) {
  let style = "mesh";
  let placement: "top" | "center" | "bottom" = "center";
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
  wireChips("data-wp-place", (v) => (placement = v as typeof placement));

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

  async function compose(data: WallpaperResponse) {
    const ctx = canvas!.getContext("2d")!;
    const W = canvas!.width;
    const H = canvas!.height;

    const qr = await loadImage(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.qrSvg!),
    );

    // background — AI image (cover) or a brand gradient fallback
    if (data.backgroundDataUrl) {
      const bg = await loadImage(data.backgroundDataUrl);
      const scale = Math.max(W / bg.width, H / bg.height);
      const bw = bg.width * scale,
        bh = bg.height * scale;
      ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    } else {
      const g = data.gradient ?? { from: "#063040", via: "#0A7EA4", to: "#3FB6D6" };
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, g.from);
      grad.addColorStop(0.55, g.via);
      grad.addColorStop(1, g.to);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // a soft radial glow for depth
      const glow = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.32, W * 0.9);
      glow.addColorStop(0, "rgba(255,255,255,0.16)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }

    // QR card
    const qrSize = Math.round((data.layout?.qrFraction ?? 0.46) * W);
    const pad = Math.round(qrSize * 0.09);
    const cardSize = qrSize + pad * 2;
    const cx = W / 2;
    const cyFrac = placement === "top" ? 0.3 : placement === "bottom" ? 0.7 : 0.5;
    const cy = Math.round(H * cyFrac);
    const cardX = cx - cardSize / 2;
    const cardY = cy - cardSize / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    roundRect(ctx, cardX, cardY, cardSize, cardSize, Math.round(cardSize * 0.085));
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    // QR (already dark-on-white + brand logo) inside the card
    ctx.drawImage(qr, cx - qrSize / 2, cy - qrSize / 2, qrSize, qrSize);

    // brand caption under the card
    const caption = data.source || "";
    if (caption) {
      ctx.save();
      ctx.font = `600 ${Math.round(W * 0.034)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 16;
      ctx.fillText(caption, cx, cardY + cardSize + Math.round(W * 0.07));
      ctx.restore();
    }

    empty?.setAttribute("hidden", "");
    canvas!.style.display = "block";
    actions?.removeAttribute("hidden");
  }

  async function generate() {
    const url = (urlInput!.value || "").trim();
    if (!url) {
      setStatus("Add a URL first.");
      return;
    }
    genBtn!.disabled = true;
    if (regenBtn) regenBtn.setAttribute("disabled", "");
    setStatus("Painting your wallpaper… this takes a few seconds.");
    try {
      const res = await fetch("/api/wallpaper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, style, placement }),
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
      const where = data.aiBackground === false ? " (brand gradient)" : "";
      setStatus(`Matched to ${data.title || data.source || "your site"}${where} — set it as your wallpaper.`);
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
