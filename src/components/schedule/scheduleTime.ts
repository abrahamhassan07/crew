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
