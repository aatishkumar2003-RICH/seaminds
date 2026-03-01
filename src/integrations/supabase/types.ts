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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string
          created_at: string
          crew_profile_id: string
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          crew_profile_id: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          crew_profile_id?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          company_name: string
          created_at: string
          crew_profile_id: string
          id: string
          manager_profile_id: string
          rank_required: string
          status: string
          vacancy_id: string | null
          vessel_type: string
        }
        Insert: {
          company_name: string
          created_at?: string
          crew_profile_id: string
          id?: string
          manager_profile_id: string
          rank_required: string
          status?: string
          vacancy_id?: string | null
          vessel_type: string
        }
        Update: {
          company_name?: string
          created_at?: string
          crew_profile_id?: string
          id?: string
          manager_profile_id?: string
          rank_required?: string
          status?: string
          vacancy_id?: string | null
          vessel_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "job_vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_availability: {
        Row: {
          about_me: string | null
          availability_date: string | null
          created_at: string
          crew_profile_id: string
          id: string
          preferred_vessel_type: string | null
          updated_at: string
          visible_to_employers: boolean
        }
        Insert: {
          about_me?: string | null
          availability_date?: string | null
          created_at?: string
          crew_profile_id: string
          id?: string
          preferred_vessel_type?: string | null
          updated_at?: string
          visible_to_employers?: boolean
        }
        Update: {
          about_me?: string | null
          availability_date?: string | null
          created_at?: string
          crew_profile_id?: string
          id?: string
          preferred_vessel_type?: string | null
          updated_at?: string
          visible_to_employers?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crew_availability_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: true
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_profiles: {
        Row: {
          created_at: string
          first_name: string
          gender: string | null
          home_city: string | null
          home_country: string | null
          home_country_code: string | null
          id: string
          last_login_lat: number | null
          last_login_lng: number | null
          last_name: string
          last_seen: string | null
          location_enabled: boolean
          manning_agency: string | null
          nationality: string
          onboarded: boolean
          role: string
          ship_name: string
          vessel_imo: string | null
          voyage_start_date: string | null
          whatsapp_number: string
          years_at_sea: string
        }
        Insert: {
          created_at?: string
          first_name: string
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          last_login_lat?: number | null
          last_login_lng?: number | null
          last_name?: string
          last_seen?: string | null
          location_enabled?: boolean
          manning_agency?: string | null
          nationality?: string
          onboarded?: boolean
          role: string
          ship_name: string
          vessel_imo?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string
          years_at_sea?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          last_login_lat?: number | null
          last_login_lng?: number | null
          last_name?: string
          last_seen?: string | null
          location_enabled?: boolean
          manning_agency?: string | null
          nationality?: string
          onboarded?: boolean
          role?: string
          ship_name?: string
          vessel_imo?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string
          years_at_sea?: string
        }
        Relationships: []
      }
      family_connections: {
        Row: {
          created_at: string
          crew_profile_id: string
          enabled: boolean
          family_email: string
          family_name: string
          family_relation: string
          id: string
          last_email_sent_at: string | null
        }
        Insert: {
          created_at?: string
          crew_profile_id: string
          enabled?: boolean
          family_email: string
          family_name: string
          family_relation: string
          id?: string
          last_email_sent_at?: string | null
        }
        Update: {
          created_at?: string
          crew_profile_id?: string
          enabled?: boolean
          family_email?: string
          family_name?: string
          family_relation?: string
          id?: string
          last_email_sent_at?: string | null
        }
        Relationships: []
      }
      job_vacancies: {
        Row: {
          active: boolean
          company_name: string
          contract_duration: string
          created_at: string
          id: string
          joining_port: string
          manager_profile_id: string
          min_smc_score: number | null
          rank_required: string
          salary_max: number
          salary_min: number
          special_requirements: string | null
          start_date: string
          vessel_name: string
          vessel_type: string
        }
        Insert: {
          active?: boolean
          company_name: string
          contract_duration: string
          created_at?: string
          id?: string
          joining_port: string
          manager_profile_id: string
          min_smc_score?: number | null
          rank_required: string
          salary_max?: number
          salary_min?: number
          special_requirements?: string | null
          start_date: string
          vessel_name: string
          vessel_type: string
        }
        Update: {
          active?: boolean
          company_name?: string
          contract_duration?: string
          created_at?: string
          id?: string
          joining_port?: string
          manager_profile_id?: string
          min_smc_score?: number | null
          rank_required?: string
          salary_max?: number
          salary_min?: number
          special_requirements?: string | null
          start_date?: string
          vessel_name?: string
          vessel_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_vacancies_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_profiles: {
        Row: {
          company_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          currently_at_sea: boolean | null
          department: string | null
          email: string | null
          full_name: string | null
          home_country: string | null
          home_country_code: string | null
          id: string
          last_seen: string | null
          nationality: string | null
          profile_completed: boolean | null
          rank: string | null
          total_sea_months: number | null
          vessel_imo: string | null
          vessel_type: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          currently_at_sea?: boolean | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id: string
          last_seen?: string | null
          nationality?: string | null
          profile_completed?: boolean | null
          rank?: string | null
          total_sea_months?: number | null
          vessel_imo?: string | null
          vessel_type?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          currently_at_sea?: boolean | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          last_seen?: string | null
          nationality?: string | null
          profile_completed?: boolean | null
          rank?: string | null
          total_sea_months?: number | null
          vessel_imo?: string | null
          vessel_type?: string | null
        }
        Relationships: []
      }
      safety_reports: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          manning_agency: string | null
          ship_name: string
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          manning_agency?: string | null
          ship_name: string
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          manning_agency?: string | null
          ship_name?: string
          status?: string
        }
        Relationships: []
      }
      smc_assessments: {
        Row: {
          behavioural_score: number | null
          certificate_id: string | null
          completed_at: string | null
          crew_profile_id: string
          current_step: number
          doc_upload_status: string
          english_score: number | null
          experience_score: number | null
          id: string
          overall_score: number | null
          score_band: string | null
          started_at: string
          status: string
          technical_score: number | null
          wellness_score: number | null
        }
        Insert: {
          behavioural_score?: number | null
          certificate_id?: string | null
          completed_at?: string | null
          crew_profile_id: string
          current_step?: number
          doc_upload_status?: string
          english_score?: number | null
          experience_score?: number | null
          id?: string
          overall_score?: number | null
          score_band?: string | null
          started_at?: string
          status?: string
          technical_score?: number | null
          wellness_score?: number | null
        }
        Update: {
          behavioural_score?: number | null
          certificate_id?: string | null
          completed_at?: string | null
          crew_profile_id?: string
          current_step?: number
          doc_upload_status?: string
          english_score?: number | null
          experience_score?: number | null
          id?: string
          overall_score?: number | null
          score_band?: string | null
          started_at?: string
          status?: string
          technical_score?: number | null
          wellness_score?: number | null
        }
        Relationships: []
      }
      smc_payments: {
        Row: {
          amount_paid: number
          assessment_unlocked: boolean
          created_at: string
          crew_profile_id: string | null
          id: string
          payment_type: string
          status: string
          stripe_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount_paid?: number
          assessment_unlocked?: boolean
          created_at?: string
          crew_profile_id?: string | null
          id?: string
          payment_type: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          assessment_unlocked?: boolean
          created_at?: string
          crew_profile_id?: string | null
          id?: string
          payment_type?: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      voyage_reports: {
        Row: {
          ai_message: string | null
          created_at: string
          crew_profile_id: string
          id: string
          longest_streak: number
          mood_breakdown: Json
          role: string
          ship_name: string
          total_checkins: number
          total_days: number
          voyage_end_date: string
          voyage_start_date: string
        }
        Insert: {
          ai_message?: string | null
          created_at?: string
          crew_profile_id: string
          id?: string
          longest_streak?: number
          mood_breakdown?: Json
          role: string
          ship_name: string
          total_checkins?: number
          total_days?: number
          voyage_end_date?: string
          voyage_start_date: string
        }
        Update: {
          ai_message?: string | null
          created_at?: string
          crew_profile_id?: string
          id?: string
          longest_streak?: number
          mood_breakdown?: Json
          role?: string
          ship_name?: string
          total_checkins?: number
          total_days?: number
          voyage_end_date?: string
          voyage_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
