import type { MatchRef } from '@/lib/models';
import type { useNewJobForm } from './use-new-job-form';

export type Berth = 'any' | 'lower' | 'upper';

// Domain type of the form: an exact seat pick locks the job to one
// train + class + wagon. Lives here (not in TrainPicker) so hooks and
// components both depend on types, not on a component file.
export type SeatSelection = { match: MatchRef; wagonNumber: string; seats: number[] };

export type NewJobFormState = ReturnType<typeof useNewJobForm>;
