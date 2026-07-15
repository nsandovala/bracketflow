"use client";

import { useEffect, useRef } from "react";

type GedeonHeroFXProps = {
  className?: string;
  traceCount?: number;
  emberDensity?: number;
  emberTealChance?: number;
  originX?: number;
  originY?: number;
};

type Point = { x: number; y: number };

type Segment = {
  from: Point;
  to: Point;
  length: number;
  start: number;
  end: number;
};

type Trace = {
  color: string;
  alpha: number;
  width: number;
  pulseSpan: number;
  speed: number;
  offset: number;
  segments: Segment[];
  joints: Point[];
  totalLength: number;
};

type Ember = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
};

const GOLD = "#E8B54D";
const TEAL = "#2DD4BF";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (threshold: number) => Math.random() < threshold;

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const numeric = Number.parseInt(value, 16);
  const r = (numeric >> 16) & 255;
  const g = (numeric >> 8) & 255;
  const b = numeric & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildSegments(points: Point[]) {
  const segments: Segment[] = [];
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);

    segments.push({
      from,
      to,
      length,
      start: total,
      end: total + length,
    });

    total += length;
  }

  return { segments, total };
}

function pointAtDistance(trace: Trace, distance: number) {
  const target = clamp(distance, 0, trace.totalLength);

  for (const segment of trace.segments) {
    if (target <= segment.end) {
      const local = segment.length === 0 ? 0 : (target - segment.start) / segment.length;

      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * local,
        y: segment.from.y + (segment.to.y - segment.from.y) * local,
      };
    }
  }

  return trace.segments[trace.segments.length - 1]?.to ?? { x: 0, y: 0 };
}

function traceSlicePoints(trace: Trace, start: number, end: number) {
  const from = clamp(Math.min(start, end), 0, trace.totalLength);
  const to = clamp(Math.max(start, end), 0, trace.totalLength);
  const points: Point[] = [pointAtDistance(trace, from)];

  for (const segment of trace.segments) {
    if (segment.end <= from || segment.start >= to) continue;
    if (segment.end < to) {
      points.push(segment.to);
    }
  }

  points.push(pointAtDistance(trace, to));
  return points;
}

function drawPolyline(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }

  ctx.stroke();
}

function createTrace(
  width: number,
  height: number,
  origin: Point,
  mobile: boolean,
  side: -1 | 1,
) {
  const helmetScale = Math.min(width, height);
  const helmetRx = helmetScale * (mobile ? 0.118 : 0.108);
  const helmetRy = helmetScale * (mobile ? 0.176 : 0.186);
  const contourPad = helmetScale * (mobile ? 0.03 : 0.036);
  const angle =
    side === 1
      ? rand(-Math.PI * 0.34, Math.PI * 0.34)
      : rand(Math.PI * 0.66, Math.PI * 1.34);

  const start = {
    x: origin.x + Math.cos(angle) * (helmetRx + contourPad),
    y: origin.y + Math.sin(angle) * (helmetRy + contourPad),
  };

  const outwardX = (start.x - origin.x) / (helmetRx + contourPad);
  const outwardY = (start.y - origin.y) / (helmetRy + contourPad);
  const horizontalSide = outwardX >= 0 ? 1 : -1;

  const points: Point[] = [start];
  const steps = mobile ? 3 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2);
  let cursor = start;

  for (let step = 0; step < steps; step += 1) {
    const segmentLength = rand(mobile ? 28 : 40, mobile ? 72 : 118);
    const mode =
      step === 0
        ? Math.abs(outwardY) > Math.abs(outwardX) * 1.15
          ? outwardY < 0
            ? "v-up"
            : "v-down"
          : Math.abs(outwardY) > Math.abs(outwardX) * 0.45
            ? outwardY < 0
              ? "diag-up"
              : "diag-down"
            : "h"
        : (["h", "diag-up", "diag-down", "v"] as const)[Math.floor(Math.random() * 4)];

    let dx = 0;
    let dy = 0;

    if (mode === "h") {
      dx = horizontalSide * segmentLength;
    } else if (mode === "v-up") {
      dy = -segmentLength * 0.8;
    } else if (mode === "v-down") {
      dy = segmentLength * 0.8;
    } else if (mode === "v") {
      dy = (chance(0.5) ? -1 : 1) * segmentLength * 0.72;
    } else {
      dx = horizontalSide * segmentLength * 0.74;
      dy = (mode === "diag-up" ? -1 : 1) * segmentLength * 0.74;
    }

    const next = {
      x: clamp(cursor.x + dx, width * 0.04, width * 0.96),
      y: clamp(cursor.y + dy, height * 0.1, height * 0.78),
    };

    if (Math.hypot(next.x - cursor.x, next.y - cursor.y) < 18) {
      continue;
    }

    points.push(next);
    cursor = next;
  }

  const { segments, total } = buildSegments(points);

  return {
    color: chance(0.38) ? TEAL : GOLD,
    alpha: mobile ? rand(0.1, 0.18) : rand(0.12, 0.22),
    width: mobile ? rand(0.85, 1.15) : rand(0.9, 1.35),
    pulseSpan: rand(34, 72),
    speed: rand(36, 68),
    offset: rand(0, total || 1),
    joints: points.slice(1, -1),
    segments,
    totalLength: total,
  } satisfies Trace;
}

