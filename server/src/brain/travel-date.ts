// The day that matters to the owner is the day the train is at their own
// station. A ticket bought from an earlier station is searched by that
// station's departure date, and a train leaving it in the evening can pass the
// owner's city after midnight, so the search date and the travel date differ.
export function kyivDate(unixSeconds: number): string {
  const shifted = new Date(unixSeconds * 1_000 + kyivOffsetMs(unixSeconds));
  return shifted.toISOString().slice(0, 10);
}

function kyivOffsetMs(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1_000);
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return local.getTime() - utc.getTime();
}

export function travelDate(searchDate: string, boardAt: number): string {
  return boardAt > 0 ? kyivDate(boardAt) : searchDate;
}
