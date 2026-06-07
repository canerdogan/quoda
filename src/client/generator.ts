// Live-generator island for the marketing home page.
//
// Watches the URL input, debounces (~250ms), POSTs to /api/preview, and injects
// the returned SVG into the preview surface. Reveals the "Make it permanent"
// CTA once the input is non-empty. Fetch errors are surfaced visibly (the
// status region), never swallowed silently. Fully keyboard accessible — it only
// listens to the native input, so Tab/typing/Enter all work unchanged.

const DEBOUNCE_MS = 250;

const input = document.getElementById("gen-url") as HTMLInputElement | null;
const surface = document.getElementById("gen-preview-surface");
const cta = document.getElementById("gen-cta");
const statusEl = document.getElementById("gen-status");

// Only run when the generator markup is present on the page.
if (input && surface) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0; // guards against out-of-order responses

  const setStatus = (msg: string) => {
    if (statusEl) statusEl.textContent = msg;
  };

  const toggleCta = (visible: boolean) => {
    if (!cta) return;
    cta.toggleAttribute("hidden", !visible);
    cta.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  async function render(value: string) {
    const mySeq = ++seq;
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "url", fields: { url: value } }),
      });

      // A stale response (user kept typing) — ignore.
      if (mySeq !== seq) return;

      if (res.status === 429) {
        setStatus("Too many previews — give it a moment, then keep typing.");
        return;
      }
      if (!res.ok) {
        // 400 = incomplete/invalid input while typing; treat as "keep going"
        // rather than an error shout.
        setStatus("");
        return;
      }

      const data = (await res.json()) as { svg?: string };
      if (mySeq !== seq) return;
      if (data.svg) {
        surface!.innerHTML = data.svg;
        setStatus("Preview updated.");
      }
    } catch {
      if (mySeq !== seq) return;
      setStatus("Couldn't reach the generator. Check your connection.");
    }
  }

  const onInput = () => {
    const value = input!.value.trim();
    toggleCta(value.length > 0);

    if (timer) clearTimeout(timer);
    if (value.length === 0) {
      setStatus("");
      return;
    }
    timer = setTimeout(() => render(value), DEBOUNCE_MS);
  };

  input.addEventListener("input", onInput);

  // Reflect any value already present (e.g. browser autofill / back-nav).
  if (input.value.trim().length > 0) onInput();
}
