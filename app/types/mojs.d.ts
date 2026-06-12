declare module "@mojs/core" {
  // mo.js ships no TypeScript types; the surface we use is tiny.
  interface Playable {
    play(): Playable;
  }
  interface MojsStatic {
    Burst: new (options: Record<string, unknown>) => Playable;
    Shape: new (options: Record<string, unknown>) => Playable;
  }
  const mojs: MojsStatic;
  export default mojs;
}
