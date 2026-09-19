// Hand-authored to match supabase/migrations/0001_init.sql and
// 0002_functions.sql. If the schema changes, update this file to match --
// there is no live project link in this environment to auto-generate it
// from (see docs/BUILD-STATUS.md).

export type RecurrenceType = "one_time" | "weekly" | "biweekly" | "monthly";
export type JobStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "rescheduled"
  | "cancelled";
export type JobChangeType = "move" | "skip" | "complete" | "timer_correction";

export type OrganizationRow = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  created_at: string;
};

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner";
  created_at: string;
};

export type CustomerRow = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  default_price_cents: number;
  general_notes: string | null;
  property_notes: string | null;
  gate_code: string | null;
  access_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type CustomerInsert = Omit<
  CustomerRow,
  "id" | "created_at" | "updated_at" | "is_active"
> & { is_active?: boolean };
export type CustomerUpdate = Partial<CustomerInsert>;

export type ServiceScheduleRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  description: string;
  price_cents: number;
  estimated_minutes: number | null;
  start_date: string;
  recurrence: RecurrenceType;
  is_active: boolean;
  last_generated_through: string | null;
  created_at: string;
  updated_at: string;
};
export type ServiceScheduleInsert = Omit<
  ServiceScheduleRow,
  "id" | "created_at" | "updated_at" | "last_generated_through" | "is_active"
> & { is_active?: boolean };
export type ServiceScheduleUpdate = Partial<ServiceScheduleInsert>;

export type JobRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  schedule_id: string;
  original_service_date: string;
  scheduled_date: string;
  status: JobStatus;
  description: string;
  price_cents: number;
  estimated_minutes: number | null;
  completion_notes: string | null;
  skip_reason: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeEntryRow = {
  id: string;
  organization_id: string;
  job_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_manual_correction: boolean;
  correction_reason: string | null;
  created_at: string;
};

export type JobChangeHistoryRow = {
  id: string;
  organization_id: string;
  job_id: string;
  change_type: JobChangeType;
  previous_date: string | null;
  new_date: string | null;
  reason: string | null;
  previous_values: Record<string, unknown> | null;
  changed_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: Partial<OrganizationRow>;
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: Partial<OrganizationMemberRow>;
        Update: Partial<OrganizationMemberRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
        Relationships: [];
      };
      service_schedules: {
        Row: ServiceScheduleRow;
        Insert: ServiceScheduleInsert;
        Update: ServiceScheduleUpdate;
        Relationships: [
          {
            foreignKeyName: "service_schedules_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: JobRow;
        Insert: Partial<JobRow>;
        Update: Partial<JobRow>;
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      time_entries: {
        Row: TimeEntryRow;
        Insert: Partial<TimeEntryRow>;
        Update: Partial<TimeEntryRow>;
        Relationships: [];
      };
      job_change_history: {
        Row: JobChangeHistoryRow;
        Insert: Partial<JobChangeHistoryRow>;
        Update: Partial<JobChangeHistoryRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_jobs_for_organization: {
        Args: Record<string, never>;
        Returns: void;
      };
      generate_jobs_for_schedule: {
        Args: { p_schedule_id: string };
        Returns: void;
      };
      start_job: {
        Args: { p_job_id: string };
        Returns: JobRow;
      };
      complete_job: {
        Args: { p_job_id: string; p_notes?: string | null };
        Returns: JobRow;
      };
      complete_job_manual: {
        Args: {
          p_job_id: string;
          p_duration_seconds: number;
          p_reason: string;
          p_notes?: string | null;
        };
        Returns: JobRow;
      };
      move_job: {
        Args: {
          p_job_id: string;
          p_new_date: string;
          p_reason?: string | null;
          p_confirm_conflict?: boolean;
        };
        Returns: JobRow;
      };
      stop_and_reschedule: {
        Args: {
          p_job_id: string;
          p_new_date: string;
          p_reason?: string | null;
          p_confirm_conflict?: boolean;
        };
        Returns: JobRow;
      };
      skip_job: {
        Args: { p_job_id: string; p_reason: string };
        Returns: JobRow;
      };
      deactivate_customer: {
        Args: { p_customer_id: string };
        Returns: CustomerRow;
      };
      reactivate_customer: {
        Args: { p_customer_id: string };
        Returns: CustomerRow;
      };
    };
    Enums: {
      recurrence_type: RecurrenceType;
      job_status: JobStatus;
      job_change_type: JobChangeType;
    };
  };
};
