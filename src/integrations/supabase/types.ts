export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_image_cache: {
        Row: {
          aspect: string
          created_at: string
          id: string
          image_path: string
          model: string
          prompt: string
          prompt_hash: string
          user_id: string
        }
        Insert: {
          aspect: string
          created_at?: string
          id?: string
          image_path: string
          model: string
          prompt: string
          prompt_hash: string
          user_id: string
        }
        Update: {
          aspect?: string
          created_at?: string
          id?: string
          image_path?: string
          model?: string
          prompt?: string
          prompt_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          ends_at: string
          id: string
          image_url: string | null
          starts_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          ends_at: string
          id?: string
          image_url?: string | null
          starts_at?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          image_url?: string | null
          starts_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          session_id: string
          status: string
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id: string
          status?: string
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          session_id?: string
          status?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          active: boolean
          class_id: string
          enrolled_at: string
          id: string
          student_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          class_id: string
          enrolled_at?: string
          id?: string
          student_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          class_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          capacity_override: number | null
          class_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          session_date: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity_override?: number | null
          class_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          session_date: string
          start_time: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity_override?: number | null
          class_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacity: number
          checkin_closes_minutes_before: number
          checkin_opens_minutes_before: number
          created_at: string
          day_of_week: number | null
          days_of_week: number[]
          duration_minutes: number
          id: string
          is_active: boolean
          is_recurring: boolean
          name: string
          notes: string | null
          program_id: string | null
          start_time: string
          trainer_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity?: number
          checkin_closes_minutes_before?: number
          checkin_opens_minutes_before?: number
          created_at?: string
          day_of_week?: number | null
          days_of_week?: number[]
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name: string
          notes?: string | null
          program_id?: string | null
          start_time: string
          trainer_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: number
          checkin_closes_minutes_before?: number
          checkin_opens_minutes_before?: number
          created_at?: string
          day_of_week?: number | null
          days_of_week?: number[]
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          notes?: string | null
          program_id?: string | null
          start_time?: string
          trainer_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          segment: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          segment?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          segment?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
          recurrent: boolean
          recurrent_months: number | null
          reference_month: string
          segment: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          description: string
          expense_date: string
          id?: string
          notes?: string | null
          payment_method?: string
          recurrent?: boolean
          recurrent_months?: number | null
          reference_month: string
          segment?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
          recurrent?: boolean
          recurrent_months?: number | null
          reference_month?: string
          segment?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_user_id: string
          sender_user_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_user_id: string
          sender_user_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string
          title?: string
        }
        Relationships: []
      }
      payment_freezes: {
        Row: {
          created_at: string
          end_date: string
          freeze_days: number
          id: string
          notes: string | null
          payment_id: string | null
          start_date: string
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          freeze_days: number
          id?: string
          notes?: string | null
          payment_id?: string | null
          start_date: string
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          freeze_days?: number
          id?: string
          notes?: string | null
          payment_id?: string | null
          start_date?: string
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_freezes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_freezes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          auto_renew: boolean | null
          checkin_quota_override: number | null
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          plan_id: string | null
          reference_month: string
          renewals_remaining: number | null
          renewed_from_payment_id: string | null
          status: string
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          auto_renew?: boolean | null
          checkin_quota_override?: number | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          plan_id?: string | null
          reference_month: string
          renewals_remaining?: number | null
          renewed_from_payment_id?: string | null
          status?: string
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean | null
          checkin_quota_override?: number | null
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          plan_id?: string | null
          reference_month?: string
          renewals_remaining?: number | null
          renewed_from_payment_id?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_renewed_from_payment_id_fkey"
            columns: ["renewed_from_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_programs: {
        Row: {
          created_at: string
          plan_id: string
          program_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plan_id: string
          program_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          plan_id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_programs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          auto_renew: boolean
          billing_cycle: string
          checkin_quota_amount: number | null
          checkin_quota_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_freeze_days: number | null
          max_renewals: number | null
          name: string
          package_valid_days: number | null
          price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          billing_cycle?: string
          checkin_quota_amount?: number | null
          checkin_quota_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_freeze_days?: number | null
          max_renewals?: number | null
          name: string
          package_valid_days?: number | null
          price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          billing_cycle?: string
          checkin_quota_amount?: number | null
          checkin_quota_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_freeze_days?: number | null
          max_renewals?: number | null
          name?: string
          package_valid_days?: number | null
          price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pt_exercises_library: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          media_type: string | null
          media_url: string | null
          muscle_group: string | null
          name: string
          thumbnail_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          media_type?: string | null
          media_url?: string | null
          muscle_group?: string | null
          name: string
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          media_type?: string | null
          media_url?: string | null
          muscle_group?: string | null
          name?: string
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pt_payments: {
        Row: {
          amount: number
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          pt_plan_id: string | null
          pt_student_id: string
          reference_month: string | null
          sessions_paid: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string
          pt_plan_id?: string | null
          pt_student_id: string
          reference_month?: string | null
          sessions_paid?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          pt_plan_id?: string | null
          pt_student_id?: string
          reference_month?: string | null
          sessions_paid?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_payments_pt_plan_id_fkey"
            columns: ["pt_plan_id"]
            isOneToOne: false
            referencedRelation: "pt_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_payments_pt_student_id_fkey"
            columns: ["pt_student_id"]
            isOneToOne: false
            referencedRelation: "pt_students"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_plans: {
        Row: {
          billing_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          package_price: number | null
          package_sessions: number | null
          price_per_month: number | null
          price_per_session: number | null
          sessions_per_month: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          package_price?: number | null
          package_sessions?: number | null
          price_per_month?: number | null
          price_per_session?: number | null
          sessions_per_month?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          package_price?: number | null
          package_sessions?: number | null
          price_per_month?: number | null
          price_per_session?: number | null
          sessions_per_month?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pt_programs: {
        Row: {
          ai_generated_at: string | null
          ai_prompt: string | null
          auto_archive: boolean
          category: string
          created_at: string
          end_date: string | null
          goals: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          is_deleted: boolean
          level: string
          name: string
          pt_student_id: string
          show_to_student: boolean
          sort_order: number
          start_date: string
          training_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generated_at?: string | null
          ai_prompt?: string | null
          auto_archive?: boolean
          category?: string
          created_at?: string
          end_date?: string | null
          goals?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_deleted?: boolean
          level?: string
          name: string
          pt_student_id: string
          show_to_student?: boolean
          sort_order?: number
          start_date: string
          training_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generated_at?: string | null
          ai_prompt?: string | null
          auto_archive?: boolean
          category?: string
          created_at?: string
          end_date?: string | null
          goals?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_deleted?: boolean
          level?: string
          name?: string
          pt_student_id?: string
          show_to_student?: boolean
          sort_order?: number
          start_date?: string
          training_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_programs_pt_student_id_fkey"
            columns: ["pt_student_id"]
            isOneToOne: false
            referencedRelation: "pt_students"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_sessions: {
        Row: {
          created_at: string
          duration_minutes: number
          exercises: string | null
          id: string
          next_session_plan: string | null
          performance_notes: string | null
          pt_payment_id: string | null
          pt_student_id: string
          session_date: string
          session_time: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          exercises?: string | null
          id?: string
          next_session_plan?: string | null
          performance_notes?: string | null
          pt_payment_id?: string | null
          pt_student_id: string
          session_date: string
          session_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          exercises?: string | null
          id?: string
          next_session_plan?: string | null
          performance_notes?: string | null
          pt_payment_id?: string | null
          pt_student_id?: string
          session_date?: string
          session_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_sessions_pt_payment_id_fkey"
            columns: ["pt_payment_id"]
            isOneToOne: false
            referencedRelation: "pt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_pt_student_id_fkey"
            columns: ["pt_student_id"]
            isOneToOne: false
            referencedRelation: "pt_students"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_student_contracts: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          pt_student_id: string
          signed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          pt_student_id: string
          signed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          pt_student_id?: string
          signed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_student_contracts_pt_student_id_fkey"
            columns: ["pt_student_id"]
            isOneToOne: false
            referencedRelation: "pt_students"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_students: {
        Row: {
          account_user_id: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          goal: string | null
          health_notes: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          start_date: string | null
          status: string
          temp_password: string | null
          training_plan: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          goal?: string | null
          health_notes?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          temp_password?: string | null
          training_plan?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_user_id?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          goal?: string | null
          health_notes?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          temp_password?: string | null
          training_plan?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pt_training_days: {
        Row: {
          created_at: string
          day_label: string
          description: string | null
          id: string
          name: string
          program_id: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_label: string
          description?: string | null
          id?: string
          name: string
          program_id: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_label?: string
          description?: string | null
          id?: string
          name?: string
          program_id?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_training_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "pt_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_training_executions: {
        Row: {
          created_at: string
          executed_at: string
          feedback: string | null
          id: string
          notes: string | null
          pt_student_id: string
          rating: number | null
          training_day_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string
          feedback?: string | null
          id?: string
          notes?: string | null
          pt_student_id: string
          rating?: number | null
          training_day_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string
          feedback?: string | null
          id?: string
          notes?: string | null
          pt_student_id?: string
          rating?: number | null
          training_day_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_training_executions_pt_student_id_fkey"
            columns: ["pt_student_id"]
            isOneToOne: false
            referencedRelation: "pt_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_training_executions_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "pt_training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_training_exercises: {
        Row: {
          cadence: string | null
          created_at: string
          exercise_library_id: string | null
          id: string
          inclination: string | null
          is_superset: boolean
          load: string | null
          media_type: string | null
          media_url: string | null
          name: string
          observations: string | null
          pace: string | null
          rest_seconds: string | null
          series_type: string | null
          sets_reps: string | null
          sort_order: number
          substitute_exercise_id: string | null
          superset_group: string | null
          thumbnail_url: string | null
          time_seconds: number | null
          training_day_id: string
          user_id: string
        }
        Insert: {
          cadence?: string | null
          created_at?: string
          exercise_library_id?: string | null
          id?: string
          inclination?: string | null
          is_superset?: boolean
          load?: string | null
          media_type?: string | null
          media_url?: string | null
          name: string
          observations?: string | null
          pace?: string | null
          rest_seconds?: string | null
          series_type?: string | null
          sets_reps?: string | null
          sort_order?: number
          substitute_exercise_id?: string | null
          superset_group?: string | null
          thumbnail_url?: string | null
          time_seconds?: number | null
          training_day_id: string
          user_id: string
        }
        Update: {
          cadence?: string | null
          created_at?: string
          exercise_library_id?: string | null
          id?: string
          inclination?: string | null
          is_superset?: boolean
          load?: string | null
          media_type?: string | null
          media_url?: string | null
          name?: string
          observations?: string | null
          pace?: string | null
          rest_seconds?: string | null
          series_type?: string | null
          sets_reps?: string | null
          sort_order?: number
          substitute_exercise_id?: string | null
          superset_group?: string | null
          thumbnail_url?: string | null
          time_seconds?: number | null
          training_day_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_training_exercises_exercise_library_id_fkey"
            columns: ["exercise_library_id"]
            isOneToOne: false
            referencedRelation: "pt_exercises_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_training_exercises_substitute_exercise_id_fkey"
            columns: ["substitute_exercise_id"]
            isOneToOne: false
            referencedRelation: "pt_training_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_training_exercises_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "pt_training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      student_contracts: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          signed_at: string | null
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          signed_at?: string | null
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          signed_at?: string | null
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_plan_history: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          plan_id: string | null
          start_date: string
          student_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          plan_id?: string | null
          start_date: string
          student_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          plan_id?: string | null
          start_date?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          account_user_id: string | null
          address: string | null
          attendance_offset: number
          birth_date: string | null
          city: string | null
          country: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          rg: string | null
          start_date: string | null
          state: string | null
          status: string
          temp_password: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_user_id?: string | null
          address?: string | null
          attendance_offset?: number
          birth_date?: string | null
          city?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rg?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_user_id?: string | null
          address?: string | null
          attendance_offset?: number
          birth_date?: string | null
          city?: string | null
          country?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          rg?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          temp_password?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_settings: {
        Row: {
          allow_multi_checkin_same_program_per_day: boolean
          created_at: string
          default_checkin_closes_minutes_before: number
          default_checkin_opens_minutes_before: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_multi_checkin_same_program_per_day?: boolean
          created_at?: string
          default_checkin_closes_minutes_before?: number
          default_checkin_opens_minutes_before?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_multi_checkin_same_program_per_day?: boolean
          created_at?: string
          default_checkin_closes_minutes_before?: number
          default_checkin_opens_minutes_before?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_settings: {
        Row: {
          created_at: string
          resend_api_key: string | null
          sender_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          resend_api_key?: string | null
          sender_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          resend_api_key?: string | null
          sender_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_pt_student_credentials: {
        Args: { _student_id: string }
        Returns: {
          email: string
          temp_password: string
        }[]
      }
      get_student_credentials: {
        Args: { _student_id: string }
        Returns: {
          email: string
          temp_password: string
        }[]
      }
      has_module: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_all_pt_student_statuses_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      recalculate_all_student_statuses_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      recalculate_pt_student_status: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      recalculate_student_status: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      restore_payment: { Args: { _id: string }; Returns: undefined }
      restore_student: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_module: "studio" | "pt" | "financeiro" | "crm"
      app_role: "admin" | "student" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: ["studio", "pt", "financeiro", "crm"],
      app_role: ["admin", "student", "super_admin"],
    },
  },
} as const
