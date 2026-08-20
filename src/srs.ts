/**
 * Anki-style SM-2 Spaced Repetition Algorithm
 * Implements learning phase (minute-based steps) → review phase (day-based SM-2).
 */

import type { SRSState } from './store';

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

const MINUTES_PER_DAY = 24 * 60;

// ── Create default state ─────────────────────────────────────────────────

export function newSRSState(): SRSState {
  const now = Date.now();
  return {
    interval: 0,
    ease: DEFAULT_EASE,
    reviews: 0,
    nextReview: now, // due immediately
    lapses: 0,
    learningStep: 0,
    firstSeen: now,
    totalReviews: 0,
    ratingCounts: {},
  };
}

// A zero-review card with no day interval is new/learning. A zero-review card
// with a retained day interval is relearning after a lapse. This uses fields
// already present in persisted states, so legacy records need no migration.
export function isInLearningPhase(state: SRSState): boolean {
  return state.reviews === 0;
}

function isRelearning(state: SRSState): boolean {
  return isInLearningPhase(state) && state.interval > 0;
}

function learningStepsFor(state: SRSState): number[] {
  return isRelearning(state) ? RELEARNING_STEPS : LEARNING_STEPS;
}

function clampQuality(quality: number): 1 | 2 | 3 | 4 {
  return Math.min(Q_EASY, Math.max(Q_AGAIN, quality)) as 1 | 2 | 3 | 4;
}

function adjustedEase(ease: number, quality: number): number {
  return Math.max(
    MIN_EASE,
    ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );
}

function matureIntervalDays(interval: number, ease: number, quality: number): number {
  let days: number;
  if (quality === Q_HARD) {
    days = Math.floor(interval * 1.2);
  } else if (quality === Q_GOOD) {
    days = Math.floor(interval * ease);
  } else {
    days = Math.floor(interval * ease * 1.3);
  }

  // Every successful mature review must grow by at least one day. Keeping the
  // rule here makes preview and application use exactly the same result.
  return Math.max(interval + 1, days);
}

interface SchedulingTransition {
  delayMinutes: number;
  interval: number;
  ease: number;
  reviews: number;
  lapses: number;
  learningStep: number;
}

/** Compute one scheduling transition without timestamps or mutation. */
function schedulingTransition(state: SRSState, rawQuality: number): SchedulingTransition {
  const quality = clampQuality(rawQuality);

  if (isInLearningPhase(state)) {
    const relearning = isRelearning(state);
    const steps = learningStepsFor(state);
    const currentStep = Math.min(state.learningStep, steps.length - 1);

    if (quality === Q_AGAIN) {
      return {
        delayMinutes: steps[0],
        interval: state.interval,
        ease: state.ease,
        reviews: state.reviews,
        lapses: state.lapses,
        learningStep: 0,
      };
    }

    if (quality === Q_HARD) {
      return {
        delayMinutes: Math.round(steps[currentStep] * 1.5),
        interval: state.interval,
        ease: state.ease,
        reviews: state.reviews,
        lapses: state.lapses,
        learningStep: state.learningStep,
      };
    }

    if (quality === Q_GOOD) {
      const nextStep = state.learningStep + 1;
      if (nextStep < steps.length) {
        return {
          delayMinutes: steps[nextStep],
          interval: state.interval,
          ease: state.ease,
          reviews: state.reviews,
          lapses: state.lapses,
          learningStep: nextStep,
        };
      }

      const graduationDays = relearning
        ? Math.max(GRADUATING_INTERVAL, state.interval)
        : GRADUATING_INTERVAL;
      return {
        delayMinutes: graduationDays * MINUTES_PER_DAY,
        interval: graduationDays,
        ease: state.ease,
        reviews: state.reviews + 1,
        lapses: state.lapses,
        learningStep: 0,
      };
    }

    // Easy graduates immediately. A relearning card never loses more of its
    // retained interval merely because it was recalled easily.
    const easyDays = relearning
      ? Math.max(EASY_GRADUATING_INTERVAL, state.interval)
      : EASY_GRADUATING_INTERVAL;
    return {
      delayMinutes: easyDays * MINUTES_PER_DAY,
      interval: easyDays,
      ease: state.ease,
      reviews: state.reviews + 1,
      lapses: state.lapses,
      learningStep: 0,
    };
  }

  const ease = adjustedEase(state.ease, quality);
  if (quality === Q_AGAIN) {
    const interval = Math.max(1, Math.floor(state.interval * 0.5));
    return {
      delayMinutes: RELEARNING_STEPS[0],
      interval,
      ease,
      reviews: 0,
      lapses: state.lapses + 1,
      learningStep: 0,
    };
  }

  // Hard is a successful mature review, not a lapse.
  const interval = matureIntervalDays(state.interval, ease, quality);
  return {
    delayMinutes: interval * MINUTES_PER_DAY,
    interval,
    ease,
    reviews: state.reviews + 1,
    lapses: state.lapses,
    learningStep: 0,
  };
}

// ── Preview: compute next interval (minutes) without mutating ────────────

export function previewInterval(state: SRSState, quality: number): number {
  return schedulingTransition(state, quality).delayMinutes;
}

// ── Human-friendly interval label ────────────────────────────────────────

export function intervalLabel(state: SRSState, quality: number): string {
  const totalMinutes = previewInterval(state, quality);

  if (!Number.isFinite(totalMinutes) || totalMinutes === 0) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.round(totalMinutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(totalMinutes / MINUTES_PER_DAY);
  if (days < 30) return `${days}d`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;

  const years = (days / 365).toFixed(1);
  return `${years}y`;
}

// ── Apply review ─────────────────────────────────────────────────────────

export function review(state: SRSState, quality: number): SRSState {
  const now = Date.now();
  const rating = clampQuality(quality);
  const transition = schedulingTransition(state, rating);

  state.firstSeen ??= state.lastReviewed ?? now;
  state.lastReviewed = now;
  state.totalReviews = (state.totalReviews ?? (state.reviews + state.lapses)) + 1;
  state.lastRating = rating;
  state.ratingCounts = {
    ...state.ratingCounts,
    [rating]: (state.ratingCounts?.[rating] ?? 0) + 1,
  };

  state.interval = transition.interval;
  state.ease = transition.ease;
  state.reviews = transition.reviews;
  state.lapses = transition.lapses;
  state.learningStep = transition.learningStep;
  state.nextReview = now + transition.delayMinutes * 60 * 1000;
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
