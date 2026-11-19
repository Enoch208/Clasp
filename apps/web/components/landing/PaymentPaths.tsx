"use client";

import { useEffect, useRef, useState } from "react";
import { PATHS, type PathId } from "@/lib/landing";
import { PathDiagram } from "./PathDiagram";

export function PaymentPaths() {
  const [active, setActive] = useState<PathId>("pay");
  const [touched, setTouched] = useState(false);
  const anchorsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchors = anchorsRef.current?.querySelectorAll<HTMLElement>("[data-path]");
    if (!anchors?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.getAttribute("data-path") as PathId);
        });
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    anchors.forEach((anchor) => observer.observe(anchor));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 992px)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (desktop || still || touched) return;
    const timer = window.setInterval(() => {
      setActive((current) => PATHS[(PATHS.findIndex((path) => path.id === current) + 1) % PATHS.length].id);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [touched]);

  function choose(id: PathId) {
    setTouched(true);
    setActive(id);
    const anchor = anchorsRef.current?.querySelector<HTMLElement>(`[data-path="${id}"]`);
    if (anchor && window.matchMedia("(min-width: 992px)").matches) {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <section className="sky-paths" aria-labelledby="sky-paths-title">
      <div className="sky-paths__texture sky-scanlines" aria-hidden="true" />
      <div className="sky-pad">
        <div className="sky-wrap-l sky-section-pad sky-paths__grid">
          <div className="sky-paths__menu">
            <h2 id="sky-paths-title" data-split="fade">
              How a payment gets through
            </h2>
            <div className="sky-paths__tabs" role="tablist" aria-label="Payment outcomes">
              {PATHS.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  role="tab"
                  id={`sky-tab-${path.id}`}
                  aria-selected={active === path.id}
                  aria-controls="sky-paths-panel"
                  className={`sky-tab sky-tab--${path.id}`}
                  onClick={() => choose(path.id)}
                >
                  <span className="sky-tab__heading">{path.title}</span>
                  <span className="sky-tab__body">
                    <span>
                      {path.lead}
                      <br />
                      <br />
                      <strong>{path.weight}</strong> {path.tail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="sky-paths__content" ref={anchorsRef}>
            <div className="sky-paths__anchors" aria-hidden="true">
              {PATHS.map((path) => (
                <div className="sky-paths__anchor" data-path={path.id} key={path.id} />
              ))}
            </div>
            <div className="sky-paths__art" id="sky-paths-panel" role="tabpanel" aria-labelledby={`sky-tab-${active}`}>
              <PathDiagram state={active} />
            </div>
          </div>
          <div className="sky-paths__mobile-art">
            <PathDiagram state={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
