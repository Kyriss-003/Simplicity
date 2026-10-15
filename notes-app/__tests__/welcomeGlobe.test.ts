import {
  fibonacciPoints,
  projectPoint,
  latLonToVec,
  isFront,
  applyBurst,
  BURST_DECAY,
  BURST_HOLD_MS,
  BURST_DOT_STRENGTH,
  BURST_MARKER_STRENGTH,
  GLOBE_MARKERS,
  GLOBE_DOT_COUNT,
} from '../src/components/welcome/GlobeView';

describe('welcome globe', () => {
  it('generates the budgeted dot count on the unit sphere', () => {
    expect(GLOBE_DOT_COUNT).toBeLessThanOrEqual(1000);
    const pts = fibonacciPoints(GLOBE_DOT_COUNT);
    expect(pts).toHaveLength(GLOBE_DOT_COUNT);
    for (const p of pts) {
      const len = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('culls the back hemisphere (about half the dots visible)', () => {
    const pts = fibonacciPoints(GLOBE_DOT_COUNT);
    const visible = pts.filter((p) => isFront(projectPoint(p, 0, 18, 150).z));
    expect(visible.length).toBeGreaterThan(GLOBE_DOT_COUNT * 0.3);
    expect(visible.length).toBeLessThan(GLOBE_DOT_COUNT * 0.7);
  });

  it('rotating 360deg returns to the same projection', () => {
    const p = latLonToVec(10, 20);
    const a = projectPoint(p, 0, 18, 150);
    const b = projectPoint(p, 360, 18, 150);
    expect(b.x).toBeCloseTo(a.x, 8);
    expect(b.y).toBeCloseTo(a.y, 8);
  });

  it('ships all seven reference markers with distinct colors', () => {
    const labels = GLOBE_MARKERS.map((m) => m.label);
    expect(labels).toEqual([
      'Local-First',
      'Quick Note',
      'Widgets',
      'Privacy',
      'Multitasking',
      'Markdown',
      'Calm Workspace',
    ]);
    const colors = new Set(GLOBE_MARKERS.map((m) => m.color));
    expect(colors.size).toBe(GLOBE_MARKERS.length);
  });

  it('burst at rest is the identity, at full power spreads outward', () => {
    const atRest = applyBurst(40, -30, 0, BURST_DOT_STRENGTH);
    expect(atRest.x).toBeCloseTo(40, 8);
    expect(atRest.y).toBeCloseTo(-30, 8);
    const spread = applyBurst(40, -30, 1, BURST_DOT_STRENGTH);
    expect(Math.abs(spread.x)).toBeGreaterThan(Math.abs(40));
    expect(Math.abs(spread.y)).toBeGreaterThan(Math.abs(-30));
    expect(Math.sign(spread.x)).toBe(Math.sign(40));
  });

  it('the scatter holds before regrouping', () => {
    // The hold is a beat the eye can register, not a freeze: long enough to
    // read the scattered graph, short enough to feel alive.
    expect(BURST_HOLD_MS).toBeGreaterThanOrEqual(400);
    expect(BURST_HOLD_MS).toBeLessThanOrEqual(1500);
  });

  it('markers travel further than dust dots and the burst decays', () => {
    const dot = applyBurst(50, 50, 1, BURST_DOT_STRENGTH);
    const marker = applyBurst(50, 50, 1, BURST_MARKER_STRENGTH);
    expect(Math.abs(marker.x)).toBeGreaterThan(Math.abs(dot.x));
    let b = 1;
    for (let i = 0; i < 60; i++) b *= BURST_DECAY;
    expect(b).toBeLessThan(0.02);
  });

  it('a marker rotated to the back is culled', () => {
    const m = GLOBE_MARKERS[0];
    const front = projectPoint(latLonToVec(m.lat, m.lon), m.lon, 18, 150);
    const back = projectPoint(latLonToVec(m.lat, m.lon), m.lon + 180, 18, 150);
    expect(isFront(front.z)).toBe(true);
    expect(isFront(back.z)).toBe(false);
  });
});
