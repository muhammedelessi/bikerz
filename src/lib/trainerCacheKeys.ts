/**
 * Centralised cache-invalidation helpers for the practical training + trainers
 * data graph.
 *
 * Why this file exists:
 *
 * Admin pages (AdminTrainers, AdminTrainings, trainer course editors) write to
 * the `trainers`, `trainings`, and `trainer_courses` tables. The public-facing
 * pages (Trainers, Trainings, TrainerProfile, TrainingDetail, the booking
 * dialog, etc.) read from those same tables — sometimes via the
 * `public_trainers` view, sometimes via direct selects.
 *
 * Until now, each mutation site invalidated only the admin-scoped keys it
 * knew about (e.g. `['admin-trainers']`), leaving the public-facing queries
 * to go stale. Symptom: an admin updates a trainer's photo → admin page
 * refreshes immediately → public listing keeps showing the old photo until
 * either the user navigates away and back OR React Query's 5-minute gc
 * fires.
 *
 * Centralising the key list here makes the mismatch impossible to repeat:
 * every mutation site calls one of these helpers and gets the full set.
 *
 * Helpers are split by domain (trainer vs training vs trainer_course) so
 * callers don't over-invalidate (e.g. updating a single trainer course
 * shouldn't bust the entire public trainings catalog).
 */
import type { QueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// TRAINER mutations — anything that writes to `trainers` table
// (name, photo, bio, contact info, status, services, availability, …)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate every query that surfaces trainer data, including the public
 * `public_trainers`-backed lists, the trainer's public profile page, the
 * booking flow's availability lookup, the admin trainer list, and the admin
 * trainer profile view.
 *
 * Pass `trainerId` when you have it so the trainer-scoped queries get the
 * targeted invalidation; omit it for global mutations (e.g. bulk imports).
 */
export function invalidateTrainerQueries(
  qc: QueryClient,
  trainerId?: string,
): void {
  // ── Public surfaces ──
  qc.invalidateQueries({ queryKey: ["public-trainers"] });
  qc.invalidateQueries({ queryKey: ["public-trainer-courses"] });
  if (trainerId) {
    qc.invalidateQueries({ queryKey: ["trainer-public-profile", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-availability-public", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-booking-extras", trainerId] });
  } else {
    qc.invalidateQueries({ queryKey: ["trainer-public-profile"] });
    qc.invalidateQueries({ queryKey: ["trainer-availability-public"] });
    qc.invalidateQueries({ queryKey: ["trainer-booking-extras"] });
  }

  // ── Admin surfaces ──
  qc.invalidateQueries({ queryKey: ["admin-trainers"] });
  qc.invalidateQueries({ queryKey: ["admin-trainer-courses-summary"] });
  qc.invalidateQueries({ queryKey: ["admin-training-students-by-pair"] });
  qc.invalidateQueries({ queryKey: ["training-trainer-counts"] });
  qc.invalidateQueries({ queryKey: ["trainer-student-counts"] });
  if (trainerId) {
    qc.invalidateQueries({ queryKey: ["trainer-profile-view", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-courses", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-admin-bookings", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-bookings", trainerId] });
  } else {
    qc.invalidateQueries({ queryKey: ["trainer-profile-view"] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-courses"] });
    qc.invalidateQueries({ queryKey: ["trainer-admin-bookings"] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-bookings"] });
  }

  // ── Cross-cutting (training detail page joins to public_trainers) ──
  qc.invalidateQueries({ queryKey: ["training-detail-courses"] });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING mutations — writes to `trainings` table (the practical training
// types themselves: name, description, level, sessions/skills/videos…)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate every query that displays a training's metadata.
 * Pass `trainingId` when editing a single row; omit for bulk operations.
 */
export function invalidateTrainingQueries(
  qc: QueryClient,
  trainingId?: string,
): void {
  // ── Public surfaces ──
  qc.invalidateQueries({ queryKey: ["public-trainings"] });
  qc.invalidateQueries({ queryKey: ["public-trainer-courses"] });
  if (trainingId) {
    qc.invalidateQueries({ queryKey: ["training-detail", trainingId] });
    qc.invalidateQueries({ queryKey: ["training-detail-courses", trainingId] });
  } else {
    qc.invalidateQueries({ queryKey: ["training-detail"] });
    qc.invalidateQueries({ queryKey: ["training-detail-courses"] });
  }

  // ── Admin surfaces ──
  qc.invalidateQueries({ queryKey: ["admin-trainings"] });
  qc.invalidateQueries({ queryKey: ["all-trainings-catalog"] });
  qc.invalidateQueries({ queryKey: ["training-trainer-counts"] });
  qc.invalidateQueries({ queryKey: ["admin-trainer-courses-summary"] });
}

// ─────────────────────────────────────────────────────────────────────────────
// TRAINER_COURSES mutations — writes to the join table (price, location,
// schedule, the trainer-specific config of a training)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invalidate every query that surfaces trainer_courses data — both the
 * trainer-scoped admin views AND the training-scoped public detail page,
 * plus the home/landing trainings section that aggregates them.
 *
 * Always pass both ids when available — the trainer-specific keys and the
 * training-specific keys are separate trees and missing either side is the
 * exact bug this helper exists to prevent.
 */
export function invalidateTrainerCourseQueries(
  qc: QueryClient,
  opts: { trainerId?: string; trainingId?: string } = {},
): void {
  const { trainerId, trainingId } = opts;

  // ── Trainer-scoped (admin profile view + admin lists) ──
  qc.invalidateQueries({ queryKey: ["admin-trainer-courses-summary"] });
  if (trainerId) {
    qc.invalidateQueries({ queryKey: ["trainer-profile-courses", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-view", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-admin-bookings", trainerId] });
    qc.invalidateQueries({ queryKey: ["trainer-profile-bookings", trainerId] });
  } else {
    qc.invalidateQueries({ queryKey: ["trainer-profile-courses"] });
  }

  // ── Training-scoped (public detail page joins trainer_courses) ──
  if (trainingId) {
    qc.invalidateQueries({ queryKey: ["training-detail-courses", trainingId] });
    qc.invalidateQueries({ queryKey: ["training-detail", trainingId] });
  } else {
    qc.invalidateQueries({ queryKey: ["training-detail-courses"] });
  }

  // ── Cross-cutting (home page lists trainings with their offering counts) ──
  qc.invalidateQueries({ queryKey: ["public-trainer-courses"] });
  qc.invalidateQueries({ queryKey: ["public-trainings"] });
  qc.invalidateQueries({ queryKey: ["training-trainer-counts"] });
}
