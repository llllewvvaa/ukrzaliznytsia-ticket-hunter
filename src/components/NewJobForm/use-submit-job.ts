import { createJobDraft, type JobFormInput } from '@/lib/engine/job-factory';
import type { HuntJob } from '@/lib/models';
import type { FormFields } from './use-form-fields';

// Builds the final job draft from the field values; draft validation errors
// route back into the wizard's error list instead of submitting.
export function useSubmitJob(
  fields: FormFields,
  failWith: (issues: string[]) => void,
  onSubmit: (job: HuntJob) => void,
) {
  const submit = (): void => {
    const input: JobFormInput = {
      name: fields.name,
      from: fields.from,
      to: fields.to,
      date: fields.date,
      preferredTrains: fields.seatSelection
        ? [fields.seatSelection.match.trainNumber]
        : fields.trains,
      coachTypes: fields.seatSelection ? [fields.seatSelection.match.classId] : fields.coachTypes,
      passengerIds: fields.passengerIds,
      bedding: fields.bedding,
      seatPrefs: fields.seatSelection
        ? undefined
        : {
            ...(fields.berth !== 'any' ? { berth: fields.berth } : {}),
            adjacent: fields.adjacent,
            avoidToilet: fields.avoidToilet,
            airConditioned: fields.airConditioned,
          },
      manualSeats: fields.seatSelection
        ? { wagonNumber: fields.seatSelection.wagonNumber, seats: fields.seatSelection.seats }
        : undefined,
      manualMatch: fields.seatSelection ? fields.seatSelection.match : undefined,
      mode: fields.mode,
      pollIntervalSec: fields.pollIntervalSec,
      startAt: fields.startAt ? new Date(fields.startAt).getTime() : undefined,
      // Scheduled sprints are bounded by the sprint window, not an attempt cap.
      maxAttempts:
        fields.mode === 'scheduled'
          ? undefined
          : fields.maxAttempts
            ? Number(fields.maxAttempts)
            : undefined,
      nativeAvailable: false, // native endpoint TBD (discovery)
    };
    const { job, errors: errs } = createJobDraft(input);
    if (job) onSubmit(job);
    else failWith(errs);
  };

  return submit;
}
