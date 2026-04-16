/**
 * Anki-style SM-2 Spaced Repetition Algorithm
 * Implements learning phase (minute-based steps) → review phase (day-based SM-2).
 */

import { SRSState } from './store';

// ── SM-2 quality constants ───────────────────────────────────────────────

export const Q_AGAIN = 1;
export const Q_HARD  = 2;
export const Q_GOOD  = 3;
export const Q_EASY  = 4;

// ── Quality levels (user-facing) ─────────────────────────────────────────

export interface Rating {
  label: string;
  quality: number;  // 1=Again, 2=Hard, 3=Good, 4=Easy
  description: string;
}

export const RATINGS: Rating[] = [
  { label: 'Again', quality: Q_AGAIN, description: 'Completely wrong' },
  { label: 'Hard',  quality: Q_HARD,  description: 'Struggled to recall' },
  { label: 'Good',  quality: Q_GOOD,  description: 'Recalled with effort' },
  { label: 'Easy',  quality: Q_EASY,  description: 'Effortlessly recalled' },
];

// ── Learning phase config ────────────────────────────────────────────────

/** Learning steps for NEW cards (in minutes). Default matches Anki: 1m → 10m. */
export const LEARNING_STEPS: number[] = [1, 10];

/** Relearning steps for lapsed REVIEW cards (in minutes). */
export const RELEARNING_STEPS: number[] = [10];

/** Days until next review after graduating a new card with Good. */
export const GRADUATING_INTERVAL = 1;

/** Days until next review after pressing Easy on a new card. */
export const EASY_GRADUATING_INTERVAL = 4;

/** Default ease factor. */
export const DEFAULT_EASE = 2.5;

/** Minimum ease factor (SM-2). */
export const MIN_EASE = 1.3;

/** Mastered threshold in days — cards meeting this count toward "mastered". */
export const MASTERED_INTERVAL_DAYS = 3;

// ── Create default state ─────────────────────────────────────────────────

export function newSRSState(): SRSState {
  return {
    interval: 0,
    ease: DEFAULT_EASE,
    reviews: 0,
    nextReview: Date.now(), // due immediately
    lapses: 0,
    learningStep: 0,
  };
}

// ── Helper: which learning steps apply to this card ──────────────────────

function learningStepsFor(state: SRSState): number[] {
  if (state.reviews === 0) return LEARNING_STEPS;  // new
  return RELEARNING_STEPS;                          // relearning (lapsed)
}

// ── Helper: is the card currently in a learning step? ────────────────────

function isInLearningPhase(state: SRSState): boolean {
  const steps = learningStepsFor(state);
  return state.reviews === 0 || state.learningStep < steps.length;
}

// ── Preview: compute next interval (minutes) without mutating ────────────

export function previewInterval(state: SRSState, quality: number): number {
  if (!isInLearningPhase(state)) {
    // === REVIEW phase — day-based SM-2 ===
    if (quality === Q_AGAIN) return 0;        // lapse → requeue immediately for relearning

    const eased = Math.max(MIN_EASE, state.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    let days: number;

    if (quality === Q_HARD) {
      days = Math.floor(state.interval * 1.2);
      if (days <= state.interval) days = state.interval + 1;
    } else if (quality === Q_GOOD) {
      days = Math.floor(state.interval * eased);
    } else {
      days = Math.floor(state.interval * eased * 1.3);
    }

    return days * 24 * 60;
  }

  // === LEARNING phase — step-based minutes ===
  const steps = learningStepsFor(state);
  const currentStep = Math.min(state.learningStep, steps.length - 1);

  if (quality === Q_AGAIN) return 0;                   // back to step 0, requeue

  if (quality === Q_HARD) return Math.round(steps[currentStep] * 1.5);

  if (quality === Q_GOOD) {
    const nextStep = state.learningStep + 1;
    if (nextStep >= steps.length) return GRADUATING_INTERVAL * 24 * 60;  // graduate
    return steps[nextStep];
  }

  // EASY — graduate immediately
  return EASY_GRADUATING_INTERVAL * 24 * 60;
}

// ── Human-friendly interval label ────────────────────────────────────────

export function intervalLabel(state: SRSState, quality: number): string {
  const totalMinutes = previewInterval(state, quality);

  if (!Number.isFinite(totalMinutes) || totalMinutes === 0) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.round(totalMinutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(totalMinutes / (60 * 24));
  if (days < 30) return `${days}d`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;

  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

// ── Apply review ─────────────────────────────────────────────────────────

export function review(state: SRSState, quality: number): SRSState {
  const inLearning = isInLearningPhase(state);

  if (inLearning) {
    const steps = learningStepsFor(state);

    if (quality === Q_AGAIN) {
      state.learningStep = 0;
      state.nextReview = Date.now();                       // requeue now
      return state;
    }

    if (quality === Q_HARD) {
      const currentStep = Math.min(state.learningStep, steps.length - 1);
      const mins = Math.round(steps[currentStep] * 1.5);
      state.nextReview = Date.now() + mins * 60 * 1000;
      return state;
    }

    if (quality === Q_GOOD) {
      const nextStep = state.learningStep + 1;
      if (nextStep >= steps.length) {
        // Graduate to review phase
        state.reviews += 1;
        state.learningStep = 0;
        state.interval = GRADUATING_INTERVAL;
        state.nextReview = Date.now() + GRADUATING_INTERVAL * 24 * 60 * 60 * 1000;
      } else {
        state.learningStep = nextStep;
        state.nextReview = Date.now() + steps[nextStep] * 60 * 1000;
      }
      return state;
    }

    // EASY — graduate immediately
    state.reviews += 1;
    state.learningStep = 0;
    state.interval = EASY_GRADUATING_INTERVAL;
    state.nextReview = Date.now() + EASY_GRADUATING_INTERVAL * 24 * 60 * 60 * 1000;
    return state;
  }

  // === REVIEW phase — SM-2 ===
  const eased = Math.max(
    MIN_EASE,
    state.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  state.ease = eased;

  if (quality < 3) {
    // Again / Hard = lapse → relearning
    state.reviews = 0;
    state.lapses += 1;
    state.learningStep = 0;
    state.interval = Math.max(1, Math.floor(state.interval * 0.5));  // halve interval (min 1)
    state.nextReview = Date.now();                                   // requeue now for relearning
    return state;
  }

  // Good / Easy — compute next review interval
  let days: number;
  if (quality === Q_HARD) {
    days = Math.floor(state.interval * 1.2);
    if (days <= state.interval) days = state.interval + 1;
  } else if (quality === Q_GOOD) {
    days = Math.floor(state.interval * eased);
  } else {
    // Easy
    days = Math.floor(state.interval * eased * 1.3);
  }
  if (days <= state.interval) days = state.interval + 1;

  state.interval = days;
  state.reviews += 1;
  state.nextReview = Date.now() + days * 24 * 60 * 60 * 1000;
  return state;
}

// ── Display helpers ──────────────────────────────────────────────────────

export function ratingFor(quality: number): string {
  return RATINGS.find(r => r.quality === quality)?.label ?? 'Good';
}

export function dueIn(state: SRSState): string {
  const ms = state.nextReview - Date.now();
  if (ms <= 0) return 'Due now';

  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days === 0) {
    const hours = Math.round(ms / (60 * 60 * 1000));
    return `In ${hours}h`;
  }
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `In ${days}d`;
  if (days < 365) return `In ${Math.round(days / 30)}mo`;
  return `In ${Math.round(days / 365)}y`;
}
