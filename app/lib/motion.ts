/** Gratification layer — mo.js bursts, gated behind prefers-reduced-motion. */

export function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The system's only celebration: a project just shipped. */
export async function celebrateAt(x: number, y: number): Promise<void> {
  if (reducedMotion()) return;
  const mojs = (await import("@mojs/core")).default;
  new mojs.Burst({
    left: x,
    top: y,
    radius: { 4: 42 },
    count: 12,
    children: {
      shape: "circle",
      radius: { 4: 0 },
      fill: ["#0a8a5f", "#0a8a5f", "#222222"],
      duration: 650,
      easing: "quad.out",
    },
  }).play();
}

/** A quiet ring when a new project's name is confirmed. */
export async function ringAt(x: number, y: number): Promise<void> {
  if (reducedMotion()) return;
  const mojs = (await import("@mojs/core")).default;
  new mojs.Shape({
    left: x,
    top: y,
    shape: "circle",
    radius: { 8: 28 },
    fill: "none",
    stroke: "#222222",
    strokeWidth: { 2: 0 },
    opacity: { 0.5: 0 },
    duration: 450,
    easing: "quad.out",
  }).play();
}
