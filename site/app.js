const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelector(".theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.theme = root.dataset.theme; } catch {}
});

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
