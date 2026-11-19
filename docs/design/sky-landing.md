# Sky landing — design notes

The landing page (`apps/web/app/page.tsx`) follows the design language of ethos.network: framed sky hero, a dark attack field that tilts away in 3D, a sticky scroll-driven explainer, a marquee, a cobalt architecture panel, a changelog and a big-wordmark footer. It was rebuilt from scratch with Clasp's own content, mark, copy and illustrations. No Ethos code, fonts, images or text are used.

## Tokens (`app/styles/sky.css`)

| Token | Value | Use |
|---|---|---|
| `--sky-night` | `#101113` | attack field, nav bar |
| `--sky-ink` | `#1f2125` | dark sections, text on sky |
| `--sky-graphite` | `#2b2d30` | hovers, footer wordmark |
| `--sky-slate` | `#3f4142` | dividers on dark |
| `--sky-stone` / `--sky-ash` / `--sky-bone` | `#747571` / `#94948f` / `#c1c0b6` | text on dark, by emphasis |
| `--sky-blue` / `--sky-blue-strong` | `#7093ff` / `#517fff` | links, hold state, footer CTA |
| `--sky-cobalt` | `#1f21b6` | architecture panel, button flip fill |
| `--sky-red` | `#ff4000` | rejected / attacks |
| `--sky-green` | `#1fc080` | settled |
| `--sky-orange` | `#ff8000` | rate limited |

Type: Instrument Serif (display; a free stand-in for Kilotype's Queens Condensed Light), Space Grotesk (UI), Space Mono (labels, buttons). Hero and nav type scale fluidly with the viewport, using the same breakpoints as the reference (1920 / 1280 / 990).

## Motion (`lib/skyMotion.ts`, `components/landing/SkyMotion.tsx`)

| Element | Behaviour |
|---|---|
| Page | Lenis smooth scroll (lerp 0.1), driving GSAP ScrollTrigger |
| Hero frame | 1px lines draw in, `scale(0)`→`scale(1)`, 1.5s ease-in-out |
| Hero title | chars rise from 130% inside line masks, 0.5s, stagger amount 0.8 |
| Hero cells | chars fade in, 0.5s, stagger amount 0.8 |
| Nav | scrubbed between the nav reaching the top and docking: grid widens to full width, borders and text turn bone, logo shrinks to 70px, dark bar slides up, bar lifts 1.5rem |
| Attack field | sticky; scrubbed `rotateX(-90deg)` from the top edge reveals the sky; features heading rises from 60vh |
| Attack ticks | shuffled loop: each 2px tick opens into its attack name with an elastic ease and a red glow, then pulses twice; the centre decodes the matching error code with a text scramble (50ms steps for 800ms). Pauses while off screen |
| Section headings | chars fade in on entering at 80%, and reset on scrolling back above |
| Payment paths | sticky menu plus diagram; the active tab follows scroll (desktop) or rotates every 6s (mobile) |
| Marquee | 80s linear (40s on mobile), rows alternate direction |
| Architecture | connector lines draw in, scrubbed |
| Buttons | fill flips up from the bottom edge, `rotateX(90deg)`→`0`, 0.4s `cubic-bezier(.215,.61,.355,1)` |
| Footer | headline chars fade in; the giant wordmark rises from 100% |

Under `prefers-reduced-motion: reduce`, Lenis, the scrubbed timelines, the marquee and the line draws are all off. All content is visible from the start, and the attack panel no longer pins.

## Image slots

| File | Wired in | Notes |
|---|---|---|
| `public/landing/sky.mp4` | `SKY_MEDIA.video` | 1920×1080, 9s, H.264 in standard colour range, no audio, 1.3 MB. The loop was made seamless by crossfading its end into its start. Loads only at 768px and wider, and only plays when motion is allowed |
| `public/landing/sky.jpg` | `SKY_MEDIA.still` | 3840×2160, the still for 768px and wider |
| `public/landing/sky-phone.jpg` | `SKY_MEDIA.phone` | 1290×2796, the still below 768px |
| `public/landing/news-*.jpg` | `NEWS[].thumb` | 1200×750, black-and-white editorial stills |

On wide screens the hero gets a white wash from 58% across, reaching 30% at the right edge. It keeps the right-hand text above 4.5:1 contrast where the sky is bluest; without it, contrast dropped to 3.1:1.

## Honesty rules this page keeps

- Every attack label maps to an error code the policy engine really returns (see `packages/protocol/src/errors.ts`). The "six live" claim matches the Security Lab.
- The marquee badges are example outcomes, not statistics.
- The footer status reads `/health` at runtime and says "Status unavailable" when it can't be read.
- Changelog dates come from git history. The hackathon win shows only "July 2026" because no exact date is recorded.
