(() => {
  const page = document.querySelector("#sharingPatentsPage");
  const trigger = document.querySelector("[data-open-sharing]");
  const closeButton = document.querySelector("#sharingPatentsClose");
  if (!page || !trigger || !closeButton) return;

  const entryItems = [...page.querySelectorAll(".sharing-patents__title, .sharing-patents__gallery, .sharing-patents__case, .sharing-patents__patent, .sharing-patents__caption"), closeButton];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let isOpen = false;

  function updateOrigin() {
    const source = trigger.getBoundingClientRect();
    const parent = page.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    const pageWidth = page.offsetWidth;
    const pageHeight = page.offsetHeight;
    if (!parentRect?.width || !parentRect.height || !pageWidth || !pageHeight) return "50% 50%";

    const x = (((source.left + source.width / 2 - parentRect.left) / parentRect.width) * parent.clientWidth) - page.offsetLeft;
    const y = (((source.top + source.height / 2 - parentRect.top) / parentRect.height) * parent.clientHeight) - page.offsetTop;
    const origin = `${Math.min(pageWidth, Math.max(0, x)).toFixed(2)}px ${Math.min(pageHeight, Math.max(0, y)).toFixed(2)}px`;
    page.style.setProperty("--sharing-patents-origin-x", origin.split(" ")[0]);
    page.style.setProperty("--sharing-patents-origin-y", origin.split(" ")[1]);
    return origin;
  }

  function finishClose() {
    isOpen = false;
    page.classList.remove("is-active");
    page.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-sharing-patents-open");
    window.othersDetailNavigation.restore(trigger);
  }

  function open() {
    if (isOpen) return;
    window.othersDetailNavigation.remember();
    isOpen = true;
    const origin = updateOrigin();
    page.classList.add("is-active");
    page.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-sharing-patents-open");
    if (!window.gsap || reducedMotion.matches) return;

    gsap.killTweensOf([page, ...entryItems]);
    gsap.set(page, { transformOrigin: origin });
    gsap.set(entryItems, { clearProps: "opacity,transform" });
    gsap.fromTo(page, { autoAlpha: 0, scale: 0.075 }, {
      autoAlpha: 1, scale: 1, duration: 0.56, ease: "power3.out", overwrite: "auto",
    });
    gsap.fromTo(entryItems, { autoAlpha: 0, y: 22 }, {
      autoAlpha: 1, y: 0, duration: 0.38, delay: 0.12, stagger: 0.035, ease: "power3.out", overwrite: "auto",
    });
  }

  function close() {
    if (!isOpen) return;
    if (!window.gsap || reducedMotion.matches) {
      finishClose();
      return;
    }

    const origin = updateOrigin();
    gsap.killTweensOf([page, ...entryItems]);
    gsap.set(page, { transformOrigin: origin });
    gsap.to(entryItems, { autoAlpha: 0, y: -8, duration: 0.16, stagger: 0.02, ease: "power2.in", overwrite: "auto" });
    gsap.to(page, {
      autoAlpha: 0, scale: 0.075, duration: 0.32, ease: "power3.in", overwrite: "auto",
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
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });
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
