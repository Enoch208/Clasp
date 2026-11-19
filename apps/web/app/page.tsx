import { Architecture } from "@/components/landing/Architecture";
import { AttackTrack } from "@/components/landing/AttackTrack";
import { Changelog } from "@/components/landing/Changelog";
import { ErrorMarquee } from "@/components/landing/ErrorMarquee";
import { Hero } from "@/components/landing/Hero";
import { PaymentPaths } from "@/components/landing/PaymentPaths";
import { SkyAir } from "@/components/landing/SkyAir";
import { SkyFooter } from "@/components/landing/SkyFooter";
import { SkyMotion } from "@/components/landing/SkyMotion";
import { SkyNav } from "@/components/landing/SkyNav";

export default function Home() {
  return (
    <main className="sky">
      <SkyMotion />
      <SkyAir className="sky-hero-bg" priority />
      <Hero />
      <SkyNav />
      <AttackTrack />
      <PaymentPaths />
      <ErrorMarquee />
      <Architecture />
      <Changelog />
      <SkyFooter />
    </main>
  );
}
