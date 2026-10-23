# Native-clock performance measurement

Candidate: `index-Cl7N8-97.js`. Six fresh browser contexts, one at a time,
Chromium 148.0.7778.96 on Windows. Native `requestAnimationFrame` intervals and
Long Tasks API, no `advanceTime`, CPU/network throttling or concurrent test
browsers. Raw evidence: `final-performance.json` in the qualification evidence
directory documented by `final-qualification-2026-10-22.md`.

The host reports Intel Xeon Gold 6148, 40 logical CPUs and 510.6 GiB memory.
Five contexts identify ANGLE/Vulkan SwiftShader software rendering; the first
context's early renderer query returned unavailable. These are automation-host
measurements, not physical-device or GPU performance certification.

Each case launches through the title and route, observes idle combat, plays
exactly one real card and completes a real enemy turn. All six finish without
page errors or pending combat animation. Title readiness was 461–930 ms.

| Viewport | Motion | Battle idle median / p95 (ms) | Card + enemy turn median / p95 (ms) | Post-entry route p95 (ms) |
| --- | --- | --- | --- | --- |
| 2560×1600 | Normal | 50.0 / 50.1 | 49.9 / 66.7 | 166.7 |
| 2560×1600 | Reduced | 50.0 / 66.7 | 50.0 / 50.1 | 183.3 |
| 1440×900 | Normal | 50.0 / 50.1 | 50.0 / 66.6 | 183.3 |
| 1440×900 | Reduced | 50.0 / 50.1 | 50.0 / 66.7 | 166.7 |
| 1000×560 | Normal | 50.0 / 66.6 | 50.0 / 50.1 | 183.4 |
| 1000×560 | Reduced | 50.0 / 50.1 | 50.0 / 66.6 | 216.7 |

Combat is approximately 20 frames/second in this software-rendered environment.
Post-entry route samples include deferred artwork/loading work after essential
controls are ready; their maximum interval is 300–350 ms. They are not warmed
steady-state route benchmarks. Card/enemy samples have maximum intervals of
117–150 ms and 14–33 long tasks. Reduced motion preserves the interaction
contract; it does not establish a consistent speed improvement here.

No 60-fps or low-end-device claim is supported. Plan item 59 requires measured
performance and complete journeys; these measurements satisfy its measurement
portion while documenting the observed limits. Existing physical-device release
waivers remain explicit and separate.
