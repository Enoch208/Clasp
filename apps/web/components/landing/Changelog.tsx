import Image from "next/image";
import { LINKS, NEWS } from "@/lib/landing";
import { SkyButton } from "./SkyButton";

export function Changelog() {
  return (
    <section className="sky-news sky-scanlines" aria-labelledby="sky-news-title">
      <div className="sky-pad">
        <div className="sky-wrap-l sky-section-pad">
          <h3 id="sky-news-title">What’s new</h3>
          <div className="sky-news__list">
            {NEWS.map((item) => (
              <a className="sky-news__item" href={item.href} target="_blank" rel="noreferrer" key={item.title}>
                <span className="sky-news__thumb">
                  <Image src={item.thumb} alt="" fill sizes="(max-width: 767px) 100vw, 10rem" />
                </span>
                <span className="sky-news__body">
                  <span className="sky-news__title">{item.title}</span>
                  <span className="sky-news__date">{item.date}</span>
                </span>
              </a>
            ))}
          </div>
          <SkyButton href={LINKS.github} variant="row">
            &gt; Everything on GitHub
          </SkyButton>
        </div>
      </div>
    </section>
  );
}
