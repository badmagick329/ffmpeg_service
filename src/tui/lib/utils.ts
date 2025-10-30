export function humanReadableTimeDelta(startTime: number): string {
  const { hours, minutes } = timeDeltaInHoursAndMinutes(startTime);
  if (hours === 0 && minutes === 0) {
    return "less than a min ago";
  }
  return hours > 0 ? `${hours}h${minutes}m ago` : `${minutes}m ago`;
}

export function timeDeltaInHoursAndMinutes(startTime: number): {
  hours: number;
  minutes: number;
} {
  const now = Date.now();
  const delta = now - startTime;

  if (delta >= 1000 * 60 * 60) {
    const hours = Math.floor(delta / (1000 * 60 * 60));
    const remainingMs = delta % (1000 * 60 * 60);
    const minutes = Math.round(remainingMs / (1000 * 60));
    return minutes === 60 ? { hours, minutes: 0 } : { hours, minutes };
  }
  if (delta >= 1000 * 60) {
    return { hours: 0, minutes: Math.round(delta / (1000 * 60)) };
  }
  return { hours: 0, minutes: 0 };
}
