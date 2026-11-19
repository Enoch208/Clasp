import { getImageProps } from "next/image";
import { SKY_MEDIA } from "@/lib/landing";

export function SkyAir({ className, priority = false }: { className: string; priority?: boolean }) {
  const common = { alt: "", sizes: "100vw", priority };
  const {
    props: { srcSet: wide },
  } = getImageProps({ ...common, src: SKY_MEDIA.still, width: 3840, height: 2160, quality: 80 });
  const {
    props: { srcSet: tall, ...img },
  } = getImageProps({ ...common, src: SKY_MEDIA.phone, width: 1290, height: 2796, quality: 75 });

  return (
    <div className={`${className} sky-air`} aria-hidden="true">
      <picture>
        <source media="(min-width: 768px)" srcSet={wide} />
        <source srcSet={tall} />
        <img {...img} alt="" />
      </picture>
      <video data-sky-video muted loop playsInline preload="none">
        <source src={SKY_MEDIA.video} type="video/mp4" media="(min-width: 768px)" />
      </video>
    </div>
  );
}
