/* Original, local-only visual enhancement. No network, storage, or tracking. */
(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 760px)");
  const canvas = document.querySelector(".ambient-canvas");
  const context = canvas && canvas.getContext("2d", { alpha: true });
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  let observer;
  let frame = 0;
  let lastDraw = 0;
  let width = 0;
  let height = 0;
  let points = [];
  const pointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };

  function stopCanvas() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (context) context.clearRect(0, 0, width, height);
  }

  function resizeCanvas() {
    if (!context || !canvas) return;
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(34, Math.max(18, Math.floor(width / 44)));
    points = Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963229728653;
      const fraction = (index * 0.61803398875) % 1;
      return {
        x: (0.12 + 0.76 * fraction) * width,
        y: (0.12 + 0.76 * ((index * 0.41421356237) % 1)) * height,
        phase: angle,
        radius: 1 + (index % 3) * 0.42
      };
    });
  }

  function draw(time) {
    frame = 0;
    if (reduced.matches || compact.matches || document.hidden || !context) return;
    if (time - lastDraw < 33) {
      frame = window.requestAnimationFrame(draw);
      return;
    }
    lastDraw = time;
    pointer.x += (pointer.targetX - pointer.x) * 0.035;
    pointer.y += (pointer.targetY - pointer.y) * 0.035;
    context.clearRect(0, 0, width, height);

    if (pointer.x >= 0 && pointer.y >= 0) {
      const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 190);
      glow.addColorStop(0, "rgba(77, 171, 199, 0.09)");
      glow.addColorStop(1, "rgba(77, 171, 199, 0)");
      context.fillStyle = glow;
      context.fillRect(pointer.x - 190, pointer.y - 190, 380, 380);
    }

    const drift = time * 0.00022;
    for (const point of points) {
      let x = point.x + Math.sin(drift + point.phase) * 9;
      let y = point.y + Math.cos(drift * 0.78 + point.phase) * 7;
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < 170) {
        const influence = (1 - distance / 170) * 8;
        x += (dx / distance) * influence;
        y += (dy / distance) * influence;
      }
      context.beginPath();
      context.arc(x, y, point.radius, 0, Math.PI * 2);
      context.fillStyle = "rgba(147, 219, 230, 0.5)";
      context.fill();
    }
    frame = window.requestAnimationFrame(draw);
  }

  function startCanvas() {
    if (!context || frame || reduced.matches || compact.matches || document.hidden) return;
    resizeCanvas();
    lastDraw = 0;
    frame = window.requestAnimationFrame(draw);
  }

  function revealContent() {
    if (observer) observer.disconnect();
    observer = undefined;
    if (reduced.matches || !("IntersectionObserver" in window)) {
      document.body.classList.remove("motion-ready");
      for (const item of reveals) item.classList.add("is-visible");
      return;
    }
    document.body.classList.add("motion-ready");
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px 32px 0px" });
    for (const item of reveals) observer.observe(item);
  }

  function updateMotion() {
    if (reduced.matches || compact.matches) stopCanvas();
    else startCanvas();
    revealContent();
  }

  window.addEventListener("pointermove", (event) => {
    if (reduced.matches || compact.matches) return;
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
  }, { passive: true });
  window.addEventListener("pointerleave", () => {
    pointer.targetX = -1000;
    pointer.targetY = -1000;
  });
  window.addEventListener("resize", () => {
    if (!reduced.matches && !compact.matches && !document.hidden) resizeCanvas();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCanvas();
    else startCanvas();
  });
  reduced.addEventListener("change", updateMotion);
  compact.addEventListener("change", updateMotion);

  document.addEventListener("click", (event) => {
    if (reduced.matches || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    if ((link.getAttribute("href") || "").startsWith("#")) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.protocol === "mailto:" || destination.origin !== window.location.origin || !destination.pathname.endsWith(".html")) return;
    if (destination.href === window.location.href) return;
    event.preventDefault();
    document.body.classList.add("page-exit");
    window.setTimeout(() => { window.location.href = destination.href; }, 180);
  });

  updateMotion();
})();
