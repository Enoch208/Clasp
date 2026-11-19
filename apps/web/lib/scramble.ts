const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz<>[]()/:;.-_?!%$*+=#&@";

export function setCode(el: HTMLElement, code: string) {
  const parts = code.split("_");
  el.replaceChildren(
    ...parts.flatMap((part, index) => (index < parts.length - 1 ? [`${part}_`, document.createElement("wbr")] : [part])),
  );
}

export function scrambleTo(el: HTMLElement, text: string, durationMs: number, asCode: boolean, running: Set<() => void>) {
  const started = performance.now();
  const finish = () => {
    window.clearInterval(timer);
    running.delete(stop);
    if (asCode) setCode(el, text);
    else el.textContent = text;
  };
  const stop = () => {
    window.clearInterval(timer);
    running.delete(stop);
  };
  const timer = window.setInterval(() => {
    if (performance.now() - started >= durationMs) {
      finish();
      return;
    }
    let noise = "";
    for (let i = 0; i < text.length; i += 1) noise += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    el.textContent = noise;
  }, 50);
  running.add(stop);
}
