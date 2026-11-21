import { useEffect, useMemo, useRef, useState } from 'react';

export interface GlobeMarker {
  label: string;
  color: string;
  lat: number;
  lon: number;
}

export const GLOBE_MARKERS: readonly GlobeMarker[] = [
  { label: 'Local-First', color: '#4ade80', lat: 38, lon: 20 },
  { label: 'Quick Note', color: '#f472b6', lat: 20, lon: 62 },
  { label: 'Widgets', color: '#fb923c', lat: 8, lon: 18 },
  { label: 'Privacy', color: '#22d3ee', lat: 18, lon: -62 },
  { label: 'Multitasking', color: '#f87171', lat: -8, lon: 58 },
  { label: 'Markdown', color: '#60a5fa', lat: -28, lon: -48 },
  { label: 'Calm Workspace', color: '#fde9c8', lat: -34, lon: 42 },
];

export const GLOBE_DOT_COUNT = 750;
export const GLOBE_SIZE = 300;
const BURST_DOT_STRENGTH = 0.45;
const BURST_MARKER_STRENGTH = 0.8;
const BURST_DECAY = 0.93;
const BURST_HOLD_MS = 700;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function fibonacciPoints(n: number): Vec3[] {
  const pts: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

function rotate(p: Vec3, lon: number, tilt: number): Vec3 {
  const lo = (lon * Math.PI) / 180;
  const ti = (tilt * Math.PI) / 180;
  const x1 = p.x * Math.cos(lo) + p.z * Math.sin(lo);
  const z1 = -p.x * Math.sin(lo) + p.z * Math.cos(lo);
  const y2 = p.y * Math.cos(ti) - z1 * Math.sin(ti);
  const z2 = p.y * Math.sin(ti) + z1 * Math.cos(ti);
  return { x: x1, y: y2, z: z2 };
}

function projectPoint(p: Vec3, lon: number, tilt: number, radius: number) {
  const r = rotate(p, lon, tilt);
  return { x: r.x * radius, y: -r.y * radius, z: r.z };
}

function latLonToVec(lat: number, lon: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return { x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo) };
}

function applyBurst(x: number, y: number, burst: number, strength: number) {
  const s = 1 + burst * strength;
  return { x: x * s, y: y * s };
}

export function GlobeView({ size = GLOBE_SIZE }: { size?: number }) {
  const [lon, setLon] = useState(0);
  const [tilt, setTilt] = useState(18);
  const [burst, setBurst] = useState(0);

  const lonRef = useRef(0);
  const tiltRef = useRef(18);
  const burstRef = useRef(0);
  const holdUntilRef = useRef(0);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, lon: 0, tilt: 18, moved: false });

  const radius = size / 2;
  const base = useMemo(() => fibonacciPoints(GLOBE_DOT_COUNT), []);

  const fireBurst = (power: number) => {
    burstRef.current = power;
    holdUntilRef.current = Date.now() + BURST_HOLD_MS;
    setBurst(power);
  };

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = Date.now();
      if (now - last < 40) return;
      last = now;
      if (now < holdUntilRef.current) {
        // hold scatter briefly
      } else if (burstRef.current > 0.01) {
        burstRef.current *= BURST_DECAY;
        setBurst(burstRef.current);
      } else if (burstRef.current !== 0) {
        burstRef.current = 0;
        setBurst(0);
      }
      if (!dragging.current) {
        lonRef.current = (lonRef.current + 0.8) % 360;
        setLon(lonRef.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dots = useMemo(() => {
    const out: { x: number; y: number; o: number }[] = [];
    for (const p of base) {
      const q = projectPoint(p, lon, tilt, radius);
      if (q.z <= 0) continue;
      const b = applyBurst(q.x, q.y, burst, BURST_DOT_STRENGTH);
      out.push({ x: b.x, y: b.y, o: (0.35 + 0.65 * q.z) * (1 - burst * 0.3) });
    }
    return out;
  }, [base, lon, tilt, radius, burst]);

  const markers = useMemo(
    () =>
      GLOBE_MARKERS.map((m) => {
        const q = projectPoint(latLonToVec(m.lat, m.lon), lon, tilt, radius);
        const b = applyBurst(q.x, q.y, burst, BURST_MARKER_STRENGTH);
        return { ...m, x: b.x, y: b.y, front: q.z > 0 };
      }),
    [lon, tilt, radius, burst]
  );

  return (
    <div
      role="img"
      aria-label="Interactive globe. Drag to rotate, click to burst."
      onPointerDown={(e) => {
        dragging.current = true;
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          lon: lonRef.current,
          tilt: tiltRef.current,
          moved: false,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          dragStart.current.moved = true;
        }
        lonRef.current = (dragStart.current.lon + dx * 0.35) % 360;
        tiltRef.current = Math.max(-40, Math.min(40, dragStart.current.tilt - dy * 0.2));
        setLon(lonRef.current);
        setTilt(tiltRef.current);
      }}
      onPointerUp={() => {
        dragging.current = false;
        if (!dragStart.current.moved) {
          fireBurst(0.65);
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: '#e8e8e8',
            left: radius + d.x - 1,
            top: radius + d.y - 1,
            opacity: d.o,
            pointerEvents: 'none',
          }}
        />
      ))}
      {markers.map((m) =>
        m.front ? (
          <div
            key={m.label}
            onClick={(e) => {
              e.stopPropagation();
              fireBurst(1);
            }}
            style={{
              position: 'absolute',
              left: radius + m.x,
              top: radius + m.y,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: m.color,
                boxShadow: `0 0 8px ${m.color}`,
              }}
            />
            <span style={{ color: '#c8c8c8', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}>
              {m.label}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}
