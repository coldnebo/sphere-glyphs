// Reveal spreads as they arrive, mark the current chapter, and track reading progress.

const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in-view");
      reveal.unobserve(e.target);
    }
  },
  { threshold: 0.18 },
);
document.querySelectorAll(".spread, .cover-art, .cover-words").forEach((el) => reveal.observe(el));

const links = new Map([...document.querySelectorAll(".chapters a")].map((a) => [a.hash.slice(1), a]));
const current = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.remove("current"));
      links.get(e.target.id)?.classList.add("current");
    }
  },
  { rootMargin: "-45% 0px -45% 0px" },
);
document.querySelectorAll(".spread").forEach((s) => current.observe(s));

const bar = document.querySelector(".progress span");
const progress = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.width = `${max > 0 ? (100 * scrollY) / max : 0}%`;
};
addEventListener("scroll", progress, { passive: true });
progress();
