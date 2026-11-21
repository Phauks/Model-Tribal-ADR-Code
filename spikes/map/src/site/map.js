// Progressive enhancement. Without this script, each shaded state is a link to its table row
// and the browser shows the <title> as a tooltip. With it: a styled tooltip and a details panel.
const map = document.querySelector(".presence-map");
const tooltip = document.getElementById("map-tooltip");
const details = document.getElementById("state-details");

function describe(shape) {
  return shape.querySelector("title")?.textContent ?? "";
}

map.addEventListener("pointermove", (event) => {
  const shape = event.target.closest(".state");
  if (!shape) { tooltip.hidden = true; return; }
  tooltip.textContent = describe(shape);
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
  tooltip.hidden = false;
});
map.addEventListener("pointerleave", () => { tooltip.hidden = true; });

map.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  event.preventDefault();
  const code = link.getAttribute("href").replace("#state-", "");
  const row = document.getElementById(`state-${code}`);
  map.querySelectorAll(".is-active").forEach((shape) => shape.classList.remove("is-active"));
  link.querySelector(".state")?.classList.add("is-active");
  details.innerHTML = `<h2>${row.querySelector("th").textContent}</h2>${row.querySelector("ul").outerHTML}<p><a href="#state-${code}">Show in table</a></p>`;
  details.focus();
});

const toggle = document.getElementById("theme-toggle");
toggle.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  toggle.setAttribute("aria-pressed", String(dark));
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
