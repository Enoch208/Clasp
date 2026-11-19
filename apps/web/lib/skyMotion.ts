import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

function playOnEnter(trigger: Element, timeline: gsap.core.Timeline, start = "top 80%") {
  ScrollTrigger.create({ trigger, start: "top bottom", onLeaveBack: () => timeline.progress(0).pause() });
  ScrollTrigger.create({ trigger, start, onEnter: () => timeline.play() });
}

export function splitReveals(root: HTMLElement) {
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  root.querySelectorAll<HTMLElement>('[data-split="rise"]').forEach((heading) => {
    if (!desktop) return;
    const chars = [...heading.children].flatMap((line) => {
      line.classList.add("sky-split-line");
      (line as HTMLElement).style.overflow = "clip";
      return SplitText.create(line, { type: "chars" }).chars;
    });
    heading.style.visibility = "visible";
    playOnEnter(heading, gsap.timeline({ paused: true }).from(chars, { yPercent: 130, duration: 0.5, ease: "power1.out", stagger: { amount: 0.8 } }));
  });
  root.querySelectorAll<HTMLElement>('[data-split="para"]').forEach((para) => {
    if (!desktop) return;
    const { chars } = SplitText.create(para, { type: "words,chars" });
    para.style.visibility = "visible";
    playOnEnter(para, gsap.timeline({ paused: true }).from(chars, { opacity: 0, duration: 0.5, ease: "power1.out", stagger: { amount: 0.8 } }));
  });
  root.querySelectorAll<HTMLElement>('[data-split="fade"]').forEach((heading) => {
    const { chars } = SplitText.create(heading, { type: "words,chars" });
    playOnEnter(heading, gsap.timeline({ paused: true }).from(chars, { opacity: 0, duration: 0.3, ease: "power1.out", stagger: { amount: 0.8 } }));
  });
}

export function navMorph(root: HTMLElement) {
  const nav = root.querySelector<HTMLElement>(".sky-nav");
  const track = root.querySelector<HTMLElement>(".sky-track");
  if (!nav || !track) return;
  const bone = getComputedStyle(root).getPropertyValue("--sky-bone").trim();
  const width = window.innerWidth;
  const ctaFrom = width <= 767 ? "60%" : width <= 991 ? "50%" : "20%";
  const ctaTo = width <= 767 ? "60%" : "250px";
  gsap
    .timeline({
      defaults: { duration: 1, ease: "power1.inOut" },
      scrollTrigger: { trigger: track, start: () => `top top+=${nav.offsetHeight}`, end: "top top", scrub: true, invalidateOnRefresh: true },
    })
    .fromTo(".sky-nav__grid", { maxWidth: "85rem" }, { maxWidth: "100%", color: bone })
    .to(".sky-nav__logo", { width: 70 }, "<")
    .fromTo(".sky-nav__bg", { yPercent: 100 }, { yPercent: 0, y: "-1.5rem" }, "<")
    .to(".sky-nav .sky-line", { opacity: 0 }, "<")
    .fromTo(".sky-nav__cta", { width: ctaFrom }, { width: ctaTo, borderColor: bone }, "<")
    .to(".sky-nav__brand", { borderColor: bone }, "<")
    .to(".sky-nav", { y: "-1.5rem", duration: 0.5 }, "<+0.5");
}

export function trackFlip(root: HTMLElement) {
  const track = root.querySelector(".sky-track");
  if (!track) return;
  gsap
    .timeline({ scrollTrigger: { trigger: track, start: "top top", end: "bottom bottom", scrub: true } })
    .to(".sky-attacks", { rotateX: -90, transformPerspective: 1000, duration: 1 }, 0.2)
    .from(".sky-features__heading", { y: "60vh", duration: 0.5 }, 0.1)
    .from(".sky-features__grid", { y: "10rem", opacity: 0, duration: 0.2 }, 0.5);
}

export function archLines(root: HTMLElement) {
  const diagram = root.querySelector(".sky-arch__diagram");
  if (!diagram) return;
  gsap.fromTo(
    ".sky-arch-line",
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, ease: "power1.inOut", stagger: 0.15, scrollTrigger: { trigger: diagram, start: "bottom bottom", end: "top 30%", scrub: true } },
  );
}

export function footerRise(root: HTMLElement) {
  const footer = root.querySelector(".sky-footer");
  if (!footer) return;
  gsap.from(".sky-footer__wordmark", { yPercent: 100, duration: 1, delay: 0.5, ease: "power1.out", scrollTrigger: { trigger: footer, start: "top 75%" } });
}