function createEmber(width: number, height: number, mobile: boolean, emberTealChance: number): Ember {
  return {
    x: rand(-width * 0.04, width * 1.04),
    y: rand(height * 0.74, height * 1.08),
    radius: rand(0.8, mobile ? 2.1 : 2.8),
    vx: rand(-0.08, 0.08),
    vy: rand(mobile ? 0.1 : 0.14, mobile ? 0.26 : 0.42),
    alpha: rand(mobile ? 0.16 : 0.2, mobile ? 0.34 : 0.46),
    color: chance(emberTealChance) ? TEAL : GOLD,
  };
}

export default function GedeonHeroFX({
  className,
  traceCount = 18,
  emberDensity = 46,
  emberTealChance = 0.18,
  originX = 0.5,
  originY = 0.42,
}: GedeonHeroFXProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    let raf = 0;
    let width = 0;
    let height = 0;
    let mobile = false;
    let traces: Trace[] = [];
    let embers: Ember[] = [];
    let resizeDebounce = 0;
    let inViewport = true;
    let documentVisible = !document.hidden;
    let isRunning = false;
    let animationTimeMs = 0;
    let lastFrameTime = 0;

    const drawTraceBase = (trace: Trace) => {
      ctx.strokeStyle = hexToRgba(trace.color, trace.alpha);
      ctx.lineWidth = trace.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawPolyline(
        ctx,
        trace.segments.flatMap((segment, index) =>
          index === 0 ? [segment.from, segment.to] : [segment.to],
        ),
      );

      for (const joint of trace.joints) {
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, trace.width * 1.25, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(trace.color, trace.alpha * 0.72);
        ctx.fill();
      }
    };

    const drawTracePulse = (trace: Trace, timeMs: number) => {
      const cycleLength = trace.totalLength + trace.pulseSpan * 1.8;
      const end = ((timeMs * 0.001 * trace.speed) + trace.offset) % cycleLength;

      if (end > trace.totalLength || trace.totalLength <= 0) {
        return;
      }

      const start = Math.max(0, end - trace.pulseSpan);
      const points = traceSlicePoints(trace, start, end);

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 12;
      ctx.shadowColor = hexToRgba(trace.color, 0.48);
      ctx.strokeStyle = hexToRgba(trace.color, 0.42);
      ctx.lineWidth = trace.width + 1.5;
      drawPolyline(ctx, points);

      ctx.shadowBlur = 0;
      ctx.strokeStyle = hexToRgba(trace.color, 0.92);
      ctx.lineWidth = trace.width;
      drawPolyline(ctx, points);
      ctx.restore();
    };

    const drawEmber = (ember: Ember) => {
      const gradient = ctx.createRadialGradient(
        ember.x,
        ember.y,
        0,
        ember.x,
        ember.y,
        ember.radius * 5.5,
      );

      gradient.addColorStop(0, hexToRgba(ember.color, ember.alpha));
      gradient.addColorStop(0.35, hexToRgba(ember.color, ember.alpha * 0.42));
      gradient.addColorStop(1, hexToRgba(ember.color, 0));

      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.radius * 5.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.radius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(ember.color, ember.alpha * 0.95);
      ctx.fill();
    };

    const stopAnimation = () => {
      isRunning = false;
      lastFrameTime = 0;

      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const rebuildScene = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      mobile = width <= 768;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const origin = {
        x: width * originX,
        y: height * (mobile ? Math.min(originY, 0.38) : originY),
      };

      const targetTraceCount = mobile ? Math.max(10, Math.round(traceCount * 0.58)) : traceCount;
      const targetEmberCount = mobile ? Math.max(24, Math.round(emberDensity * 0.52)) : emberDensity;

      traces = Array.from({ length: targetTraceCount }, (_, index) =>
        createTrace(width, height, origin, mobile, index % 2 === 0 ? -1 : 1),
      ).filter((trace) => trace.totalLength > 0);

      embers = Array.from({ length: targetEmberCount }, () =>
        createEmber(width, height, mobile, emberTealChance),
      );
    };

    const render = (timeMs: number, animate: boolean) => {
      ctx.clearRect(0, 0, width, height);

      for (const trace of traces) {
        drawTraceBase(trace);
      }

      for (const ember of embers) {
        if (animate) {
          ember.x += ember.vx;
          ember.y -= ember.vy;

          if (ember.y < height * 0.18 || ember.x < -width * 0.08 || ember.x > width * 1.08) {
            Object.assign(ember, createEmber(width, height, mobile, emberTealChance));
          }
        }

        drawEmber(ember);
      }

      if (!animate) {
        return;
      }

      for (const trace of traces) {
        drawTracePulse(trace, timeMs);
      }
    };

    const tick = (timeMs: number) => {
      if (!isRunning) {
        return;
      }

      if (lastFrameTime === 0) {
        lastFrameTime = timeMs;
      }

      const deltaMs = Math.min(timeMs - lastFrameTime, 48);
      lastFrameTime = timeMs;
      animationTimeMs += Math.max(deltaMs, 0);

      render(animationTimeMs, true);
      raf = window.requestAnimationFrame(tick);
    };

    const syncPlayback = () => {
      const shouldAnimate = !reducedMotion && inViewport && documentVisible;

      if (!shouldAnimate) {
        stopAnimation();
        render(animationTimeMs, false);
        return;
      }

      if (isRunning) {
        return;
      }

      isRunning = true;
      lastFrameTime = 0;
      raf = window.requestAnimationFrame(tick);
    };

    const syncMotionPreference = () => {
      reducedMotion = media.matches;
      syncPlayback();
    };

    const queueRebuild = () => {
      window.clearTimeout(resizeDebounce);
      resizeDebounce = window.setTimeout(() => {
        rebuildScene();
        render(animationTimeMs, false);
        syncPlayback();
      }, 180);
    };

    rebuildScene();
    render(animationTimeMs, false);
    syncPlayback();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            queueRebuild();
          })
        : null;

    resizeObserver?.observe(canvas);

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              inViewport = entry?.isIntersecting ?? true;
              syncPlayback();
            },
            { threshold: 0.01 },
          )
        : null;

    intersectionObserver?.observe(canvas);

    const handleResize = () => {
      queueRebuild();
    };

    const handleVisibilityChange = () => {
      documentVisible = !document.hidden;
      syncPlayback();
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    media.addEventListener("change", syncMotionPreference);

    return () => {
      stopAnimation();
      window.clearTimeout(resizeDebounce);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      media.removeEventListener("change", syncMotionPreference);
    };
  }, [emberDensity, emberTealChance, originX, originY, traceCount]);

  return <canvas ref={canvasRef} className={className ?? "bf-home-hero-fx"} aria-hidden="true" />;
}
