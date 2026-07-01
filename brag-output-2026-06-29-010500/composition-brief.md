# Hyperframes Composition Brief: Expense Tracker

## Objective
Create a short yc-parody launch-style brag video for Expense Tracker — a humble ₹ personal expense tracker delivered with fake Series A fintech gravitas.

## Output
- Composition directory: `brag-output-2026-06-29-010500/composition/`
- Rendered video: `brag-output-2026-06-29-010500/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 20 seconds

## Source Material
- Project root: /Users/manojaaa/Expense Tracker
- Primary files read: index.html, src/index.css, src/pages/{Onboarding,AddTransaction,Dashboard}.tsx
- Product name: Expense Tracker
- Tagline / strongest claim (invented, parody): "The personal finance crisis is over. We built a tracker."
- Key UI to recreate: Cash Balance gradient hero card (₹L/₹K formatting), Onboarding Quick-Add account chips, Add screen ₹ amount field, budget ring.
- Copy that must appear verbatim (real from product):
  - "Welcome!"  (Onboarding header)
  - "HDFC 8682", "GPay", "Paytm"  (real Quick-Add account chips)
  - "₹" symbol + "Add Expense" + "Expense"/"Income" toggle (real Add screen)
  - "Cash Balance", "Income", "Expense", "Today", "Txns" (real Dashboard labels)

## Creative Direction
- Tone preset: yc-parody
- Creative direction: "fake fintech Series A launch for an app that tracks chai money"
- Interpretation: hard cuts, structured corporate pacing, restrained quiet audio, giant confident type; humor from deadpan grand claims over a tiny real product.
- Angle: Treat a modest ₹ expense tracker as a world-changing fintech that just closed a $40M Series A. Everything shown is the real product; the comedy is the mismatch between the gravitas and "you spent ₹240 on chai."
- Hook: Black, emerald cursor. "The personal finance crisis is over." slams in, holds; then small "We built a tracker."
- Outro / punchline: "Series A. Allegedly." then small "You built it. ₹240 at a time."
- Avoid: generic SaaS language, abstract filler visuals, redesigning the product, hype risers/airhorns.

## Visual Identity
- Background: #121212 ; surfaces #1c1c1e / #2c2c2e
- Text: #f5f5f7 ; muted #8e8e93
- Accent: #10b981 (emerald primary), #f59e0b (amber secondary), #ef4444 (expense red)
- Card gradient: #1a3a2a → #0d1f17
- Display font: SF Pro Display / -apple-system system stack (no web-font dependency)
- Body font: same system stack
- Visual references: Cash Balance gradient card, rounded-2xl/3xl surfaces, pill chips, circular budget ring (SVG stroke-dasharray), ₹ values formatted as ₹240 / ₹12.5K / ₹1.2L.

## Storyboard
Use `brag-plan.md` as the creative contract. 5 scenes:
1. Hook — 3.5s — black, "The personal finance crisis is over." → "We built a tracker."
2. Onboarding "partners" — 4s — "Welcome!", chips HDFC 8682 / GPay / Paytm appear one by one; caption "Onboarding institutional partners."
3. Add transaction — 4.5s — Expense toggle, ₹240 types in, category chip selects, "Add Expense"; caption "Executing a transaction."
4. Dashboard reveal — 5s — Cash Balance card, Income/Expense, Today/Txns, budget ring fills (strong cue ~12.65s); caption "Real-time treasury intelligence."
5. Outro — 3s — "Expense Tracker" logotype, "Series A. Allegedly." → "You built it. ₹240 at a time."

## Audio
- Audio role: sparse professional accents over a quiet confident corporate bed (yc-parody restraint).
- Audio arc: low bed throughout; sparse motion-matched ticks; one musical lift at the Dashboard ring; fade under outro.
- Music: assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3
- Music treatment: start ~0.3s, low volume (~0.28), gentle fade-out over the final 2s. No drops.
- Music cue guidance: bundled preset — 114.84 BPM. Strong cues: 1.60, 3.70, 5.80, 8.96, 12.65, 17.91s. Lock the Dashboard ring fill to 12.65s strong cue. Beat grid available for chip/stat sequencing (~0.52s spacing) — use every-other-beat for readable text.
- Audio-reactive treatment: subtle — let the Cash Balance card presence/glow breathe on the bed; no waveform bars.
- Audio-coupled moments:
  - Scene 2 chips — soft select click per chip (snap to every-other-beat).
  - Scene 3 ₹ amount — soft key ticks as digits type.
  - Scene 3 button — one soft press tick.
  - Scene 4 budget ring — soft tick on completion at the 12.65s strong cue.
- SFX selection guidance: use the bundled brag SFX library (ui/interface clicks, keyboard key ticks). Prefer low high-frequency-risk files for repeated ticks. Sparse — yc-parody.
- SFX analysis guidance: ~/.claude/skills/brag/assets/sfx/sfx-analysis.md
- Exact SFX choice: Hyperframes/author selects filenames/timestamps after animation exists.
- Audio files: copy chosen music (done) and any SFX into composition/assets/.

## Hyperframes Instructions
- Author with the native hyperframes-core data-* contract; single paused timeline, seek-safe, deterministic.
- Show real UI (Cash Balance card + real labels + real chips) — required.
- Keep all text readable (reading-time floor: short label ~0.8s settled, sentence ~0.3s/word).
- 20s total, vertical 1080x1920.
- Include music + sparse SFX; honor fade-out.
- Lock 1 strong cue (Dashboard ring @12.65s); snap chip/stat sequences to beats but keep text readable.
- Run `hyperframes lint` (zero errors) before render.
