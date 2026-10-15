import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';

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

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function fibonacciPoints(n: number): Vec3[] {
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

export function projectPoint(
  p: Vec3,
  lon: number,
  tilt: number,
  radius: number,
): { x: number; y: number; z: number } {
  const r = rotate(p, lon, tilt);
  return { x: r.x * radius, y: -r.y * radius, z: r.z };
}

export function latLonToVec(lat: number, lon: number): Vec3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return { x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo) };
}

export function isFront(z: number): boolean {
  return z > 0;
}

/**
 * Burst displacement: pushes a projected point radially outward from the
 * globe centre, then the caller decays `burst` back to 0 so it springs home.
 * `strength` lets markers travel further than dust dots.
 */
export function applyBurst(
  x: number,
  y: number,
  burst: number,
  strength: number,
): { x: number; y: number } {
  const s = 1 + burst * strength;
  return { x: x * s, y: y * s };
}

export const BURST_DOT_STRENGTH = 0.45;
export const BURST_MARKER_STRENGTH = 0.8;
export const BURST_DECAY = 0.93;
/** How long the scatter holds at full spread before regrouping (ms). */
export const BURST_HOLD_MS = 700;

const DOT_R = GLOBE_SIZE / 2;

export function GlobeView({ size = GLOBE_SIZE }: { size?: number }) {
  const [lon, setLon] = useState(0);
  const [burst, setBurst] = useState(0);
  const tiltRef = useRef(18);
  const lonRef = useRef(0);
  const burstRef = useRef(0);
  const holdUntilRef = useRef(0);
  const dragging = useRef(false);
  const movedRef = useRef(false);
  const [, setTiltTick] = useState(0);
  const radius = size / 2;

  const base = useMemo(() => fibonacciPoints(GLOBE_DOT_COUNT), []);

  const fireBurst = (power: number) => {
    burstRef.current = power;
    // Hold the scatter at full spread briefly before regrouping.
    holdUntilRef.current = Date.now() + BURST_HOLD_MS;
    setBurst(power);
  };

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = Date.now();
      if (now - last < 66) return;
      last = now;
      if (now < holdUntilRef.current) {
        // Still in the hold phase: stay scattered, keep spinning.
      } else if (burstRef.current > 0.01) {
        burstRef.current *= BURST_DECAY;
        setBurst(burstRef.current);
      } else if (burstRef.current !== 0) {
        burstRef.current = 0;
        setBurst(0);
      }
      if (!dragging.current) {
        lonRef.current = (lonRef.current + 1.2) % 360;
        setLon(lonRef.current);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
        onPanResponderGrant: () => {
          dragging.current = true;
          movedRef.current = false;
        },
        onPanResponderMove: (_, g) => {
          movedRef.current = true;
          lonRef.current = (lonRef.current + g.dx * 0.15) % 360;
          tiltRef.current = Math.max(-40, Math.min(40, tiltRef.current - g.dy * 0.05));
          setLon(lonRef.current);
          setTiltTick((t) => t + 1);
        },
        onPanResponderRelease: (_, g) => {
          dragging.current = false;
          // A tap (no real travel) bursts the graph open instead of rotating.
          if (!movedRef.current && Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
            fireBurst(0.6);
          }
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
        },
      }),
    [],
  );

  const tilt = tiltRef.current;
  const dots = useMemo(() => {
    const out: { x: number; y: number; o: number }[] = [];
    for (const p of base) {
      const q = projectPoint(p, lon, tilt, radius);
      if (!isFront(q.z)) continue;
      const b = applyBurst(q.x, q.y, burst, BURST_DOT_STRENGTH);
      out.push({ x: b.x, y: b.y, o: (0.35 + 0.65 * q.z) * (1 - burst * 0.3) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, lon, tiltRef.current, burst]);

  const markers = useMemo(
    () =>
      GLOBE_MARKERS.map((m) => {
        const q = projectPoint(latLonToVec(m.lat, m.lon), lon, tilt, radius);
        const b = applyBurst(q.x, q.y, burst, BURST_MARKER_STRENGTH);
        return { ...m, x: b.x, y: b.y, front: isFront(q.z), depth: q.z };
      }),
    [lon, tilt, radius, burst],
  );

  return (
    <View
      style={[styles.globe, { width: size, height: size }]}
      {...pan.panHandlers}
      accessibilityRole="image"
      accessibilityLabel="Interactive globe. Drag to rotate, tap to burst."
    >
      {dots.map((d, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              left: radius + d.x - 1,
              top: radius + d.y - 1,
              opacity: d.o,
            },
          ]}
        />
      ))}
      {markers.map((m) =>
        m.front ? (
          <View
            key={m.label}
            style={[styles.marker, { left: radius + m.x, top: radius + m.y }]}
            onTouchEnd={() => fireBurst(1)}
          >
            <View style={[styles.markerDot, { backgroundColor: m.color }]} />
            <Text style={styles.markerLabel}>{m.label}</Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  globe: {
    position: 'relative',
    alignSelf: 'center',
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#e8e8e8',
  },
  marker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  markerLabel: {
    color: '#b8b8b8',
    fontSize: 12,
    fontWeight: '400',
  },
});

export { DOT_R };
