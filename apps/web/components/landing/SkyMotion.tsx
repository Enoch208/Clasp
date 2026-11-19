"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { archLines, footerRise, navMorph, splitReveals, trackFlip } from "@/lib/skyMotion";

function syncHeroHeight(root: HTMLElement) {
  const hero = root.querySelector<HTMLElement>(".sky-hero-wrap");
  const nav = root.querySelector<HTMLElement>(".sky-nav");
  if (hero && nav) root.style.setProperty("--sky-hero-height", `${hero.offsetHeight + nav.offsetHeight}px`);
}

export function SkyMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sky");
    if (!root) return;
    syncHeroHeight(root);
    const resize = new ResizeObserver(() => syncHeroHeight(root));
    resize.observe(root);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => (el.style.visibility = "visible"));
      return () => resize.disconnect();
    }

    if (window.matchMedia("(min-width: 768px)").matches) {
      root.querySelectorAll<HTMLVideoElement>("[data-sky-video]").forEach((video) => {
        video.addEventListener("playing", () => video.setAttribute("data-playing", ""), { once: true });
        video.play().catch(() => undefined);
      });
    }

    gsap.registerPlugin(ScrollTrigger, SplitText);
    root.classList.add("sky--motion");
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    let ctx: gsap.Context | null = null;
    const media = gsap.matchMedia();
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        splitReveals(root);
        navMorph(root);
        archLines(root);
        footerRise(root);
      }, root);
      media.add("(min-width: 992px)", () => trackFlip(root), root);
      ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      root.classList.remove("sky--motion");
      media.revert();
      ctx?.revert();
      gsap.ticker.remove(tick);
      lenis.destroy();
      resize.disconnect();
    };
  }, []);

  return null;
}
