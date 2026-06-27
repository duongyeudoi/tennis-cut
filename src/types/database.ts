export type JobStatus = "pending" | "processing" | "done" | "failed";
export type EditStatus = "original" | "pending_recut" | "recut";

export interface Job {
  id: string;
  created_at: string;
  status: JobStatus;
  raw_video_key: string;
  duration_sec: number | null;
  clip_count: number | null;
  error_msg: string | null;
  metadata: Record<string, unknown>;
}

export interface Clip {
  id: string;
  job_id: string;
  clip_index: number;
  ai_start_sec: number;
  ai_end_sec: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  clip_key: string;
  thumbnail_key: string | null;
  share_token: string;
  edit_status: EditStatus;
  created_at: string;
  updated_at: string;
}

// Supabase Database generic type — phải có đúng format này để createClient<Database> hoạt động
export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: Job;
        Insert: Omit<Job, "created_at"> & { id?: string };
        Update: Partial<Omit<Job, "id" | "created_at">>;
        Relationships: [];
      };
      clips: {
        Row: Clip;
        Insert: Omit<Clip, "duration_sec" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<
          Omit<Clip, "id" | "duration_sec" | "created_at" | "job_id">
        >;
        Relationships: [
          {
            foreignKeyName: "clips_job_id_fkey";
            columns: ["job_id"];
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
