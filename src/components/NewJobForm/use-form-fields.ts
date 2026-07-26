import { useRef, useState } from 'react';
import { saleOpenDefault, todayPlus } from '@/lib/format/date';
import type { CoachType, JobMode, Station } from '@/lib/models';
import type { Berth, SeatSelection } from './types';

// Field values of the reserve wizard plus the setters that couple fields
// together (a seat pick locks train+class, a mode swap drops stale picks).
export function useFormFields() {
  const [name, setName] = useState('');
  const [showName, setShowName] = useState(false);
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDateRaw] = useState(todayPlus(30));
  const [trains, setTrains] = useState<string[]>([]);
  const [coachTypes, setCoachTypes] = useState<Array<CoachType | string>>([]);
  const [seatSelection, setSeatSelection] = useState<SeatSelection | null>(null);
  const [passengerIds, setPassengerIds] = useState<number[]>([]);
  const [bedding, setBedding] = useState(true);
  const [berth, setBerth] = useState<Berth>('any');
  const [adjacent, setAdjacent] = useState(false);
  const [avoidToilet, setAvoidToilet] = useState(false);
  const [airConditioned, setAirConditioned] = useState(false);
  const [mode, setMode] = useState<JobMode>('monitor');
  const [pollIntervalSec, setPollIntervalSec] = useState(15);
  const [startAt, setStartAtRaw] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('5');
  const [swapSpin, setSwapSpin] = useState(false);

  // Sale-open time auto-fills from the trip date (20 days before, 08:00) until
  // the user edits it manually; a manual edit is never overwritten.
  const startAtTouched = useRef(false);
  const setStartAt = (v: string): void => {
    startAtTouched.current = true;
    setStartAtRaw(v);
  };
  const setDate = (iso: string): void => {
    setDateRaw(iso);
    if (!startAtTouched.current) setStartAtRaw(saleOpenDefault(iso));
  };

  const toggleCoach = (v: CoachType | string): void =>
    setCoachTypes((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  // Exact seats lock the job to one train + class.
  const handleSelectSeats = (sel: SeatSelection): void => {
    setSeatSelection(sel);
    setTrains([sel.match.trainNumber]);
    setCoachTypes([sel.match.classId]);
  };

  const swapStations = (): void => {
    setFrom(to);
    setTo(from);
    setSwapSpin((s) => !s);
  };

  // Mode swaps the train step (live search vs pre-sale timetable); drop stale picks.
  const selectType = (nextMode: JobMode): void => {
    setMode(nextMode);
    setTrains([]);
    setSeatSelection(null);
    if (nextMode === 'scheduled' && !startAtTouched.current) {
      setStartAtRaw(saleOpenDefault(date));
    }
  };

  return {
    name,
    setName,
    showName,
    setShowName,
    from,
    setFrom,
    to,
    setTo,
    date,
    setDate,
    trains,
    setTrains,
    coachTypes,
    toggleCoach,
    seatSelection,
    setSeatSelection,
    passengerIds,
    setPassengerIds,
    bedding,
    setBedding,
    berth,
    setBerth,
    adjacent,
    setAdjacent,
    avoidToilet,
    setAvoidToilet,
    airConditioned,
    setAirConditioned,
    mode,
    selectType,
    pollIntervalSec,
    setPollIntervalSec,
    startAt,
    setStartAt,
    maxAttempts,
    setMaxAttempts,
    swapSpin,
    handleSelectSeats,
    swapStations,
  };
}

export type FormFields = ReturnType<typeof useFormFields>;
