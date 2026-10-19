# Closing page direction background

Source: `D:/Download/cober.mp4`, 2560×1440, 24 fps, 121 decoded frames, 5.041666667 seconds. The original MP4 is not needed at runtime.

Following clarity feedback, every interactive frame now retains the original resolution, including the opening upward hold and the final return to camera. Desktop and mobile share one sequence:

| Tier | Resolution | All 121 frames | WebP quality |
| --- | --- | --- | --- |
| Desktop and mobile `frames/` | 2560×1440 | 9,208,088 bytes | 95 |
| Review face thumbnails `thumbs/` | 512×512 | 2,097,156 bytes | 90 |

All frames are encoded directly from decoded source pixels, without spatial downsampling. Eleven quality samples measure 49.80–50.02 dB PSNR over the frame and 46.86–47.48 dB over the face region. Each complete frame is below 100KB. The former low-resolution mobile sequence was moved to a temporary archive outside the project so it cannot accidentally be served. Gallery thumbnails use a direct face crop rather than enlarging the character from a small full-scene image; clicking opens the full 2560px frame.

`manifest.json` contains the original presentation timestamps and frame durations, read from FFmpeg's integer time base, and per-frame file sizes. `previews/contact-*.jpg` shows all 121 frames, with original zero-based frame numbers.

## Mapping

`angle-keys.json` contains one explicit `ANGLE_KEYS` entry per frame. Coordinates are screen bearings: right 0°, down 90°, left 180°, up 270°. The head/eye anchor is at source-normalized `(0.515, 0.685)`. Near this anchor, the character returns to neutral frame 0.

The annotations were made by inspecting all full frames and enlarged face sheets. Angles and expression strengths are visual estimates for an interaction demo, not measured 3D pose or scientifically precise gaze. Neutral frames have `angle: null`; upward holds share the same angle with different strength values. No angle is generated from frame index or timestamp. Cardinal anchors are up #020, right #049, down #073 and left #090.

Runtime lookup uses circular angular distance and observed strength to select an explicitly annotated frame. GSAP eases the requested bearing along the shortest angular path. It never calculates a frame index from angle or source time. Frames retain their aspect ratio and bottom alignment. At portrait widths <=760px, the user-requested fixed -30 CSS pixel offset (20px right of the preceding -50px position) applies equally to the image and its interaction anchor; landscape keeps its previous position.

## Runtime and review

- Production closing page: `/index-scroll-responsive.html#projectClosure`. The former `#cover-direction-preview` hash remains an entry alias to this same closing page.
- All-frame gallery: `/demos/cover-direction-review.html`.
- The approved effect replaces the background inside the existing `#projectClosure` scene. The appended preview screen and its debug controls have been removed; the original 1600vh story corridor and closing-page transition remain intact. Original copy and typewriter behavior are retained, with dark text positioned above the character for readability.
- Only one full-resolution sequence is requested. At most two frames decode concurrently, with at most two decoded bitmaps retained; outside the preview region only the displayed bitmap remains.
- No continuous render loop is used by the preview. Nearby frames warm on demand, and pointer updates stop when the page is offscreen or hidden.
- Decoded cache ceiling is approximately 28.13 MiB on both screen sizes, equal to the former eight 1280px frames. Allow separately for canvas and up to two temporary in-flight decodes. Canvas honors device DPR up to 3 while staying within a 4K pixel budget.
- The old WebGL gradient, vignette and grain have been removed. Pointer work and decoding stop when the closing scene is offscreen; the original typewriter follows its existing visibility lifecycle.
- Frame inspection is available separately in the all-frame review gallery; production has no debug controls. Runtime: `scripts/cover-direction.js`.

Reproduce extraction and publish the existing source-specific annotations:

```powershell
python scripts/extract-cover-frames.py D:\Download\cober.mp4
python scripts/annotate-cover-directions.py
node scripts/check-cover-direction.mjs
npm run check
```

If replacing the source film, re-inspect every frame and revise `OBSERVATIONS` in the annotation script; do not reuse this source's mapping blindly.

## Verification, 2026-10-18

- Verified file coverage, integer-time-base timestamps, each compressed file, exact four-direction anchors, neutral selection, angular wraparound, and all half-degree queries across four revolutions.
- Browser mouse inputs hit right #049, left #090, up #020 and down #073; the anchor dead zone selects #000.
- Verified all 121 full frames at 2560×1440 and all 121 face thumbnails at 512×512. Direction annotations and original timestamps are unchanged.
- Verified no horizontal overflow at portrait widths 320/375/390/430/760; all use -30px after a 20px rightward adjustment and a matching shifted pointer anchor. Landscape 844×390 and desktop 1440×900 use 0px offset. The 28px headings and 32px debug-panel copy are unchanged.
- Verified scrolling into and out of the existing closing scene. Offscreen frame decoding becomes idle and cache shrinks to one bitmap. There is no additional page after the closing scene.
- Both the dedicated check and the existing `npm run check` pass. Inline scripts and new JavaScript modules parse.
- The original page also reports an existing `MutationObserver.observe` error in its unrelated water-ripple script (`stage` is not a Node); this preview does not use that observer.

The user approved the interaction and authorized background replacement. It is now integrated in the production closing page.
