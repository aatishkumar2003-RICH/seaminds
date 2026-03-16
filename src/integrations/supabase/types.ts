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
      admin_profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempt_count: number
          id: string
          ip_address: string
          last_attempt: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          id?: string
          ip_address: string
          last_attempt?: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          id?: string
          ip_address?: string
          last_attempt?: string
          window_start?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          language: string
          published: boolean
          region: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          language?: string
          published?: boolean
          region?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          language?: string
          published?: boolean
          region?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bridge_pocket: {
        Row: {
          crew_profile_id: string | null
          id: string
          items: Json | null
          updated_at: string | null
        }
        Insert: {
          crew_profile_id?: string | null
          id?: string
          items?: Json | null
          updated_at?: string | null
        }
        Update: {
          crew_profile_id?: string | null
          id?: string
          items?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bridge_pocket_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      country_pricing: {
        Row: {
          active: boolean | null
          country_code: string
          country_name: string
          currency: string | null
          id: string
          price_job_annual: number | null
          price_job_monthly: number | null
          price_job_single: number | null
          price_manager_assessment: number | null
          price_self_assessment: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean | null
          country_code: string
          country_name: string
          currency?: string | null
          id?: string
          price_job_annual?: number | null
          price_job_monthly?: number | null
          price_job_single?: number | null
          price_manager_assessment?: number | null
          price_self_assessment?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean | null
          country_code?: string
          country_name?: string
          currency?: string | null
          id?: string
          price_job_annual?: number | null
          price_job_monthly?: number | null
          price_job_single?: number | null
          price_manager_assessment?: number | null
          price_self_assessment?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
      crew_cv_data: {
        Row: {
          certificates: Json | null
          education: Json | null
          id: string
          medical: Json | null
          sea_service: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          certificates?: Json | null
          education?: Json | null
          id?: string
          medical?: Json | null
          sea_service?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          certificates?: Json | null
          education?: Json | null
          id?: string
          medical?: Json | null
          sea_service?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crew_documents: {
        Row: {
          category: string
          created_at: string
          crew_profile_id: string
          file_name: string
          id: string
          source: string
          storage_path: string
        }
        Insert: {
          category: string
          created_at?: string
          crew_profile_id: string
          file_name: string
          id?: string
          source?: string
          storage_path: string
        }
        Update: {
          category?: string
          created_at?: string
          crew_profile_id?: string
          file_name?: string
          id?: string
          source?: string
          storage_path?: string
        }
        Relationships: []
      }
      crew_feedback: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          id: string
          nationality: string | null
          profile_id: string | null
          rank: string | null
          rating: number | null
          raw_text: string
          ship_name: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          id?: string
          nationality?: string | null
          profile_id?: string | null
          rank?: string | null
          rating?: number | null
          raw_text: string
          ship_name?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          id?: string
          nationality?: string | null
          profile_id?: string | null
          rank?: string | null
          rating?: number | null
          raw_text?: string
          ship_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_profiles: {
        Row: {
          created_at: string
          crew_unique_id: string | null
          date_of_birth: string | null
          email: string | null
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
          manning_agent_phone: string | null
          nationality: string
          onboarded: boolean
          onboarding_complete: boolean
          passport_number: string | null
          port_of_joining: string | null
          role: string
          ship_name: string
          user_id: string | null
          vessel_imo: string | null
          vessel_type: string | null
          voyage_start_date: string | null
          whatsapp_number: string
          years_at_sea: string
        }
        Insert: {
          created_at?: string
          crew_unique_id?: string | null
          date_of_birth?: string | null
          email?: string | null
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
          manning_agent_phone?: string | null
          nationality?: string
          onboarded?: boolean
          onboarding_complete?: boolean
          passport_number?: string | null
          port_of_joining?: string | null
          role: string
          ship_name: string
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string
          years_at_sea?: string
        }
        Update: {
          created_at?: string
          crew_unique_id?: string | null
          date_of_birth?: string | null
          email?: string | null
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
          manning_agent_phone?: string | null
          nationality?: string
          onboarded?: boolean
          onboarding_complete?: boolean
          passport_number?: string | null
          port_of_joining?: string | null
          role?: string
          ship_name?: string
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string
          years_at_sea?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean | null
          applies_to: string
          code: string
          created_at: string | null
          created_by: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          uses_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          applies_to?: string
          code: string
          created_at?: string | null
          created_by?: string | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          applies_to?: string
          code?: string
          created_at?: string | null
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          uses_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      dpa_contacts: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          id: string
          is_default: boolean | null
          name: string
          phone: string
          region: string | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          phone: string
          region?: string | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          phone?: string
          region?: string | null
          sort_order?: number | null
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
      interview_pre_form: {
        Row: {
          accident_history: string | null
          assessment_id: string | null
          availability_date: string | null
          created_at: string | null
          crew_profile_id: string | null
          expected_salary: string | null
          id: string
          medical_fit: boolean | null
          near_miss: boolean | null
          psc_detention: boolean | null
          reason_for_leaving: string | null
          safety_violation: boolean | null
        }
        Insert: {
          accident_history?: string | null
          assessment_id?: string | null
          availability_date?: string | null
          created_at?: string | null
          crew_profile_id?: string | null
          expected_salary?: string | null
          id?: string
          medical_fit?: boolean | null
          near_miss?: boolean | null
          psc_detention?: boolean | null
          reason_for_leaving?: string | null
          safety_violation?: boolean | null
        }
        Update: {
          accident_history?: string | null
          assessment_id?: string | null
          availability_date?: string | null
          created_at?: string | null
          crew_profile_id?: string | null
          expected_salary?: string | null
          id?: string
          medical_fit?: boolean | null
          near_miss?: boolean | null
          psc_detention?: boolean | null
          reason_for_leaving?: string | null
          safety_violation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_pre_form_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_pre_form_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          additional_notes: string | null
          company_name: string
          contact_whatsapp: string
          contract_duration: string
          created_at: string
          id: string
          joining_port: string
          monthly_salary: string | null
          plan: string
          rank_required: string
          status: string
          verified: boolean
          vessel_type: string
        }
        Insert: {
          additional_notes?: string | null
          company_name: string
          contact_whatsapp: string
          contract_duration: string
          created_at?: string
          id?: string
          joining_port: string
          monthly_salary?: string | null
          plan?: string
          rank_required: string
          status?: string
          verified?: boolean
          vessel_type: string
        }
        Update: {
          additional_notes?: string | null
          company_name?: string
          contact_whatsapp?: string
          contract_duration?: string
          created_at?: string
          id?: string
          joining_port?: string
          monthly_salary?: string | null
          plan?: string
          rank_required?: string
          status?: string
          verified?: boolean
          vessel_type?: string
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
      nps_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          score: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          score: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          score?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          department: string | null
          email: string | null
          full_name: string | null
          home_country: string | null
          home_country_code: string | null
          id: string
          is_company: boolean | null
          last_seen: string | null
          location_personalisation: boolean | null
          nationality: string | null
          rank: string | null
          total_sea_months: number | null
          updated_at: string | null
          vessel_imo: string | null
          vessel_type: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id: string
          is_company?: boolean | null
          last_seen?: string | null
          location_personalisation?: boolean | null
          nationality?: string | null
          rank?: string | null
          total_sea_months?: number | null
          updated_at?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          full_name?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          is_company?: boolean | null
          last_seen?: string | null
          location_personalisation?: boolean | null
          nationality?: string | null
          rank?: string | null
          total_sea_months?: number | null
          updated_at?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
        }
        Relationships: []
      }
      rest_hours_data: {
        Row: {
          crew_profile_id: string | null
          entries: Json | null
          id: string
          updated_at: string | null
        }
        Insert: {
          crew_profile_id?: string | null
          entries?: Json | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          crew_profile_id?: string | null
          entries?: Json | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rest_hours_data_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      sub_admins: {
        Row: {
          active: boolean | null
          assigned_countries: string[] | null
          created_at: string | null
          email: string
          id: string
          last_login: string | null
          name: string
          permissions: Json | null
          pin: string
        }
        Insert: {
          active?: boolean | null
          assigned_countries?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          last_login?: string | null
          name: string
          permissions?: Json | null
          pin: string
        }
        Update: {
          active?: boolean | null
          assigned_countries?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          last_login?: string | null
          name?: string
          permissions?: Json | null
          pin?: string
        }
        Relationships: []
      }
      vessel_ratings: {
        Row: {
          accommodation: number
          comment: string | null
          company: string | null
          created_at: string
          food: number
          id: string
          internet: number
          officers: number
          safety: number
          vessel_name: string
          vessel_type: string
          work_hours: number
        }
        Insert: {
          accommodation: number
          comment?: string | null
          company?: string | null
          created_at?: string
          food: number
          id?: string
          internet: number
          officers: number
          safety: number
          vessel_name: string
          vessel_type: string
          work_hours: number
        }
        Update: {
          accommodation?: number
          comment?: string | null
          company?: string | null
          created_at?: string
          food?: number
          id?: string
          internet?: number
          officers?: number
          safety?: number
          vessel_name?: string
          vessel_type?: string
          work_hours?: number
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
      wellness_streaks: {
        Row: {
          created_at: string
          crew_profile_id: string
          current_streak: number
          id: string
          last_checkin_date: string
          longest_streak: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew_profile_id: string
          current_streak?: number
          id?: string
          last_checkin_date?: string
          longest_streak?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew_profile_id?: string
          current_streak?: number
          id?: string
          last_checkin_date?: string
          longest_streak?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_crew_profile: {
        Args: { _crew_profile_id: string }
        Returns: boolean
      }
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
