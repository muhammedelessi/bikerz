export type TrainerApplicationStatus = "pending" | "approved" | "rejected";

export interface TrainerApplication {
  id: string;
  user_id: string;
  status: TrainerApplicationStatus;
  name_ar: string | null;
  name_en: string | null;
  bio: string;
  bio_ar: string | null;
  bio_en: string | null;
  services: string[];
  photo_url: string | null;
  bike_type: string | null;
  years_of_experience: number | null;
  country: string | null;
  city: string | null;
  date_of_birth: string | null;
  phone: string | null;
  gender: string | null;
  nationality: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Service checkbox values (stored in trainer_applications.services). */
export const TRAINER_APPLICATION_SERVICE_IDS = [
  "theory_lessons",
  "practical_lessons",
  "highway_training",
  "track_training",
  "safety_courses",
  "beginner_lessons",
  "advanced_techniques",
] as const;

export type TrainerApplicationServiceId = (typeof TRAINER_APPLICATION_SERVICE_IDS)[number];

export const trainerApplicationQueryKey = (userId: string) => ["trainer-application", userId] as const;
