const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelector(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.theme = root.dataset.theme; } catch {}
});

const carousel = document.querySelector(".carousel");
const dots = [...carousel.querySelectorAll(".dots button")];
const videos = [...carousel.querySelectorAll("video")];
const captions = [...carousel.querySelectorAll(".captions p")];
const bar = carousel.querySelector(".progress i");
let current = 0;
let seen = false;
let held = false;

for (const v of videos) {
  v.poster = `${v.dataset.src}.jpg`;
  v.src = `${v.dataset.src}.mp4`;
}

function select(i, play) {
  current = i;
  bar.style.width = "0%";
  videos[i].currentTime = 0;
  [dots, videos, captions].forEach((list) => list.forEach((el, n) => el.classList.toggle("on", n === i)));
  videos.forEach((v, n) => n !== i && setTimeout(() => v.pause(), 520));
  if (play && !still) videos[i].play().catch(() => {});
}

(function tick() {
  const v = videos[current];
  if (v.duration) bar.style.width = `${(v.currentTime / v.duration) * 100}%`;
  requestAnimationFrame(tick);
})();

videos.forEach((v, i) => {
  v.addEventListener("ended", () => {
    if (seen && !held && i === current) select((i + 1) % videos.length, true);
  });
  v.addEventListener("click", () => {
    held = !v.paused;
    v.paused ? v.play() : v.pause();
  });
});
dots.forEach((d, i) => d.addEventListener("click", () => {
  held = false;
  select(i, true);
}));
new IntersectionObserver(([e]) => {
  seen = e.isIntersecting && e.intersectionRatio >= 0.5;
  if (seen && !held && !still) videos[current].play().catch(() => {});
  else videos[current].pause();
}, {threshold: [0, 0.5, 1]}).observe(carousel);

const seg = [...document.querySelectorAll(".seg button")];
const panes = [...document.querySelectorAll(".pane")];
seg.forEach((b) => b.addEventListener("click", () => {
  seg.forEach((x) => x.classList.toggle("on", x === b));
  panes.forEach((p) => p.classList.toggle("on", p.dataset.pane === b.dataset.tab));
}));

const copyIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.2V3a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.3"/></svg>';
const doneIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>';
for (const pre of document.querySelectorAll(".card pre")) {
  const b = document.createElement("button");
  b.className = "copy";
  b.type = "button";
  b.title = "Copy";
  b.innerHTML = copyIcon;
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector("code").textContent.replace(/^#.*\n/gm, ""));
      b.innerHTML = doneIcon;
      setTimeout(() => (b.innerHTML = copyIcon), 1400);
    } catch {}
  });
  pre.append(b);
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
