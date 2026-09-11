export type AppRole = "admin" | "staff";
export type Skill = "cleaning" | "gardening" | "both";
export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type Recurrence = "none" | "weekly" | "fortnightly" | "monthly";

export type Profile = {
  user_id: string;
  role: AppRole;
  staff_id: string | null;
  created_at: string;
};

export type Staff = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string;
  skill: Skill;
  color_hue: number;
  active: boolean;
  created_at: string;
};

export type Job = {
  id: string;
  client_name: string;
  address: string;
  job_type: Skill;
  job_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  duration_minutes: number;
  assigned_staff_id: string | null;
  status: JobStatus;
  price: number | null;
  notes: string;
  recurrence: Recurrence;
  series_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      staff: {
        Row: Staff;
        Insert: Partial<Staff> & Pick<Staff, "name" | "email">;
        Update: Partial<Staff>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "user_id">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: Partial<Job> & Pick<Job, "client_name" | "address" | "job_date" | "start_time">;
        Update: Partial<Job>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
