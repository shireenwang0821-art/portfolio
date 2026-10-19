// This remains a classic script (rather than an ES module) so it can run when
// index-scroll-responsive.html is opened directly in Microsoft Edge. Edge
// blocks local module and fetch() requests, while ordinary local scripts and
// Image elements are permitted.
const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;
const angleDistance = (a, b) => Math.abs(((a - b + 540) % 360 + 360) % 360 - 180);

function pickFacingFrame(keys, angle, strength = 1, neutralFrame = 0) {
  if (strength <= 0.035) return keys.find((key) => key.frame === neutralFrame);
  return keys.reduce((best, key) => {
    if (key.angle === null) return best;
    const score = angleDistance(normalizeAngle(angle), key.angle)
      + Math.abs(strength - key.strength) * 9 - (key.preferred ? 0.001 : 0);
    return !best || score < best.score ? { key, score } : best;
  }, null)?.key;
}

function sourceToViewport(width, height, sourceWidth, sourceHeight, anchor, offsetX = 0) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return {
    x: (width - drawWidth) / 2 + offsetX,
    y: height - drawHeight,
    width: drawWidth,
    height: drawHeight,
    anchorX: (width - drawWidth) / 2 + anchor.x * drawWidth + offsetX,
    anchorY: height - drawHeight + anchor.y * drawHeight,
  };
}

const section = document.querySelector("#projectClosure[data-cover-direction]");
const canvas = section.querySelector("canvas");
const fallbackFrame = section.querySelector("[data-cover-fallback]");
// Keep the canvas transparent until an actual frame is ready. Its former
// opaque backing rendered as a full black page whenever a browser blocked
// fetch() from a local file preview.
const context = canvas.getContext("2d", { alpha: true });
const projectCover = section.closest(".project-cover");
const currentScriptUrl = document.currentScript?.src || new URL("scripts/cover-direction.js", document.baseURI).href;
const base = new URL("../assets/cover-direction/", currentScriptUrl);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// Both screen sizes use the original-resolution sequence. Two full-size
// bitmaps use the same ~28 MiB as the previous eight half-size bitmaps.
const tier = "frames";
const maxCachedFrames = 2;
const bitmaps = new Map();
const jobs = new Map();
let queue = [];
let concurrent = 0;
let active = false;
let nearby = false;
let initializing;
let mapping;
let desiredFrame = 0;
let displayedFrame = -1;
let tween;
let pointerRaf = 0;
let pendingPointer;
let resizeRaf = 0;
let geometry;
let visibilityRaf = 0;
const facing = { angle: 270, strength: 0 };

function updateDiagnostics() {
  section.dataset.cacheSize = String(bitmaps.size);
  section.dataset.decoding = String(concurrent);
  section.dataset.tier = tier;
  section.dataset.cacheLimit = String(maxCachedFrames);
  section.dataset.active = String(active);
}

function trimCache() {
  for (const [frame, bitmap] of bitmaps) {
    if (bitmaps.size <= maxCachedFrames) break;
    if (frame === displayedFrame || frame === desiredFrame) continue;
    bitmap.close?.();
    bitmaps.delete(frame);
  }
  updateDiagnostics();
}

function paint(frame) {
  const bitmap = bitmaps.get(frame);
  if (!bitmap || !geometry || !mapping || !nearby || document.hidden) return;
  const { x, y, width, height } = geometry;
  context.drawImage(bitmap, x, y, width, height);
  fallbackFrame?.classList.add("is-hidden");
  displayedFrame = frame;
  bitmaps.delete(frame);
  bitmaps.set(frame, bitmap);
  const key = mapping.ANGLE_KEYS[frame];
  section.dataset.frame = String(frame);
  section.dataset.angle = key.angle === null ? "neutral" : String(key.angle);
  section.dataset.sourceWidth = String(bitmap.width);
  section.dataset.sourceHeight = String(bitmap.height);
  trimCache();
}

