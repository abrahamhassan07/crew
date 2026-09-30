// Shared time-grid math for the Schedule calendar views.
export const GRID_START_MIN = 6 * 60; // 6:00am
export const GRID_END_MIN = 20 * 60; // 8:00pm
export const HOUR_PX = 56;
export const GRID_HOURS = Array.from({ length: (GRID_END_MIN - GRID_START_MIN) / 60 + 1 }, (_, i) => 6 + i);
export const GRID_HEIGHT_PX = ((GRID_END_MIN - GRID_START_MIN) / 60) * HOUR_PX;

export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function blockTop(startTime: string) {
  const mins = timeToMinutes(startTime);
  return Math.max(0, ((mins - GRID_START_MIN) / 60) * HOUR_PX);
}

export function blockHeight(durationMinutes: number) {
  return Math.max(22, (durationMinutes / 60) * HOUR_PX - 2);
}

export function fmtHourLabel(hour: number) {
  const h = hour % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12} ${ampm}`;
}

export function nowOffsetPx(): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < GRID_START_MIN || mins > GRID_END_MIN) return null;
  return ((mins - GRID_START_MIN) / 60) * HOUR_PX;
}

export interface OverlapLayout {
  col: number;
  cols: number;
}

/**
 * Assigns each job a column index + column count so jobs whose time ranges
 * overlap render side-by-side instead of stacking on top of each other.
 * Groups mutually-overlapping jobs into clusters, then greedily assigns the
 * smallest free column within each cluster (standard interval-graph-coloring
 * layout, same idea most calendar UIs use) — every job in a cluster gets the
 * cluster's column count, not just however many it personally overlaps.
 */
export function layoutOverlaps<T extends { id: string; start_time: string | null; duration_minutes: number }>(
  jobs: T[],
): Map<string, OverlapLayout> {
  const result = new Map<string, OverlapLayout>();

  const items = jobs
    .filter((j) => j.start_time != null)
    .map((j) => {
      const start = timeToMinutes(j.start_time!);
      return { job: j, start, end: start + j.duration_minutes };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: typeof items = [];
  let clusterEnd = -Infinity;
  const clusters: (typeof items)[] = [];

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) {
      clusters.push(cluster);
      cluster = [];
      clusterEnd = -Infinity;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) clusters.push(cluster);

  for (const cl of clusters) {
    const columnEnds: number[] = [];
    const assigned: { id: string; col: number }[] = [];
    for (const item of cl) {
      let col = columnEnds.findIndex((end) => item.start >= end);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.end);
      } else {
        columnEnds[col] = item.end;
      }
      assigned.push({ id: item.job.id, col });
    }
    const cols = columnEnds.length;
    for (const { id, col } of assigned) result.set(id, { col, cols });
  }

  return result;
}
