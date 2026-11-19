"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { ATTACKS, STRIPS } from "@/lib/landing";
import { scrambleTo, setCode } from "@/lib/scramble";

const GAP_CLASS = { base: "", wide: " sky-strip--wide", tight: " sky-strip--tight", mid: " sky-strip--mid" } as const;

function buildStrips() {
  let next = 0;
  return STRIPS.map((strip) => ({
    ...strip,
    slots: strip.slots.map((kind) => {
      if (kind === "off") return { kind, attack: null };
      const attack = ATTACKS[next % ATTACKS.length];
      next += 1;
      return { kind, attack };
    }),
  }));
}

const LAYOUT = buildStrips();
const HALF = Math.ceil(LAYOUT.length / 2);

function Strip({ strip }: { strip: (typeof LAYOUT)[number] }) {
  return (
    <div className={`sky-strip${GAP_CLASS[strip.gap]}`}>
      {strip.slots.map((slot, index) => (
        <div className={`sky-tick-slot${slot.kind === "wide" ? " sky-tick-slot--desktop" : ""}`} key={index}>
          {slot.attack ? (
            <div className="sky-tick" data-code={slot.attack.code}>
              <span className="sky-tick__text">{slot.attack.label}</span>
            </div>
          ) : (
            <div className="sky-tick sky-tick--rest" />
          )}
        </div>
      ))}
    </div>
  );
}

export function AttackField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const codeEl = codeRef.current;
    if (!field || !codeEl) return;
    setCode(codeEl, ATTACKS[2].code);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const ticks = [...field.querySelectorAll<HTMLElement>(".sky-tick[data-code]")].filter(
      (tick) => !(mobile && tick.parentElement?.classList.contains("sky-tick-slot--desktop")),
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ticks.forEach((tick) => (tick.style.opacity = "1"));
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const tokens = getComputedStyle(field);
    const red = tokens.getPropertyValue("--sky-red").trim();
    const redSoft = tokens.getPropertyValue("--sky-red-soft").trim();
    const black = tokens.getPropertyValue("--sky-black").trim();
    const glow = (spread: number) => `0 0 ${spread}px ${black}, 0 0 20px ${red}`;
    const running = new Set<() => void>();
    ticks.forEach((tick) => {
      const label = tick.querySelector<HTMLElement>(".sky-tick__text");
      if (label) label.dataset.text = label.textContent ?? "";
    });

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ repeat: -1, paused: true });
      gsap.utils.shuffle([...ticks]).forEach((tick) => {
        const label = tick.querySelector<HTMLElement>(".sky-tick__text");
        timeline
          .to(tick, {
            opacity: 1,
            width: "auto",
            color: black,
            boxShadow: glow(2),
            duration: 0.5,
            ease: "elastic.out(1,0.75)",
            onStart: () => {
              scrambleTo(codeEl, tick.dataset.code ?? "", 800, true, running);
              if (label) scrambleTo(label, label.dataset.text ?? "", 800, false, running);
            },
          })
          .to(tick, { boxShadow: glow(3), backgroundColor: red, duration: 0.5, ease: "power1.out" }, "-=0.15")
          .to(tick, { boxShadow: glow(2), backgroundColor: redSoft, scale: 1.02, duration: 0.5, ease: "power1.out" })
          .to(tick, { boxShadow: glow(3), backgroundColor: red, scale: 1, duration: 0.5, ease: "power1.out" })
          .to(tick, { boxShadow: glow(2), backgroundColor: redSoft, scale: 1.02, duration: 0.5, ease: "power1.out" })
          .to(tick, { opacity: 1, width: "2px", color: red, boxShadow: "none", scale: 1, duration: 0.5, ease: "power3.out" });
      });
      ScrollTrigger.create({
        trigger: field,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (self.isActive ? timeline.play() : timeline.pause()),
      });
    }, field);

    return () => {
      [...running].forEach((stop) => stop());
      ctx.revert();
    };
  }, []);

  return (
    <div className="sky-attacks__field" ref={fieldRef}>
      <div className="sky-attacks__strips" aria-hidden="true">
        {LAYOUT.slice(0, HALF).map((strip, index) => (
          <Strip strip={strip} key={index} />
        ))}
      </div>
      <div className="sky-attacks__center">
        <span className="sky-attacks__code" ref={codeRef} aria-hidden="true" />
        <p className="sky-attacks__sub">Sent back to the attacker before any money moves</p>
        <p className="sky-sr-only">
          For example, a replayed request is rejected with replay_detected and a stolen token with origin_mismatch.
        </p>
      </div>
      <div className="sky-attacks__strips" aria-hidden="true">
        {LAYOUT.slice(HALF).map((strip, index) => (
          <Strip strip={strip} key={index} />
        ))}
      </div>
      <div className="sky-attacks__foot">
        <p>
          Each label is a real attack the policy engine rejects. Six of them run live in the Security Lab.
          <Link href="/lab">&gt; Run them yourself</Link>
        </p>
      </div>
    </div>
  );
}