function loadFrame(frame, priority = false) {
  if (bitmaps.has(frame)) {
    if (priority) paint(frame);
    return;
  }
  if (jobs.has(frame)) {
    if (priority) queue = [frame, ...queue.filter((item) => item !== frame)];
    pump();
    return;
  }
  jobs.set(frame, true);
  if (priority) queue.unshift(frame); else queue.push(frame);
  // Keep only a small window of requests when the pointer moves quickly.
  while (queue.length > 6) jobs.delete(queue.pop());
  pump();
}

function pump() {
  if (!nearby || document.hidden) return;
  while (concurrent < 2 && queue.length) {
    const frame = queue.shift();
    // The bitmap may have completed while a priority request was queued.
    if (bitmaps.has(frame)) { jobs.delete(frame); continue; }
    concurrent += 1;
    updateDiagnostics();
    // Image elements can decode local `file:` URLs as well as normal HTTP
    // assets. fetch(file:) is blocked by Chromium, which previously left the
    // alpha:false canvas as a black cover on local previews.
    const image = new Image();
    image.decoding = "async";
    new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Frame ${frame}: image load failed`));
      image.src = new URL(`${tier}/frame-${String(frame).padStart(4, "0")}.webp`, base).href;
    })
      .then((bitmap) => {
        bitmaps.set(frame, bitmap);
        if (frame === desiredFrame) paint(frame);
        trimCache();
        section.querySelector("[data-cover-error]").hidden = true;
      })
      .catch((error) => {
        console.error("Cover direction frame:", error);
        if (frame === desiredFrame) {
          const message = section.querySelector("[data-cover-error]");
          message.textContent = "画面加载失败，请刷新重试";
          message.hidden = false;
        }
      })
      .finally(() => { concurrent -= 1; jobs.delete(frame); updateDiagnostics(); pump(); });
  }
}

function selectFrame(frame, prefetch = true) {
  desiredFrame = frame;
  loadFrame(frame, true);
  if (prefetch) {
    // Only nearby observed frames are warmed; never decode the entire film.
    for (const offset of [-1, 1]) {
      const neighbor = frame + offset;
      if (neighbor >= 0 && neighbor < 121) loadFrame(neighbor);
    }
  }
}

function resize() {
  if (!mapping) return;
  const rect = section.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  // Preserve Retina detail while keeping the canvas below a 4K pixel budget.
  const dpr = Math.min(devicePixelRatio || 1, 3, Math.sqrt(8_294_400 / (width * height)));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const offsetX = parseFloat(getComputedStyle(section).getPropertyValue("--cover-direction-offset-x")) || 0;
  geometry = sourceToViewport(width, height, 2560, 1440, mapping.anchor, offsetX);
  section.dataset.offsetX = String(offsetX);
  section.dataset.anchorX = geometry.anchorX.toFixed(2);
  section.dataset.canvasScale = dpr.toFixed(2);
  paint(displayedFrame >= 0 ? displayedFrame : desiredFrame);
}

function renderFacing() {
  if (!active || !mapping) return;
  const key = pickFacingFrame(mapping.ANGLE_KEYS, facing.angle, facing.strength, mapping.neutralFrame);
  if (key && key.frame !== desiredFrame) selectFrame(key.frame);
}

function aimAtPointer() {
  pointerRaf = 0;
  if (!active || !mapping || !geometry || !pendingPointer) return;
  const rect = section.getBoundingClientRect();
  const dx = pendingPointer.x - rect.left - geometry.anchorX;
  const dy = pendingPointer.y - rect.top - geometry.anchorY;
  const distance = Math.hypot(dx, dy);
  const deadZone = Math.max(14, Math.min(rect.width, rect.height) * .035);
  const strength = distance < deadZone ? 0 : Math.min(1, (distance - deadZone) / (Math.min(rect.width, rect.height) * .23));
  const angle = normalizeAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  section.dataset.targetAngle = angle.toFixed(1);
  section.dataset.targetFrame = String(pickFacingFrame(mapping.ANGLE_KEYS, angle, strength, mapping.neutralFrame).frame);
  const delta = ((angle - normalizeAngle(facing.angle) + 540) % 360) - 180;
  tween?.kill();
  if (window.gsap && !reducedMotion.matches) {
    tween = window.gsap.to(facing, {
      angle: facing.angle + delta, strength, duration: .16, ease: "power2.out",
      overwrite: true, onUpdate: renderFacing,
    });
  } else {
    facing.angle += delta;
    facing.strength = strength;
    renderFacing();
  }
}

function resetToNeutral() {
  tween?.kill();
  facing.strength = 0;
  if (mapping) selectFrame(mapping.neutralFrame);
}

function initialize() {
  if (initializing) return initializing;
  initializing = Promise.resolve().then(() => {
    mapping = window.COVER_DIRECTION_MAPPING;
    if (!mapping?.ANGLE_KEYS?.length || !mapping.anchor) {
      throw new Error("Embedded cover-direction mapping is unavailable");
    }
    resize();
    selectFrame(mapping.neutralFrame);
  }).catch((error) => {
    initializing = null;
    const message = section.querySelector("[data-cover-error]");
    message.textContent = "朝向配置加载失败，请刷新重试";
    message.hidden = false;
    console.error(error);
  });
  return initializing;
}

function updateVisibility() {
  visibilityRaf = 0;
  const rect = section.getBoundingClientRect();
  const projectVisible = !projectCover.classList.contains("is-hidden");
  const visible = projectVisible && section.getAttribute("aria-hidden") !== "true"
    && rect.top < innerHeight && rect.bottom > 0;
  active = visible && !document.hidden;
  // Warm the first frame in the preceding About Me chapter, not at initial load.
  nearby = !document.hidden && projectVisible
    && (visible || document.body.classList.contains("is-about-me-active"));
  if (active) { initialize().then(() => { resize(); pump(); }); }
  else {
    tween?.kill();
    cancelAnimationFrame(pointerRaf);
    pointerRaf = 0;
    if (!nearby) {
      queue.forEach((frame) => jobs.delete(frame));
      queue = [];
      for (const [frame, bitmap] of bitmaps) {
        if (frame !== displayedFrame) { bitmap.close(); bitmaps.delete(frame); }
      }
    }
  }
  if (nearby && !mapping) initialize();
  if (nearby && mapping) { pump(); paint(desiredFrame); }
  updateDiagnostics();
}

function scheduleVisibility() {
  if (!visibilityRaf) visibilityRaf = requestAnimationFrame(updateVisibility);
}

const observer = new IntersectionObserver(scheduleVisibility, { rootMargin: "50% 0px", threshold: [0, .01, .5, 1] });
observer.observe(section);
new MutationObserver(scheduleVisibility).observe(section, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
new MutationObserver(scheduleVisibility).observe(projectCover, { attributes: true, attributeFilter: ["class"] });
window.addEventListener("scroll", scheduleVisibility, { passive: true });
document.addEventListener("visibilitychange", scheduleVisibility);
section.addEventListener("pointermove", (event) => {
  if (!active) return;
  if (event.pointerType === "touch" && event.buttons !== 1) return;
  pendingPointer = { x: event.clientX, y: event.clientY };
  if (!pointerRaf) pointerRaf = requestAnimationFrame(aimAtPointer);
}, { passive: true });
section.addEventListener("pointerleave", resetToNeutral);
section.addEventListener("pointercancel", resetToNeutral);
section.addEventListener("pointerup", (event) => { if (event.pointerType === "touch") resetToNeutral(); });
// The closing scene remains the terminal page rather than a navigation trigger.
section.addEventListener("click", (event) => event.stopPropagation());
section.addEventListener("pointerdown", (event) => event.stopPropagation());
new ResizeObserver(() => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resize);
}).observe(section);
updateVisibility();
