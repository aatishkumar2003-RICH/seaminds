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
      agent_conversations: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          message: string
          message_type: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          message: string
          message_type?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          message?: string
          message_type?: string | null
        }
        Relationships: []
      }
      agent_instructions: {
        Row: {
          created_at: string | null
          executed_at: string | null
          id: string
          instruction: string
          instruction_type: string | null
          priority: number | null
          result: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          executed_at?: string | null
          id?: string
          instruction: string
          instruction_type?: string | null
          priority?: number | null
          result?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          executed_at?: string | null
          id?: string
          instruction?: string
          instruction_type?: string | null
          priority?: number | null
          result?: string | null
          status?: string | null
        }
        Relationships: []
      }
      agent_knowledge: {
        Row: {
          check_frequency: string | null
          company_name: string
          company_type: string | null
          created_at: string | null
          crewing_email: string | null
          extraction_pattern: string | null
          fleet_types: string[] | null
          hr_email: string | null
          html_selector: string | null
          id: string
          is_active: boolean | null
          last_checked: string | null
          last_success: string | null
          notes: string | null
          preferred_nationalities: string[] | null
          salary_captain_max: number | null
          salary_captain_min: number | null
          success_rate: number | null
          total_vacancies_found: number | null
          typical_ranks: string[] | null
          updated_at: string | null
          vacancy_url: string | null
          vacancy_url_secondary: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          check_frequency?: string | null
          company_name: string
          company_type?: string | null
          created_at?: string | null
          crewing_email?: string | null
          extraction_pattern?: string | null
          fleet_types?: string[] | null
          hr_email?: string | null
          html_selector?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_success?: string | null
          notes?: string | null
          preferred_nationalities?: string[] | null
          salary_captain_max?: number | null
          salary_captain_min?: number | null
          success_rate?: number | null
          total_vacancies_found?: number | null
          typical_ranks?: string[] | null
          updated_at?: string | null
          vacancy_url?: string | null
          vacancy_url_secondary?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          check_frequency?: string | null
          company_name?: string
          company_type?: string | null
          created_at?: string | null
          crewing_email?: string | null
          extraction_pattern?: string | null
          fleet_types?: string[] | null
          hr_email?: string | null
          html_selector?: string | null
          id?: string
          is_active?: boolean | null
          last_checked?: string | null
          last_success?: string | null
          notes?: string | null
          preferred_nationalities?: string[] | null
          salary_captain_max?: number | null
          salary_captain_min?: number | null
          success_rate?: number | null
          total_vacancies_found?: number | null
          typical_ranks?: string[] | null
          updated_at?: string | null
          vacancy_url?: string | null
          vacancy_url_secondary?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      app_events: {
        Row: {
          created_at: string | null
          emailed: boolean | null
          event_type: string
          id: string
          message: string
          metadata: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emailed?: boolean | null
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emailed?: boolean | null
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
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
      company_contacts: {
        Row: {
          company_aliases: string[] | null
          company_name: string
          country: string | null
          created_at: string | null
          crewing_email: string | null
          hr_email: string | null
          id: string
          verified: boolean | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          company_aliases?: string[] | null
          company_name: string
          country?: string | null
          created_at?: string | null
          crewing_email?: string | null
          hr_email?: string | null
          id?: string
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          company_aliases?: string[] | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          crewing_email?: string | null
          hr_email?: string | null
          id?: string
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_demo_requests: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          fleet_size: string | null
          id: string
          message: string | null
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          fleet_size?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          fleet_size?: string | null
          id?: string
          message?: string | null
        }
        Relationships: []
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
          available_from: string | null
          created_at: string
          crew_unique_id: string | null
          cv_data: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: string | null
          home_city: string | null
          home_country: string | null
          home_country_code: string | null
          id: string
          is_available: boolean | null
          job_alerts_enabled: boolean
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
          preferred_vessel_types: string[] | null
          profile_visible: boolean | null
          role: string
          ship_name: string
          user_id: string | null
          vessel_imo: string | null
          vessel_type: string | null
          voyage_start_date: string | null
          whatsapp_number: string | null
          years_at_sea: string
        }
        Insert: {
          available_from?: string | null
          created_at?: string
          crew_unique_id?: string | null
          cv_data?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          is_available?: boolean | null
          job_alerts_enabled?: boolean
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
          preferred_vessel_types?: string[] | null
          profile_visible?: boolean | null
          role: string
          ship_name: string
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string | null
          years_at_sea?: string
        }
        Update: {
          available_from?: string | null
          created_at?: string
          crew_unique_id?: string | null
          cv_data?: string | null
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          home_city?: string | null
          home_country?: string | null
          home_country_code?: string | null
          id?: string
          is_available?: boolean | null
          job_alerts_enabled?: boolean
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
          preferred_vessel_types?: string[] | null
          profile_visible?: boolean | null
          role?: string
          ship_name?: string
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string | null
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
      email_leads: {
        Row: {
          converted: boolean | null
          crew_profile_id: string | null
          email: string
          first_name: string | null
          first_seen: string | null
          id: string
          last_name: string | null
          last_seen: string | null
          nationality: string | null
          notes: string | null
          promo_sent: boolean | null
          role: string | null
          source: string | null
          source_detail: string | null
          total_visits: number | null
          vessel_type: string | null
          whatsapp_number: string | null
        }
        Insert: {
          converted?: boolean | null
          crew_profile_id?: string | null
          email: string
          first_name?: string | null
          first_seen?: string | null
          id?: string
          last_name?: string | null
          last_seen?: string | null
          nationality?: string | null
          notes?: string | null
          promo_sent?: boolean | null
          role?: string | null
          source?: string | null
          source_detail?: string | null
          total_visits?: number | null
          vessel_type?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          converted?: boolean | null
          crew_profile_id?: string | null
          email?: string
          first_name?: string | null
          first_seen?: string | null
          id?: string
          last_name?: string | null
          last_seen?: string | null
          nationality?: string | null
          notes?: string | null
          promo_sent?: boolean | null
          role?: string | null
          source?: string | null
          source_detail?: string | null
          total_visits?: number | null
          vessel_type?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      external_vacancies: {
        Row: {
          apply_url: string | null
          company_name: string | null
          company_website: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          contract_duration: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          external_id: string
          fetched_at: string | null
          id: string
          is_scam_flagged: boolean | null
          is_verified: boolean | null
          joining_date: string | null
          joining_port: string | null
          quality_score: number | null
          rank_required: string | null
          raw_data: Json | null
          salary_max: number | null
          salary_min: number | null
          salary_text: string | null
          scam_flags: Json | null
          source: string
          title: string
          vessel_type: string | null
        }
        Insert: {
          apply_url?: string | null
          company_name?: string | null
          company_website?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          external_id: string
          fetched_at?: string | null
          id?: string
          is_scam_flagged?: boolean | null
          is_verified?: boolean | null
          joining_date?: string | null
          joining_port?: string | null
          quality_score?: number | null
          rank_required?: string | null
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          scam_flags?: Json | null
          source: string
          title: string
          vessel_type?: string | null
        }
        Update: {
          apply_url?: string | null
          company_name?: string | null
          company_website?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          contract_duration?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string
          fetched_at?: string | null
          id?: string
          is_scam_flagged?: boolean | null
          is_verified?: boolean | null
          joining_date?: string | null
          joining_port?: string | null
          quality_score?: number | null
          rank_required?: string | null
          raw_data?: Json | null
          salary_max?: number | null
          salary_min?: number | null
          salary_text?: string | null
          scam_flags?: Json | null
          source?: string
          title?: string
          vessel_type?: string | null
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
      manager_crew_contacts: {
        Row: {
          created_at: string | null
          crew_profile_id: string | null
          id: string
          manager_id: string | null
          message: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          crew_profile_id?: string | null
          id?: string
          manager_id?: string | null
          message?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          crew_profile_id?: string | null
          id?: string
          manager_id?: string | null
          message?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_crew_contacts_crew_profile_id_fkey"
            columns: ["crew_profile_id"]
            isOneToOne: false
            referencedRelation: "crew_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_crew_contacts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "manager_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_profiles: {
        Row: {
          admin_approved: boolean | null
          approved_at: string | null
          company_name: string
          company_verified: boolean | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          admin_approved?: boolean | null
          approved_at?: string | null
          company_name: string
          company_verified?: boolean | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          admin_approved?: boolean | null
          approved_at?: string | null
          company_name?: string
          company_verified?: boolean | null
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
      question_bank: {
        Row: {
          active: boolean | null
          correct_index: number
          correct_letter: string
          created_at: string | null
          difficulty: string | null
          domain: string
          explanation: string | null
          id: string
          options: Json
          question: string
          rank_group: string
          rank_specific: string | null
          regulation: string | null
          times_used: number | null
          vessel_type: string | null
        }
        Insert: {
          active?: boolean | null
          correct_index: number
          correct_letter: string
          created_at?: string | null
          difficulty?: string | null
          domain: string
          explanation?: string | null
          id?: string
          options: Json
          question: string
          rank_group: string
          rank_specific?: string | null
          regulation?: string | null
          times_used?: number | null
          vessel_type?: string | null
        }
        Update: {
          active?: boolean | null
          correct_index?: number
          correct_letter?: string
          created_at?: string | null
          difficulty?: string | null
          domain?: string
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          rank_group?: string
          rank_specific?: string | null
          regulation?: string | null
          times_used?: number | null
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
      signup_log: {
        Row: {
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          nationality: string | null
          notified: boolean | null
          role: string | null
          ship_name: string | null
          signed_up_at: string | null
          vessel_type: string | null
          whatsapp_number: string | null
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          notified?: boolean | null
          role?: string | null
          ship_name?: string | null
          signed_up_at?: string | null
          vessel_type?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          notified?: boolean | null
          role?: string | null
          ship_name?: string | null
          signed_up_at?: string | null
          vessel_type?: string | null
          whatsapp_number?: string | null
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
          dimension_scores: Json | null
          doc_upload_status: string
          english_score: number | null
          experience_score: number | null
          id: string
          overall_score: number | null
          recommendation: string | null
          red_flags: Json | null
          report: Json | null
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
          dimension_scores?: Json | null
          doc_upload_status?: string
          english_score?: number | null
          experience_score?: number | null
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
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
          dimension_scores?: Json | null
          doc_upload_status?: string
          english_score?: number | null
          experience_score?: number | null
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
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
      upsert_email_lead: {
        Args: {
          p_crew_profile_id?: string
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_nationality?: string
          p_role?: string
          p_source?: string
          p_source_detail?: string
          p_vessel_type?: string
          p_whatsapp?: string
        }
        Returns: undefined
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
