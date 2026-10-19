(() => {
  const page = document.querySelector("#othersGenerativePage");
  const trigger = document.querySelector('[data-others-preview="generative-ui"]');
  const closeButton = document.querySelector("#othersGenerativeClose");
  if (!page || !trigger || !closeButton) return;

  const sweeps = [...page.querySelectorAll(".theme-sweep")];
  const entryItems = [...page.querySelectorAll(".generative-ui__intro, .generative-ui__case"), closeButton];
  const equalHeightPairs = [
    {
      source: page.querySelector(".generative-ui__source--design-md img"),
      target: page.querySelector(".generative-ui__homepage-preview"),
    },
    {
      source: page.querySelector(".generative-ui__source--tokens img"),
      target: page.querySelector(".generative-ui__templates"),
    },
  ].filter(({ source, target }) => source && target);
  const flowMarkers = [
    {
      marker: page.querySelector(".generative-ui__flow--a2ui .generative-ui__plus"),
      left: page.querySelector(".generative-ui__source--design-md img"),
      right: page.querySelector(".generative-ui__source--library img"),
    },
    {
      marker: page.querySelector(".generative-ui__flow--a2ui .generative-ui__arrow"),
      left: page.querySelector(".generative-ui__source--library img"),
      right: page.querySelector(".generative-ui__homepage-preview"),
    },
    {
      marker: page.querySelector(".generative-ui__flow--codegen .generative-ui__arrow"),
      left: page.querySelector(".generative-ui__source--tokens img"),
      right: page.querySelector(".generative-ui__templates"),
    },
  ].filter(({ marker, left, right }) => marker && left && right);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let isOpen = false;
  let frame = 0;
  let startedAt = 0;
  let equalizeFrame = 0;

  function syncSourceImageHeights() {
    equalizeFrame = 0;
    const isCompact = window.matchMedia("(max-width: 920px)").matches;
    equalHeightPairs.forEach(({ source, target }) => {
      if (isCompact) {
        source.style.removeProperty("height");
        source.style.removeProperty("width");
        return;
      }

      const targetHeight = Math.round(target.offsetHeight);
      if (!targetHeight) return;
      source.style.height = `${targetHeight}px`;
      source.style.width = "auto";
    });
    syncFlowMarkers(isCompact);
  }

  function syncFlowMarkers(isCompact) {
    flowMarkers.forEach(({ marker, left, right }) => {
      if (isCompact) {
        marker.style.removeProperty("translate");
        return;
      }

      marker.style.translate = "0 0";
      const markerRect = marker.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const imageCentre = ((leftRect.top + leftRect.height / 2) + (rightRect.top + rightRect.height / 2)) / 2;
      const markerCentre = markerRect.top + markerRect.height / 2;
      const gapCentre = (leftRect.right + rightRect.left) / 2;
      const markerHorizontalCentre = markerRect.left + markerRect.width / 2;
      marker.style.translate = `${(gapCentre - markerHorizontalCentre).toFixed(2)}px ${(imageCentre - markerCentre).toFixed(2)}px`;
    });
  }

  function requestSourceImageHeightSync() {
    cancelAnimationFrame(equalizeFrame);
    equalizeFrame = requestAnimationFrame(syncSourceImageHeights);
  }

  function stopSweep() {
    cancelAnimationFrame(frame);
    frame = 0;
    startedAt = 0;
    sweeps.forEach((sweep) => {
      sweep.classList.remove("is-sweeping");
      sweep.querySelector(".theme-sweep__scanline").style.removeProperty("transform");
      sweep.querySelectorAll(".theme-sweep__dark").forEach((image) => image.style.removeProperty("clip-path"));
    });
  }

  function renderSweep(timestamp) {
    if (!isOpen) return;
    if (!startedAt) startedAt = timestamp;
    const phase = ((timestamp - startedAt) % 14000) / 7000;
    const progress = phase <= 1 ? phase : 2 - phase;
    sweeps.forEach((sweep) => {
      const rect = sweep.getBoundingClientRect();
      const line = sweep.querySelector(".theme-sweep__scanline");
      const lineX = progress * rect.width;
      line.style.transform = `translate3d(${progress * sweep.clientWidth - line.offsetWidth / 2}px, 0, 0)`;
      sweep.querySelectorAll(".theme-sweep__dark").forEach((image) => {
        const imageRect = image.getBoundingClientRect();
        const reveal = Math.min(1, Math.max(0, (rect.left + lineX - imageRect.left) / imageRect.width));
        image.style.clipPath = `inset(0 ${100 - reveal * 100}% 0 0)`;
      });
    });
    frame = requestAnimationFrame(renderSweep);
  }

  function updateOrigin() {
    const source = trigger.getBoundingClientRect();
    const parent = page.parentElement;
    const rect = parent.getBoundingClientRect();
    const x = ((source.left + source.width / 2 - rect.left) / rect.width) * parent.clientWidth - page.offsetLeft;
    const y = ((source.top + source.height / 2 - rect.top) / rect.height) * parent.clientHeight - page.offsetTop;
    const origin = `${x}px ${y}px`;
    page.style.transformOrigin = origin;
    return origin;
  }

  function open() {
    if (isOpen) return;
    window.othersDetailNavigation.remember();
    isOpen = true;
    page.querySelector(".structured-expression__scroll").scrollTop = 0;
    const transformOrigin = updateOrigin();
    page.classList.add("is-active");
    page.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-others-generative-open");
    requestSourceImageHeightSync();
    if (!reducedMotion.matches) {
      sweeps.forEach((sweep) => sweep.classList.add("is-sweeping"));
      frame = requestAnimationFrame(renderSweep);
    }
    if (!window.gsap || reducedMotion.matches) return;
    gsap.killTweensOf([page, ...entryItems]);
    gsap.set(page, { transformOrigin });
    gsap.fromTo(page, { autoAlpha: 0, scale: 0.075 }, {
      autoAlpha: 1,
      scale: 1,
      duration: 0.56,
      ease: "power3.out",
      onComplete: requestSourceImageHeightSync,
    });
    gsap.fromTo(entryItems, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.38, delay: 0.12, stagger: 0.055, ease: "power3.out" });
  }

  function finishClose() {
    isOpen = false;
    page.classList.remove("is-active");
    page.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-others-generative-open");
    window.othersDetailNavigation.restore(trigger);
  }

  function close() {
    if (!isOpen) return;
    window.othersDetailNavigation.restorePosition();
    stopSweep();
    if (!window.gsap || reducedMotion.matches) {
      finishClose();
      return;
    }
    gsap.killTweensOf([page, ...entryItems]);
    gsap.set(page, { transformOrigin: updateOrigin() });
    gsap.to(entryItems, { autoAlpha: 0, y: -8, duration: 0.16, stagger: 0.025, ease: "power2.in" });
    gsap.to(page, {
      autoAlpha: 0, scale: 0.075, duration: 0.32, ease: "power3.in",
      onComplete: () => {
        gsap.set([page, ...entryItems], { clearProps: "opacity,visibility,transform,transformOrigin" });
        finishClose();
      },
    });
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    open();
  });
  closeButton.addEventListener("click", close);
  window.addEventListener("resize", requestSourceImageHeightSync);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(requestSourceImageHeightSync);
    equalHeightPairs.forEach(({ target }) => observer.observe(target));
  }
  page.addEventListener("pointerdown", (event) => event.stopPropagation());
  page.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
  page.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
  page.addEventListener("touchend", (event) => event.stopPropagation(), { passive: true });
  window.addEventListener("keydown", (event) => {
    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
})();
