const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelector(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.theme = root.dataset.theme; } catch {}
});

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function colour(line) {
  if (/^\s*#/.test(line)) return `<span class="c">${esc(line)}</span>`;
  return esc(line)
    .replace(/"((?:[^"\\]|\\.)*)"/g, '<span class="s">"$1"</span>')
    .replace(/-&gt;/g, '<span class="o">$&</span>')
    .replace(/\b(class|classes|shape|style|direction|near)(?=:)/g, '<span class="k">$1</span>');
}

async function story() {
  const steps = document.querySelector(".steps");
  const list = document.querySelector(".code ol");
  const frame = document.querySelector(".frame");
  const delta = document.querySelector(".delta");
  const data = await (await fetch("story/story.json")).json();
  const svgs = new Map();
  const svg = (url) => {
    if (!svgs.has(url)) svgs.set(url, fetch(url).then((r) => r.text()));
    return svgs.get(url);
  };
  data.forEach((s) => svg(s.svg));

  data.forEach((s, i) => {
    const el = document.createElement("article");
    el.className = "step";
    el.innerHTML = `<small>${String(i + 1).padStart(2, "0")}</small><h2>${s.title}</h2><p>${s.text}</p>`;
    steps.append(el);
  });
  const els = [...steps.children];

  const highlight = document.createElement("style");
  document.head.append(highlight);
  let shown = -1;

  async function show(i) {
    if (i === shown) return;
    shown = i;
    els.forEach((el, n) => el.classList.toggle("on", n === i));
    const s = data[i];

    const added = new Set(s.added);
    const removedAt = new Map();
    for (const r of s.removed) {
      if (!removedAt.has(r.at)) removedAt.set(r.at, []);
      removedAt.get(r.at).push(r.text);
    }
    const isEdge = s.selectText?.startsWith("(");
    const name = s.selectText && !isEdge ? s.selectText : null;
    const edge = isEdge ? s.selectText.slice(1, s.selectText.indexOf(")")) : null;
    let first = null;
    const items = [];
    s.code.forEach((line, n) => {
      for (const gone of removedAt.get(n) || []) items.push(`<li class="del">${esc(gone) || " "}</li>`);
      let cls = added.has(n) ? "add" : "";
      let html = colour(line) || " ";
      if (name && new RegExp(`\\b${name}\\b`).test(line)) {
        html = html.replace(new RegExp(`\\b${name}\\b`, "g"), "<mark>$&</mark>");
        if (!cls && line.startsWith(name + ":")) cls = "sel";
      }
      if (!cls && edge && line.startsWith(edge)) cls = "sel";
      if (cls && first === null) first = items.length;
      items.push(`<li class="${cls}">${html}</li>`);
    });
    for (const gone of removedAt.get(s.code.length) || []) items.push(`<li class="del">${esc(gone)}</li>`);
    list.innerHTML = items.join("");
    if (first !== null) {
      list.scrollTo({top: list.children[first].offsetTop - list.clientHeight / 3, behavior: still ? "auto" : "smooth"});
    }
    delta.innerHTML = s.added.length || s.removed.length
      ? `<span class="a">+${s.added.length}</span><span class="d">−${s.removed.length}</span>` : "";

    const markup = await svg(s.svg);
    if (shown !== i) return;
    frame.classList.add("out");
    await new Promise((r) => setTimeout(r, still ? 0 : 160));
    if (shown !== i) return;
    frame.innerHTML = markup;
    frame.classList.remove("out");
    const g = s.select && `.frame g.${CSS.escape(s.select)}`;
    highlight.textContent = g
      ? `${g} > g.shape > * { stroke: #7c5cc4 !important; stroke-width: 4px !important; }
         ${g} > path.connection { stroke: #7c5cc4 !important; stroke-width: 3.5px !important; }
         ${g} > text { fill: #5b3fa3 !important; }`
      : "";
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) show(els.indexOf(e.target));
    },
    {rootMargin: "-45% 0px -45% 0px"},
  );
  els.forEach((el) => io.observe(el));
  show(0);
}
story();

for (const video of document.querySelectorAll("video[data-src]")) {
  const base = video.dataset.src;
  video.poster = `${base}.jpg`;
  video.src = `${base}.mp4`;
  let held = false;
  video.addEventListener("click", () => {
    held = !video.paused;
    video.paused ? video.play() : video.pause();
  });
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        if (!still && !held) video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
    { threshold: [0, 0.6, 1] },
  ).observe(video);
}

fetch("https://api.github.com/repos/pltanton/d2-live")
  .then((r) => (r.ok ? r.json() : null))
  .then((repo) => {
    const n = repo?.stargazers_count;
    if (!n) return;
    const count = document.querySelector(".star .count");
    count.textContent = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n;
    count.hidden = false;
  })
  .catch(() => {});
