import { AttackField } from "./AttackField";
import { Features } from "./Features";
import { SkyAir } from "./SkyAir";

export function AttackTrack() {
  return (
    <div className="sky-track">
      <div className="sky-track__stage">
        <section className="sky-attacks" aria-label="Attacks the policy engine rejects">
          <div className="sky-attacks__texture" aria-hidden="true" />
          <AttackField />
        </section>
      </div>
      <SkyAir className="sky-track__sky" />
      <div className="sky-track__spacer" aria-hidden="true" />
      <Features />
    </div>
  );
}
