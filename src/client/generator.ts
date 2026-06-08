// Live-generator island for the marketing home page.
//
// Watches the URL input, debounces (~250ms), POSTs to /api/preview, and injects
// the returned SVG into the preview surface. Reveals the "Make it permanent" CTA
// and the "Brand it with AI" action once the input is non-empty. Brand Match
// calls /api/brand (Workers AI) and drops the on-brand, scannable code straight
// into the preview. Fetch errors are surfaced visibly, never swallowed. Fully
// keyboard accessible — it only listens to native input/click events.

const DEBOUNCE_MS = 250;

const input = document.getElementById("gen-url") as HTMLInputElement | null;
const surface = document.getElementById("gen-preview-surface");
const cta = document.getElementById("gen-cta");
const statusEl = document.getElementById("gen-status");
const brandWrap = document.getElementById("gen-brand-wrap");
const brandBtn = document.getElementById("gen-brand") as HTMLButtonElement | null;
const brandNote = document.getElementById("gen-brand-note");

if (input && surface) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0; // guards against out-of-order responses
  let branded = false; // once branded, don't let plain-preview overwrite it

  const setStatus = (msg: string) => {
    if (statusEl) statusEl.textContent = msg;
  };
  const setBrandNote = (msg: string) => {
    if (brandNote) brandNote.textContent = msg;
  };
  const toggle = (el: Element | null, visible: boolean) => {
    if (!el) return;
    el.toggleAttribute("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  async function render(value: string) {
    const mySeq = ++seq;
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "url", fields: { url: value } }),
      });
      if (mySeq !== seq || branded) return;
      if (res.status === 429) {
        setStatus("Too many previews — give it a moment, then keep typing.");
        return;
      }
      if (!res.ok) {
        setStatus("");
        return;
      }
      const data = (await res.json()) as { svg?: string };
      if (mySeq !== seq || branded) return;
      if (data.svg) {
        surface!.innerHTML = data.svg;
        setStatus("Preview updated.");
      }
    } catch {
      if (mySeq !== seq) return;
      setStatus("Couldn't reach the generator. Check your connection.");
    }
  }

  async function brandIt() {
    const value = input!.value.trim();
    if (!value || !brandBtn) return;
    brandBtn.disabled = true;
    setBrandNote("Matching your brand…");
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      if (res.status === 429) {
        setBrandNote("Hang on a moment, then try Brand it again.");
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        svg?: string;
        title?: string;
        source?: string;
      };
      if (!res.ok || !data.ok || !data.svg) {
        setBrandNote("Couldn't read that site's brand — your code is unchanged.");
        return;
      }
      branded = true; // lock the branded result against keystroke re-renders
      surface!.innerHTML = data.svg;
      setStatus("");
      setBrandNote(`Matched to ${data.title || data.source || "your site"}.`);
    } catch {
      setBrandNote("Couldn't reach Brand Match. Check your connection.");
    } finally {
      brandBtn.disabled = false;
    }
  }

  const onInput = () => {
    const value = input!.value.trim();
    branded = false; // editing the URL returns to the live plain preview
    setBrandNote("");
    toggle(cta, value.length > 0);
    toggle(brandWrap, value.length > 0);
    if (timer) clearTimeout(timer);
    if (value.length === 0) {
      setStatus("");
      return;
    }
    timer = setTimeout(() => render(value), DEBOUNCE_MS);
  };

  input.addEventListener("input", onInput);
  brandBtn?.addEventListener("click", brandIt);

  if (input.value.trim().length > 0) onInput();
}
