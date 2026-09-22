(() => {
  "use strict";

  const canvas = document.querySelector("[data-signal-field]");
  const toggle = document.querySelector("[data-motion-toggle]");
  const label = toggle?.querySelector("[data-motion-label]");

  if (!(canvas instanceof HTMLCanvasElement) || !(toggle instanceof HTMLButtonElement) || !label) {
    return;
  }

  const root = document.documentElement;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const colors = ["rgba(91, 139, 255, 0.24)", "rgba(110, 231, 216, 0.18)", "rgba(120, 169, 255, 0.15)"];
  const pointer = { x: 0.72, y: 0.24, targetX: 0.72, targetY: 0.24 };
  let context = null;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let frameInterval = 1000 / 30;
  let frameRequest = 0;
  let lastPaint = 0;
  let motionClock = 0;
  let motionFramesRemaining = 0;
  let frameCount = 0;
  let userPaused = motionQuery.matches;
  let pointerAttached = false;
  let resizeQueued = false;
  let revealObserver = null;
  let signals = [];
  let glows = [];

  function detachPointer() {
    if (pointerAttached) {
      document.removeEventListener("pointermove", handlePointer);
      pointerAttached = false;
    }
  }

  const failOpen = () => {
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
    detachPointer();
    revealObserver?.disconnect();
    canvas.hidden = true;
    toggle.hidden = true;
    root.classList.remove("runtime-ready", "motion-paused", "motion-reduced");
  };

  const safe = (operation) => (...argumentsList) => {
    try {
      operation(...argumentsList);
    } catch {
      failOpen();
    }
  };

  const buildSignals = () => {
    const count = Math.max(4, Math.min(8, Math.round(width / 190)));
    signals = Array.from({ length: count }, (_, index) => ({
      anchorX: (index + 1) / (count + 1),
      anchorY: 0.16 + ((index * 37) % 64) / 100,
      amplitude: 0.014 + (index % 3) * 0.007,
      phase: index * 0.83,
      speed: 0.0017 + (index % 4) * 0.00022,
      tone: index % 3,
    }));
  };

  const buildGlows = () => {
    const minimum = Math.min(width, height);
    const settings = [
      [width * 0.2, height * 0.24, minimum * 0.44, "rgba(76, 108, 215, 0.11)"],
      [width * 0.82, height * 0.7, minimum * 0.4, "rgba(47, 151, 145, 0.08)"],
      [width * 0.72, height * 0.16, minimum * 0.3, "rgba(66, 91, 179, 0.08)"],
    ];
    glows = settings.map(([x, y, radius, color]) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(7, 11, 20, 0)");
      return { x, y, radius, gradient };
    });
  };

  const drawField = (still = false) => {
    context.clearRect(0, 0, width, height);
    const easing = still ? 1 : 0.11;
    pointer.x += (pointer.targetX - pointer.x) * easing;
    pointer.y += (pointer.targetY - pointer.y) * easing;
    context.save();
    context.globalCompositeOperation = "screen";
    for (const glow of glows) {
      context.fillStyle = glow.gradient;
      context.fillRect(glow.x - glow.radius, glow.y - glow.radius, glow.radius * 2, glow.radius * 2);
    }
    const pointerShiftX = (pointer.x - 0.5) * 40;
    const pointerShiftY = (pointer.y - 0.5) * 24;
    for (const signal of signals) {
      const wave = still ? 0 : Math.sin(motionClock * signal.speed + signal.phase) * signal.amplitude;
      const x = signal.anchorX * width + wave * width + pointerShiftX;
      const y = signal.anchorY * height - wave * height * 1.4 + pointerShiftY;
      const reach = Math.max(width, height) * (0.2 + signal.tone * 0.028);
      context.beginPath();
      context.moveTo(x - reach, y + reach * 0.34);
      context.bezierCurveTo(
        x - reach * 0.42,
        y - reach * 0.5,
        x + reach * 0.36,
        y + reach * 0.46,
        x + reach,
        y - reach * 0.26,
      );
      context.strokeStyle = colors[signal.tone];
      context.lineWidth = 0.7 + signal.tone * 0.24;
      context.stroke();
    }
    const pointerX = pointer.x * width;
    const pointerY = pointer.y * height;
    context.strokeStyle = "rgba(110, 231, 216, 0.12)";
    context.lineWidth = 0.75;
    context.beginPath();
    context.arc(pointerX, pointerY, Math.min(width, height) * 0.11, -0.7, 2.1);
    context.stroke();
    context.restore();
    frameCount += 1;
    canvas.dataset.frameCount = String(frameCount);
  };

  const animate = (timestamp) => {
    try {
      if (userPaused || document.hidden || motionFramesRemaining <= 0) {
        frameRequest = 0;
        pointer.x = pointer.targetX;
        pointer.y = pointer.targetY;
        drawField(true);
        canvas.dataset.motionState = userPaused ? "paused" : "idle";
        return;
      }
      frameRequest = window.requestAnimationFrame(animate);
      if (timestamp - lastPaint < frameInterval) {
        return;
      }
      const delta = Math.min(50, lastPaint ? timestamp - lastPaint : frameInterval);
      lastPaint = timestamp;
      motionClock += delta;
      motionFramesRemaining -= 1;
      drawField(false);
    } catch {
      failOpen();
    }
  };

  const wake = (frames = 18) => {
    if (userPaused || document.hidden) {
      return;
    }
    motionFramesRemaining = Math.max(motionFramesRemaining, frames);
    canvas.dataset.motionState = "running";
    if (!frameRequest) {
      lastPaint = 0;
      frameRequest = window.requestAnimationFrame(animate);
    }
  };

  const stopLoop = () => {
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
    motionFramesRemaining = 0;
  };

  const resizeCanvas = () => {
    resizeQueued = false;
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    frameInterval = 1000 / (width < 600 ? 24 : 30);
    const requestedRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    const pixelLimitRatio = Math.sqrt(2000000 / Math.max(1, width * height));
    pixelRatio = Math.max(0.65, Math.min(requestedRatio, pixelLimitRatio));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    canvas.dataset.pixelRatio = pixelRatio.toFixed(2);
    canvas.dataset.backingPixels = String(canvas.width * canvas.height);
    buildSignals();
    buildGlows();
    drawField(true);
    wake(width < 600 ? 14 : 18);
  };

  function handlePointer(event) {
    pointer.targetX = Math.min(1, Math.max(0, event.clientX / Math.max(1, width)));
    pointer.targetY = Math.min(1, Math.max(0, event.clientY / Math.max(1, height)));
    const surface = event.target.closest(
      ".feature-card, .principles-grid article, .boundary-card, .note-card, .warning-card, .contact-boundary, .decision-panel",
    );
    if (surface) {
      const rect = surface.getBoundingClientRect();
      const horizontal = event.clientX - rect.left < rect.width / 2 ? "w" : "e";
      const vertical = event.clientY - rect.top < rect.height / 2 ? "n" : "s";
      surface.dataset.spot = `${vertical}${horizontal}`;
    }
    wake(width < 600 ? 10 : 14);
  }

  function attachPointer() {
    if (!pointerAttached && finePointerQuery.matches && !userPaused) {
      document.addEventListener("pointermove", handlePointer, { passive: true });
      pointerAttached = true;
    }
  }

  const revealElements = Array.from(
    document.querySelectorAll(
      "main > section, .feature-card, .principles-grid article, .process-list li, .note-card, .warning-card, .contact-boundary",
    ),
  );
  revealElements.forEach((element) => element.setAttribute("data-reveal", ""));

  const startRevealObserver = () => {
    revealObserver?.disconnect();
    if (!("IntersectionObserver" in window) || motionQuery.matches) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    revealObserver = new IntersectionObserver(
      safe((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            pointer.targetY = Math.min(0.82, Math.max(0.18, entry.boundingClientRect.top / Math.max(1, height)));
            wake(12);
            revealObserver.unobserve(entry.target);
          }
        }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    revealElements.forEach((element) => revealObserver.observe(element));
  };

  const updateMotionState = () => {
    root.classList.toggle("motion-paused", userPaused);
    root.classList.toggle("motion-reduced", motionQuery.matches);
    toggle.setAttribute("aria-pressed", String(userPaused));
    label.textContent = userPaused ? "Resume motion" : "Pause motion";
    if (userPaused) {
      detachPointer();
      stopLoop();
      drawField(true);
      canvas.dataset.motionState = "paused";
    } else {
      attachPointer();
      wake(width < 600 ? 14 : 18);
    }
  };

  try {
    context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      failOpen();
      return;
    }
    toggle.hidden = false;
    toggle.addEventListener("click", safe(() => {
      userPaused = !userPaused;
      updateMotionState();
    }));
    window.addEventListener("resize", safe(() => {
      if (!resizeQueued) {
        resizeQueued = true;
        window.requestAnimationFrame(safe(resizeCanvas));
      }
    }), { passive: true });
    document.addEventListener("visibilitychange", safe(() => {
      canvas.dataset.visibilityState = document.hidden ? "hidden" : "visible";
      if (document.hidden) {
        stopLoop();
      } else {
        updateMotionState();
      }
    }));
    window.addEventListener("pagehide", safe(stopLoop));
    window.addEventListener("pageshow", safe(updateMotionState));
    motionQuery.addEventListener("change", safe((event) => {
      userPaused = event.matches;
      startRevealObserver();
      updateMotionState();
    }));
    finePointerQuery.addEventListener("change", safe(() => {
      detachPointer();
      attachPointer();
    }));

    root.classList.add("runtime-ready");
    canvas.dataset.runtime = "ready";
    canvas.dataset.visibilityState = document.hidden ? "hidden" : "visible";
    resizeCanvas();
    startRevealObserver();
    updateMotionState();
  } catch {
    failOpen();
  }
})();
