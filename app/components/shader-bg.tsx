"use client";

import { useEffect, useRef } from "react";

/**
 * Native WebGL background: the superserif wordmark flowing like fabric —
 * domain-warped texture sampling, one pass, one draw call.
 * Optimisations: fullscreen triangle, DPR capped at 1.5, paused when the tab
 * is hidden, static frame under prefers-reduced-motion, mipmapped POT texture.
 */

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform sampler2D u_tex;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  float t = u_t * 0.05;

  // slow fabric waves
  vec2 q = vec2(
    fbm(p * 0.9 + vec2(t * 1.1, t * 0.5)),
    fbm(p * 0.9 - vec2(t * 0.6, t * 0.9))
  );
  vec2 w = q - 0.5;

  // the wordmark nearly fills the width, slightly tilted; waves push it like cloth
  vec2 r = mat2(0.9945, -0.1045, 0.1045, 0.9945) * p; // ~6 degrees
  vec2 luv = vec2(r.x * 0.32, r.y * 0.85) + w * vec2(0.10, 0.22);
  float ink = texture2D(u_tex, luv + 0.5).a;

  // soft sheen driven by the same field
  float shade = fbm(p * 1.6 + q * 1.5 - t * 0.8);
  vec3 col = vec3(0.03) + 0.025 * shade;
  col += ink * mix(0.22, 0.6, shade);

  // vignette
  col *= 1.0 - 0.6 * smoothstep(0.4, 1.15, length(uv - 0.5) * 1.5);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function ShaderBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    if (!gl) return; // CSS dark background remains as the fallback

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // fullscreen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_res");
    const uT = gl.getUniformLocation(program, "u_t");
    const uTex = gl.getUniformLocation(program, "u_tex");

    // wordmark texture — POT canvas so REPEAT + mipmaps work
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    let texReady = false;
    const img = new Image();
    img.src = "/logo-superserif.svg";
    img.onload = () => {
      const pot = document.createElement("canvas");
      pot.width = 2048;
      pot.height = 512;
      const ctx = pot.getContext("2d")!;
      const margin = 128;
      const w = pot.width - margin * 2;
      const h = (w * img.height) / img.width;
      ctx.drawImage(img, margin, (pot.height - h) / 2, w, h);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pot);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      texReady = true;
      if (reduced) draw(8000); // a settled, static frame
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.max(1, Math.round(clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (reduced && texReady) draw(8000);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (ms: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, ms / 1000);
      gl.uniform1i(uTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    const frame = (ms: number) => {
      if (texReady) draw(ms);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!reduced && raf === 0) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      // never loseContext() here: under StrictMode the remount would
      // reacquire the same, permanently lost context and paint white
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 size-full bg-[#0a0a0a]"
    />
  );
}
