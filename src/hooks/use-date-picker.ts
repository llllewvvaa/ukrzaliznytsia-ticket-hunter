import { useEffect, useRef, useState } from 'react';
import { DEFAULT_HOUR, parseValue } from '@/lib/format/date';

const TIME_ROW_PX = 28; // h-7 — keep in sync with the time-column buttons

// Selection state for the DatePicker panel: the viewed month plus the picked
// hour/minute, re-synced from `value` each time the panel opens, with the time
// columns scroll-centered on the selected row.
export function useDatePicker(value: string, withTime: boolean) {
  const [open, setOpen] = useState(false);
  const hoursBoxRef = useRef<HTMLDivElement>(null);
  const minutesBoxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const initial = parseValue(value) ?? {
    y: now.getFullYear(),
    m: now.getMonth(),
    d: now.getDate(),
    hh: DEFAULT_HOUR,
    mm: 0,
  };
  const [vy, setVy] = useState(initial.y);
  const [vm, setVm] = useState(initial.m);
  const [hh, setHh] = useState(initial.hh);
  const [mm, setMm] = useState(initial.mm);

  const openCalendar = (): void => {
    const p = parseValue(value);
    if (p) {
      setVy(p.y);
      setVm(p.m);
      setHh(p.hh);
      setMm(p.mm);
    }
    setOpen(true);
  };

  // Center the selected hour/minute in the scroll columns when the panel opens.
  // hh/mm are deps for lint completeness, but the just-opened guard keeps
  // re-centering strictly on the closed→open transition.
  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened || !withTime) return;
    const center = (box: HTMLDivElement | null, idx: number): void => {
      if (box)
        box.scrollTop = Math.max(0, idx * TIME_ROW_PX - (box.clientHeight - TIME_ROW_PX) / 2);
    };
    center(hoursBoxRef.current, hh);
    center(minutesBoxRef.current, mm);
  }, [open, withTime, hh, mm]);

  return {
    open,
    setOpen,
    openCalendar,
    vy,
    setVy,
    vm,
    setVm,
    hh,
    setHh,
    mm,
    setMm,
    hoursBoxRef,
    minutesBoxRef,
  };
}
