"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "./icons";

const navItems = [
  ["Overview", "overview"],
  ["How it works", "flow"],
  ["Security", "security"],
  ["Revoke", "revoke"],
  ["Docs", "docs"],
] as const;

type SectionId = (typeof navItems)[number][1];

export function SiteHeader() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const sectionIds = navItems.map(([, id]) => id);
    const updateActiveSection = () => {
      const probeY = window.scrollY + 180;
      let current: SectionId = sectionIds[0];
      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= probeY) current = id;
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  const scrollToSection = (id: SectionId) => {
    const section = document.getElementById(id);
    if (!section) return;
    const header = document.querySelector<HTMLElement>(".of-header");
    const offset = window.matchMedia("(max-width: 680px)").matches ? (header?.offsetHeight ?? 0) : 0;
    setMobileMenuOpen(false);
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: Math.max(section.offsetTop - offset, 0), behavior: "smooth" });
  };

  return (
    <header className="of-header">
      <button type="button" className="of-header-brand" onClick={() => scrollToSection("overview")}>
        <span className="clasp-mark" aria-hidden="true" />
        <span>
          <strong>Clasp</strong>
          <small>App-to-wallet session layer</small>
        </span>
      </button>
      <div className="of-header-actions">
        <div className="of-header-status">
          <span>Network</span>
          <b>
            <i /> Fiber testnet
          </b>
        </div>
        <nav className="of-header-nav" aria-label="Sections">
          {navItems.map(([label, id]) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? "active" : ""}
              onClick={() => scrollToSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <Link className="of-header-launch" href="#start">
          <span className="of-header-launch-icon" aria-hidden="true">
            <ArrowRight />
          </span>
          <span className="of-header-launch-label">Try the demo</span>
        </Link>
      </div>
      <button
        className="of-menu-button"
        type="button"
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-section-menu"
        aria-label={mobileMenuOpen ? "Close section menu" : "Open section menu"}
        onClick={() => setMobileMenuOpen((value) => !value)}
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <div id="mobile-section-menu" className={`of-mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        {navItems.map(([label, id]) => (
          <button
            key={id}
            className={activeSection === id ? "active" : ""}
            type="button"
            onClick={() => scrollToSection(id)}
          >
            {label}
          </button>
        ))}
        <Link href="#start" onClick={() => setMobileMenuOpen(false)}>
          Try the demo
        </Link>
      </div>
    </header>
  );
}
