// Theme toggle island. CSS owns all motion; this only flips data-theme.
const KEY = "theme";

function current(): "light" | "dark" {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(t: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage may be unavailable; theme still applies for this session */
  }
}

document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement | null;
  const toggle = target?.closest("[data-theme-toggle]");
  if (!toggle) return;
  apply(current() === "dark" ? "light" : "dark");
});
