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
      ai_usage: {
        Row: {
          created_at: string
          est_cost_usd: number | null
          feature: string
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          est_cost_usd?: number | null
          feature: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          est_cost_usd?: number | null
          feature?: string
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          success?: boolean
          user_id?: string | null
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
      archived_orphan_profiles: {
        Row: {
          archived_at: string | null
          profile: Json | null
          reason: string | null
        }
        Insert: {
          archived_at?: string | null
          profile?: Json | null
          reason?: string | null
        }
        Update: {
          archived_at?: string | null
          profile?: Json | null
          reason?: string | null
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
      cached_stats: {
        Row: {
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
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
      company_fleet_links: {
        Row: {
          created_at: string
          crew_id: string
          expires_at: string | null
          id: string
          linked_at: string | null
          manager_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          expires_at?: string | null
          id?: string
          linked_at?: string | null
          manager_id: string
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          expires_at?: string | null
          id?: string
          linked_at?: string | null
          manager_id?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      company_posts: {
        Row: {
          caption: string
          company_name: string
          created_at: string
          flag_reason: string | null
          flagged: boolean | null
          id: string
          image_url: string | null
          interested_count: number | null
          link_url: string | null
          manager_id: string
          post_type: string
          ranks_detected: string[] | null
          reports: number | null
          status: string
          telegram_posted: boolean | null
          verified: boolean | null
          views: number | null
          whatsapp: string | null
        }
        Insert: {
          caption: string
          company_name: string
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          image_url?: string | null
          interested_count?: number | null
          link_url?: string | null
          manager_id: string
          post_type?: string
          ranks_detected?: string[] | null
          reports?: number | null
          status?: string
          telegram_posted?: boolean | null
          verified?: boolean | null
          views?: number | null
          whatsapp?: string | null
        }
        Update: {
          caption?: string
          company_name?: string
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean | null
          id?: string
          image_url?: string | null
          interested_count?: number | null
          link_url?: string | null
          manager_id?: string
          post_type?: string
          ranks_detected?: string[] | null
          reports?: number | null
          status?: string
          telegram_posted?: boolean | null
          verified?: boolean | null
          views?: number | null
          whatsapp?: string | null
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
      contact_reveals: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          manager_user_id: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          manager_user_id: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          manager_user_id?: string
        }
        Relationships: []
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
      contact_verifications: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          target: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          target: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          target?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      content_library: {
        Row: {
          active: boolean | null
          attribution: string | null
          body: string
          created_at: string | null
          cta_angle: string | null
          era: string | null
          hashtags: string | null
          hook: string | null
          id: string
          image_prompt: string | null
          incident_date: string | null
          kind: string
          lives_lost: string | null
          question: string | null
          regulation: string | null
          tags: string[] | null
          times_used: number | null
          title: string | null
        }
        Insert: {
          active?: boolean | null
          attribution?: string | null
          body: string
          created_at?: string | null
          cta_angle?: string | null
          era?: string | null
          hashtags?: string | null
          hook?: string | null
          id?: string
          image_prompt?: string | null
          incident_date?: string | null
          kind: string
          lives_lost?: string | null
          question?: string | null
          regulation?: string | null
          tags?: string[] | null
          times_used?: number | null
          title?: string | null
        }
        Update: {
          active?: boolean | null
          attribution?: string | null
          body?: string
          created_at?: string | null
          cta_angle?: string | null
          era?: string | null
          hashtags?: string | null
          hook?: string | null
          id?: string
          image_prompt?: string | null
          incident_date?: string | null
          kind?: string
          lives_lost?: string | null
          question?: string | null
          regulation?: string | null
          tags?: string[] | null
          times_used?: number | null
          title?: string | null
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
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          manager_user_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          manager_user_id: string
          reason: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          manager_user_id?: string
          reason?: string
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
      crew_claims: {
        Row: {
          assessed_at: string | null
          claim_key: string
          created_at: string
          crew_id: string
          id: string
          status: string
          updated_at: string
          value: string
          verified_at: string | null
        }
        Insert: {
          assessed_at?: string | null
          claim_key: string
          created_at?: string
          crew_id: string
          id?: string
          status?: string
          updated_at?: string
          value: string
          verified_at?: string | null
        }
        Update: {
          assessed_at?: string | null
          claim_key?: string
          created_at?: string
          crew_id?: string
          id?: string
          status?: string
          updated_at?: string
          value?: string
          verified_at?: string | null
        }
        Relationships: []
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
          ai_confidence: number | null
          category: string
          created_at: string
          crew_profile_id: string
          doc_number: string | null
          doc_type: string | null
          expiry_date: string | null
          extraction_status: string
          file_name: string
          id: string
          issue_date: string | null
          issuing_authority: string | null
          source: string
          storage_path: string
        }
        Insert: {
          ai_confidence?: number | null
          category: string
          created_at?: string
          crew_profile_id: string
          doc_number?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          extraction_status?: string
          file_name: string
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          source?: string
          storage_path: string
        }
        Update: {
          ai_confidence?: number | null
          category?: string
          created_at?: string
          crew_profile_id?: string
          doc_number?: string | null
          doc_type?: string | null
          expiry_date?: string | null
          extraction_status?: string
          file_name?: string
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
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
          cdc_applied: boolean
          contracts_in_rank_band: string | null
          created_at: string
          crew_unique_id: string | null
          cv_data: string | null
          date_of_birth: string | null
          email: string | null
          email_verified: boolean
          email_verified_at: string | null
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
          phone_valid: boolean
          placed_company: string | null
          placed_until: string | null
          port_of_joining: string | null
          preferred_vessel_types: string[] | null
          profile_visible: boolean | null
          quick_profile_completed_at: string | null
          rank: string | null
          referral_claimed_at: string | null
          referred_by: string | null
          role: string
          ship_name: string
          total_sea_service_band: string | null
          user_id: string | null
          vessel_imo: string | null
          vessel_type: string | null
          voyage_start_date: string | null
          whatsapp_number: string | null
          whatsapp_verification_token: string | null
          whatsapp_verified: boolean
          whatsapp_verified_at: string | null
          years_at_sea: string
          years_in_rank_band: string | null
        }
        Insert: {
          available_from?: string | null
          cdc_applied?: boolean
          contracts_in_rank_band?: string | null
          created_at?: string
          crew_unique_id?: string | null
          cv_data?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
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
          phone_valid?: boolean
          placed_company?: string | null
          placed_until?: string | null
          port_of_joining?: string | null
          preferred_vessel_types?: string[] | null
          profile_visible?: boolean | null
          quick_profile_completed_at?: string | null
          rank?: string | null
          referral_claimed_at?: string | null
          referred_by?: string | null
          role: string
          ship_name: string
          total_sea_service_band?: string | null
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string | null
          whatsapp_verification_token?: string | null
          whatsapp_verified?: boolean
          whatsapp_verified_at?: string | null
          years_at_sea?: string
          years_in_rank_band?: string | null
        }
        Update: {
          available_from?: string | null
          cdc_applied?: boolean
          contracts_in_rank_band?: string | null
          created_at?: string
          crew_unique_id?: string | null
          cv_data?: string | null
          date_of_birth?: string | null
          email?: string | null
          email_verified?: boolean
          email_verified_at?: string | null
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
          phone_valid?: boolean
          placed_company?: string | null
          placed_until?: string | null
          port_of_joining?: string | null
          preferred_vessel_types?: string[] | null
          profile_visible?: boolean | null
          quick_profile_completed_at?: string | null
          rank?: string | null
          referral_claimed_at?: string | null
          referred_by?: string | null
          role?: string
          ship_name?: string
          total_sea_service_band?: string | null
          user_id?: string | null
          vessel_imo?: string | null
          vessel_type?: string | null
          voyage_start_date?: string | null
          whatsapp_number?: string | null
          whatsapp_verification_token?: string | null
          whatsapp_verified?: boolean
          whatsapp_verified_at?: string | null
          years_at_sea?: string
          years_in_rank_band?: string | null
        }
        Relationships: []
      }
      crew_vessel_experience: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          sea_time_band: string
          vessel_family: string
        }
        Insert: {
          created_at?: string
          crew_id: string
          id?: string
          sea_time_band: string
          vessel_family: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          sea_time_band?: string
          vessel_family?: string
        }
        Relationships: []
      }
      cta_library: {
        Row: {
          active: boolean | null
          audience: string
          id: string
          intent: string
          line: string
          priority: number | null
          url: string
        }
        Insert: {
          active?: boolean | null
          audience: string
          id?: string
          intent: string
          line: string
          priority?: number | null
          url: string
        }
        Update: {
          active?: boolean | null
          audience?: string
          id?: string
          intent?: string
          line?: string
          priority?: number | null
          url?: string
        }
        Relationships: []
      }
      cv_access_log: {
        Row: {
          action: string
          company_name: string | null
          created_at: string
          crew_user_id: string | null
          id: string
          manager_user_id: string
        }
        Insert: {
          action?: string
          company_name?: string | null
          created_at?: string
          crew_user_id?: string | null
          id?: string
          manager_user_id: string
        }
        Update: {
          action?: string
          company_name?: string | null
          created_at?: string
          crew_user_id?: string | null
          id?: string
          manager_user_id?: string
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
      document_requirements: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          is_mandatory: boolean
          notes: string | null
          rank: string
          vessel_type: string | null
        }
        Insert: {
          created_at?: string
          doc_type: string
          id?: string
          is_mandatory?: boolean
          notes?: string | null
          rank: string
          vessel_type?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          is_mandatory?: boolean
          notes?: string | null
          rank?: string
          vessel_type?: string | null
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
          email_verified: boolean | null
          first_name: string | null
          first_seen: string | null
          id: string
          last_name: string | null
          last_seen: string | null
          nationality: string | null
          notes: string | null
          phone_verified: boolean | null
          promo_sent: boolean | null
          retained_from_deleted_cv: boolean | null
          role: string | null
          source: string | null
          source_detail: string | null
          total_visits: number | null
          verified_at: string | null
          vessel_type: string | null
          whatsapp_number: string | null
        }
        Insert: {
          converted?: boolean | null
          crew_profile_id?: string | null
          email: string
          email_verified?: boolean | null
          first_name?: string | null
          first_seen?: string | null
          id?: string
          last_name?: string | null
          last_seen?: string | null
          nationality?: string | null
          notes?: string | null
          phone_verified?: boolean | null
          promo_sent?: boolean | null
          retained_from_deleted_cv?: boolean | null
          role?: string | null
          source?: string | null
          source_detail?: string | null
          total_visits?: number | null
          verified_at?: string | null
          vessel_type?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          converted?: boolean | null
          crew_profile_id?: string | null
          email?: string
          email_verified?: boolean | null
          first_name?: string | null
          first_seen?: string | null
          id?: string
          last_name?: string | null
          last_seen?: string | null
          nationality?: string | null
          notes?: string | null
          phone_verified?: boolean | null
          promo_sent?: boolean | null
          retained_from_deleted_cv?: boolean | null
          role?: string | null
          source?: string | null
          source_detail?: string | null
          total_visits?: number | null
          verified_at?: string | null
          vessel_type?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          external_ref: string | null
          holder_id: string
          id: string
          product: string
          source: string
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          external_ref?: string | null
          holder_id: string
          id?: string
          product: string
          source?: string
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          external_ref?: string | null
          holder_id?: string
          id?: string
          product?: string
          source?: string
          status?: string
          updated_at?: string
          valid_until?: string | null
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
          dedup_key: string | null
          description: string | null
          expires_at: string | null
          external_id: string
          fetched_at: string | null
          first_seen_at: string
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
          source_posted_at: string | null
          telegram_posted: boolean | null
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
          dedup_key?: string | null
          description?: string | null
          expires_at?: string | null
          external_id: string
          fetched_at?: string | null
          first_seen_at?: string
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
          source_posted_at?: string | null
          telegram_posted?: boolean | null
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
          dedup_key?: string | null
          description?: string | null
          expires_at?: string | null
          external_id?: string
          fetched_at?: string | null
          first_seen_at?: string
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
          source_posted_at?: string | null
          telegram_posted?: boolean | null
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
      feed_interactions: {
        Row: {
          action: string
          created_at: string
          crew_id: string
          id: string
          item_id: string
          item_type: string
          position: number | null
        }
        Insert: {
          action: string
          created_at?: string
          crew_id: string
          id?: string
          item_id: string
          item_type: string
          position?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          crew_id?: string
          id?: string
          item_id?: string
          item_type?: string
          position?: number | null
        }
        Relationships: []
      }
      interview_answers: {
        Row: {
          ai_score: number | null
          answer: string
          assessment_id: string
          created_at: string
          id: string
          is_followup: boolean
          matrix_version: string | null
          question: string
          question_type: string | null
          red_flag: boolean | null
          red_flag_category: string | null
          seq: number
        }
        Insert: {
          ai_score?: number | null
          answer: string
          assessment_id: string
          created_at?: string
          id?: string
          is_followup?: boolean
          matrix_version?: string | null
          question: string
          question_type?: string | null
          red_flag?: boolean | null
          red_flag_category?: string | null
          seq: number
        }
        Update: {
          ai_score?: number | null
          answer?: string
          assessment_id?: string
          created_at?: string
          id?: string
          is_followup?: boolean
          matrix_version?: string | null
          question?: string
          question_type?: string | null
          red_flag?: boolean | null
          red_flag_category?: string | null
          seq?: number
        }
        Relationships: []
      }
      interview_campaigns: {
        Row: {
          closes_at: string | null
          company_name: string
          created_at: string
          difficulty: string | null
          id: string
          language: string
          manager_id: string
          open_link_token: string | null
          rank_required: string
          sections: string[] | null
          status: string
          title: string
          vessel_type: string | null
        }
        Insert: {
          closes_at?: string | null
          company_name: string
          created_at?: string
          difficulty?: string | null
          id?: string
          language?: string
          manager_id: string
          open_link_token?: string | null
          rank_required: string
          sections?: string[] | null
          status?: string
          title: string
          vessel_type?: string | null
        }
        Update: {
          closes_at?: string | null
          company_name?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          language?: string
          manager_id?: string
          open_link_token?: string | null
          rank_required?: string
          sections?: string[] | null
          status?: string
          title?: string
          vessel_type?: string | null
        }
        Relationships: []
      }
      interview_invites: {
        Row: {
          assessment_id: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string
          crew_profile_id: string | null
          id: string
          invited_email: string | null
          invited_name: string | null
          invited_whatsapp: string | null
          manager_note: string | null
          overall_score: number | null
          shortlisted: boolean | null
          status: string
          token: string
        }
        Insert: {
          assessment_id?: string | null
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          crew_profile_id?: string | null
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          invited_whatsapp?: string | null
          manager_note?: string | null
          overall_score?: number | null
          shortlisted?: boolean | null
          status?: string
          token: string
        }
        Update: {
          assessment_id?: string | null
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          crew_profile_id?: string | null
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          invited_whatsapp?: string | null
          manager_note?: string | null
          overall_score?: number | null
          shortlisted?: boolean | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_invites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "interview_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_matrix: {
        Row: {
          created_at: string
          department: string
          experience_tier: string
          id: string
          notes: string | null
          rank_group: string
          scenario_weight: number
          senior_mode: boolean
          technical_weight: number
          topics: Json
          vessel_type: string | null
        }
        Insert: {
          created_at?: string
          department: string
          experience_tier: string
          id?: string
          notes?: string | null
          rank_group: string
          scenario_weight?: number
          senior_mode?: boolean
          technical_weight?: number
          topics?: Json
          vessel_type?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          experience_tier?: string
          id?: string
          notes?: string | null
          rank_group?: string
          scenario_weight?: number
          senior_mode?: boolean
          technical_weight?: number
          topics?: Json
          vessel_type?: string | null
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
          near_miss_detail: string | null
          psc_detention: boolean | null
          psc_detention_detail: string | null
          reason_for_leaving: string | null
          safety_violation: boolean | null
          safety_violation_detail: string | null
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
          near_miss_detail?: string | null
          psc_detention?: boolean | null
          psc_detention_detail?: string | null
          reason_for_leaving?: string | null
          safety_violation?: boolean | null
          safety_violation_detail?: string | null
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
          near_miss_detail?: string | null
          psc_detention?: boolean | null
          psc_detention_detail?: string | null
          reason_for_leaving?: string | null
          safety_violation?: boolean | null
          safety_violation_detail?: string | null
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
      interview_progress: {
        Row: {
          answers: Json | null
          assessment_id: string | null
          campaign_id: string | null
          created_at: string | null
          crew_id: string
          id: string
          invite_id: string | null
          last_saved_at: string | null
          question_index: number | null
          questions: Json | null
          resumed_count: number | null
          seconds_left: number | null
        }
        Insert: {
          answers?: Json | null
          assessment_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          crew_id: string
          id?: string
          invite_id?: string | null
          last_saved_at?: string | null
          question_index?: number | null
          questions?: Json | null
          resumed_count?: number | null
          seconds_left?: number | null
        }
        Update: {
          answers?: Json | null
          assessment_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          crew_id?: string
          id?: string
          invite_id?: string | null
          last_saved_at?: string | null
          question_index?: number | null
          questions?: Json | null
          resumed_count?: number | null
          seconds_left?: number | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          apply_method: string
          available_from: string | null
          company_name: string | null
          company_post_id: string | null
          created_at: string
          crew_accepted_at: string | null
          crew_id: string
          cv_complete: boolean | null
          external_url: string | null
          had_cv: boolean | null
          id: string
          job_posting_id: string | null
          manager_note: string | null
          offered_at: string | null
          offered_joining_date: string | null
          outcome: string | null
          placement_end: string | null
          rank_applied: string | null
          released_at: string | null
          vacancy_id: string | null
          vessel_type: string | null
          viewed_at: string | null
        }
        Insert: {
          apply_method?: string
          available_from?: string | null
          company_name?: string | null
          company_post_id?: string | null
          created_at?: string
          crew_accepted_at?: string | null
          crew_id: string
          cv_complete?: boolean | null
          external_url?: string | null
          had_cv?: boolean | null
          id?: string
          job_posting_id?: string | null
          manager_note?: string | null
          offered_at?: string | null
          offered_joining_date?: string | null
          outcome?: string | null
          placement_end?: string | null
          rank_applied?: string | null
          released_at?: string | null
          vacancy_id?: string | null
          vessel_type?: string | null
          viewed_at?: string | null
        }
        Update: {
          apply_method?: string
          available_from?: string | null
          company_name?: string | null
          company_post_id?: string | null
          created_at?: string
          crew_accepted_at?: string | null
          crew_id?: string
          cv_complete?: boolean | null
          external_url?: string | null
          had_cv?: boolean | null
          id?: string
          job_posting_id?: string | null
          manager_note?: string | null
          offered_at?: string | null
          offered_joining_date?: string | null
          outcome?: string | null
          placement_end?: string | null
          rank_applied?: string | null
          released_at?: string | null
          vacancy_id?: string | null
          vessel_type?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          additional_notes: string | null
          company_name: string
          contact_whatsapp: string
          contract_duration: string
          created_at: string
          flier_url: string | null
          id: string
          joining_port: string
          manager_id: string | null
          monthly_salary: string | null
          plan: string
          rank_required: string
          status: string
          telegram_posted: boolean | null
          verified: boolean
          vessel_type: string
        }
        Insert: {
          additional_notes?: string | null
          company_name: string
          contact_whatsapp: string
          contract_duration: string
          created_at?: string
          flier_url?: string | null
          id?: string
          joining_port: string
          manager_id?: string | null
          monthly_salary?: string | null
          plan?: string
          rank_required: string
          status?: string
          telegram_posted?: boolean | null
          verified?: boolean
          vessel_type: string
        }
        Update: {
          additional_notes?: string | null
          company_name?: string
          contact_whatsapp?: string
          contract_duration?: string
          created_at?: string
          flier_url?: string | null
          id?: string
          joining_port?: string
          manager_id?: string | null
          monthly_salary?: string | null
          plan?: string
          rank_required?: string
          status?: string
          telegram_posted?: boolean | null
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
          company_type: string | null
          company_verified: boolean | null
          country: string | null
          created_at: string
          designation: string | null
          dpa_name: string | null
          emergency_email: string | null
          emergency_phone: string | null
          emergency_updated_at: string | null
          fleet_active: boolean
          fleet_until: string | null
          full_name: string | null
          id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          admin_approved?: boolean | null
          approved_at?: string | null
          company_name: string
          company_type?: string | null
          company_verified?: boolean | null
          country?: string | null
          created_at?: string
          designation?: string | null
          dpa_name?: string | null
          emergency_email?: string | null
          emergency_phone?: string | null
          emergency_updated_at?: string | null
          fleet_active?: boolean
          fleet_until?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          user_id: string
        }
        Update: {
          admin_approved?: boolean | null
          approved_at?: string | null
          company_name?: string
          company_type?: string | null
          company_verified?: boolean | null
          country?: string | null
          created_at?: string
          designation?: string | null
          dpa_name?: string | null
          emergency_email?: string | null
          emergency_phone?: string | null
          emergency_updated_at?: string | null
          fleet_active?: boolean
          fleet_until?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_content: {
        Row: {
          active: boolean | null
          country: string
          country_code: string
          crew_share: number | null
          cta_cv: string | null
          cta_jobs: string | null
          cta_nofees: string | null
          cta_score: string | null
          flag: string | null
          hashtags_ig: string | null
          hashtags_ig_extended: string | null
          hashtags_li: string | null
          hashtags_tiktok: string | null
          hashtags_x: string | null
          id: string
          language: string
          language_logic: string | null
          language_name: string
          notes: string | null
          social_platforms: string | null
          use_english: boolean | null
        }
        Insert: {
          active?: boolean | null
          country: string
          country_code: string
          crew_share?: number | null
          cta_cv?: string | null
          cta_jobs?: string | null
          cta_nofees?: string | null
          cta_score?: string | null
          flag?: string | null
          hashtags_ig?: string | null
          hashtags_ig_extended?: string | null
          hashtags_li?: string | null
          hashtags_tiktok?: string | null
          hashtags_x?: string | null
          id?: string
          language: string
          language_logic?: string | null
          language_name: string
          notes?: string | null
          social_platforms?: string | null
          use_english?: boolean | null
        }
        Update: {
          active?: boolean | null
          country?: string
          country_code?: string
          crew_share?: number | null
          cta_cv?: string | null
          cta_jobs?: string | null
          cta_nofees?: string | null
          cta_score?: string | null
          flag?: string | null
          hashtags_ig?: string | null
          hashtags_ig_extended?: string | null
          hashtags_li?: string | null
          hashtags_tiktok?: string | null
          hashtags_x?: string | null
          id?: string
          language?: string
          language_logic?: string | null
          language_name?: string
          notes?: string | null
          social_platforms?: string | null
          use_english?: boolean | null
        }
        Relationships: []
      }
      marketing_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_channels: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          label: string | null
          platform: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          platform: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          platform?: string
          url?: string
        }
        Relationships: []
      }
      marketing_team: {
        Row: {
          active: boolean
          added_by: string | null
          created_at: string
          email: string
          user_id: string
        }
        Insert: {
          active?: boolean
          added_by?: string | null
          created_at?: string
          email: string
          user_id: string
        }
        Update: {
          active?: boolean
          added_by?: string | null
          created_at?: string
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      mobile_verifications: {
        Row: {
          created_at: string
          email: string | null
          email_verified: boolean
          full_name: string | null
          id: string
          notes: string | null
          phone_number: string
          provider: string
          updated_at: string
          user_id: string
          verification_status: string
          verification_token: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id?: string
          notes?: string | null
          phone_number: string
          provider?: string
          updated_at?: string
          user_id: string
          verification_status?: string
          verification_token: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          email_verified?: boolean
          full_name?: string | null
          id?: string
          notes?: string | null
          phone_number?: string
          provider?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          verification_token?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          crew_id: string
          icon: string | null
          id: string
          kind: string
          read: boolean | null
          screen: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          crew_id: string
          icon?: string | null
          id?: string
          kind: string
          read?: boolean | null
          screen?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          crew_id?: string
          icon?: string | null
          id?: string
          kind?: string
          read?: boolean | null
          screen?: string | null
          title?: string
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
      post_engagement: {
        Row: {
          action: string
          created_at: string
          crew_id: string
          id: string
          post_id: string
        }
        Insert: {
          action: string
          created_at?: string
          crew_id: string
          id?: string
          post_id: string
        }
        Update: {
          action?: string
          created_at?: string
          crew_id?: string
          id?: string
          post_id?: string
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
      quiz_answers: {
        Row: {
          chosen_index: number | null
          created_at: string
          crew_id: string
          id: string
          is_correct: boolean | null
          question_id: string
        }
        Insert: {
          chosen_index?: number | null
          created_at?: string
          crew_id: string
          id?: string
          is_correct?: boolean | null
          question_id: string
        }
        Update: {
          chosen_index?: number | null
          created_at?: string
          crew_id?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
        }
        Relationships: []
      }
      rank_standards: {
        Row: {
          label: string
          min_contracts: number
          min_english: number
          min_overall: number
          min_years: number
          note: string | null
          rank_group: string
        }
        Insert: {
          label: string
          min_contracts: number
          min_english: number
          min_overall: number
          min_years: number
          note?: string | null
          rank_group: string
        }
        Update: {
          label?: string
          min_contracts?: number
          min_english?: number
          min_overall?: number
          min_years?: number
          note?: string | null
          rank_group?: string
        }
        Relationships: []
      }
      rank_taxonomy: {
        Row: {
          department: string
          rank_group: string
          rank_pattern: string
        }
        Insert: {
          department: string
          rank_group: string
          rank_pattern: string
        }
        Update: {
          department?: string
          rank_group?: string
          rank_pattern?: string
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
      scoring_jobs: {
        Row: {
          assessment_id: string
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          status: string
        }
        Insert: {
          assessment_id: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload: Json
          status?: string
        }
        Update: {
          assessment_id?: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      ship_photos: {
        Row: {
          active: boolean | null
          caption: string | null
          created_at: string | null
          credit: string | null
          id: string
          photo_url: string
          query: string | null
        }
        Insert: {
          active?: boolean | null
          caption?: string | null
          created_at?: string | null
          credit?: string | null
          id?: string
          photo_url: string
          query?: string | null
        }
        Update: {
          active?: boolean | null
          caption?: string | null
          created_at?: string | null
          credit?: string | null
          id?: string
          photo_url?: string
          query?: string | null
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
          interview_mode: string | null
          judgment_score: number | null
          overall_score: number | null
          probed_claims: Json | null
          recommendation: string | null
          red_flags: Json | null
          report: Json | null
          score_band: string | null
          scoring_version: string | null
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
          interview_mode?: string | null
          judgment_score?: number | null
          overall_score?: number | null
          probed_claims?: Json | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
          score_band?: string | null
          scoring_version?: string | null
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
          interview_mode?: string | null
          judgment_score?: number | null
          overall_score?: number | null
          probed_claims?: Json | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
          score_band?: string | null
          scoring_version?: string | null
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
      vacancy_sources: {
        Row: {
          active: boolean
          consecutive_failures: number
          created_at: string
          id: string
          kind: string
          label: string | null
          language: string | null
          last_error: string | null
          last_items: number | null
          last_run_at: string | null
          method: string
          notes: string | null
          region: string | null
          url: string | null
          value: string
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          language?: string | null
          last_error?: string | null
          last_items?: number | null
          last_run_at?: string | null
          method?: string
          notes?: string | null
          region?: string | null
          url?: string | null
          value: string
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          language?: string | null
          last_error?: string | null
          last_items?: number | null
          last_run_at?: string | null
          method?: string
          notes?: string | null
          region?: string | null
          url?: string | null
          value?: string
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
      question_bank_public: {
        Row: {
          active: boolean | null
          created_at: string | null
          difficulty: string | null
          domain: string | null
          id: string | null
          options: Json | null
          question: string | null
          rank_group: string | null
          rank_specific: string | null
          regulation: string | null
          times_used: number | null
          vessel_type: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          difficulty?: string | null
          domain?: string | null
          id?: string | null
          options?: Json | null
          question?: string | null
          rank_group?: string | null
          rank_specific?: string | null
          regulation?: string | null
          times_used?: number | null
          vessel_type?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          difficulty?: string | null
          domain?: string | null
          id?: string | null
          options?: Json | null
          question?: string | null
          rank_group?: string | null
          rank_specific?: string | null
          regulation?: string | null
          times_used?: number | null
          vessel_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_interview_invites: {
        Args: { p_campaign_id: string; p_people: Json }
        Returns: Json
      }
      admin_manage_marketing_member: {
        Args: { p_activate: boolean; p_email: string }
        Returns: string
      }
      ai_spend_sentinel: { Args: never; Returns: string }
      apply_to_job: {
        Args: {
          p_company?: string
          p_method?: string
          p_rank?: string
          p_vacancy_id: string
          p_vessel?: string
        }
        Returns: Json
      }
      band_years_midpoint: { Args: { p_band: string }; Returns: number }
      build_daily_notifications: { Args: never; Returns: string }
      build_post: {
        Args: { p_audience?: string; p_id?: string; p_kind?: string }
        Returns: Json
      }
      campaign_leaderboard: {
        Args: { p_campaign_id: string }
        Returns: {
          band: string
          behavioural: number
          completed_at: string
          english: number
          invite_id: string
          name: string
          nationality: string
          overall: number
          red_flag_count: number
          shortlisted: boolean
          status: string
          technical: number
          token: string
          wellness: number
          whatsapp: string
        }[]
      }
      claim_interview: {
        Args: { p_assessment_id?: string; p_token: string }
        Returns: Json
      }
      claim_referral: { Args: { p_code: string }; Returns: Json }
      complete_interview: {
        Args: { p_assessment_id: string; p_invite_id: string }
        Returns: Json
      }
      contracts_midpoint: { Args: { p_band: string }; Returns: number }
      count_matching_vacancies: {
        Args: { p_families?: string[]; p_rank?: string }
        Returns: number
      }
      create_interview_campaign: {
        Args: {
          p_closes_at?: string
          p_language?: string
          p_rank: string
          p_sections?: string[]
          p_title: string
          p_vessel?: string
        }
        Returns: Json
      }
      crew_respond_fleet_link: {
        Args: { p_accept: boolean; p_link_id: string }
        Returns: Json
      }
      crew_respond_offer: {
        Args: { p_accept: boolean; p_application_id: string }
        Returns: Json
      }
      cv_interview_readiness: {
        Args: { p_crew_id: string; p_target_rank?: string }
        Returns: Json
      }
      enforce_retention: { Args: never; Returns: string }
      engage_company_post: {
        Args: { p_action: string; p_post_id: string }
        Returns: Json
      }
      enqueue_scoring: { Args: { p_assessment_id: string }; Returns: Json }
      expire_old_vacancies: { Args: never; Returns: string }
      fleet_add_crew: { Args: { p_crew_email: string }; Returns: Json }
      fleet_gate_open: {
        Args: { p_mp: Database["public"]["Tables"]["manager_profiles"]["Row"] }
        Returns: boolean
      }
      get_admin_settings: {
        Args: { p_keys: string[] }
        Returns: {
          key: string
          value: string
        }[]
      }
      get_cert_readiness: { Args: never; Returns: Json }
      get_cta_block: {
        Args: { p_audience?: string; p_count?: number; p_intents?: string[] }
        Returns: string
      }
      get_interested_crew: {
        Args: { p_post_id: string }
        Returns: {
          crew_id: string
          first_name: string
          nationality: string
          rank: string
          since: string
          whatsapp: string
        }[]
      }
      get_interview_by_token: { Args: { p_token: string }; Returns: Json }
      get_market_indices: { Args: never; Returns: Json }
      get_my_applicants: { Args: never; Returns: Json }
      get_my_credit_balance: { Args: never; Returns: Json }
      get_my_fleet: { Args: never; Returns: Json }
      get_my_referral_stats: { Args: never; Returns: Json }
      get_my_safety_reports: { Args: never; Returns: Json }
      get_my_sos_contacts: { Args: never; Returns: Json }
      get_public_ticker_stats: { Args: never; Returns: Json }
      get_social_pulse: { Args: never; Returns: Json }
      get_trade_log: { Args: { p_limit?: number }; Returns: Json }
      get_voyage_state: { Args: never; Returns: Json }
      grant_monthly_credits: { Args: never; Returns: string }
      has_entitlement: {
        Args: { p_holder: string; p_product: string }
        Returns: boolean
      }
      increment_discount_uses: {
        Args: { input_code: string }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_marketing_member: { Args: never; Returns: boolean }
      log_marketing_action: {
        Args: { p_action: string; p_details?: Json }
        Returns: undefined
      }
      make_invite_token: { Args: never; Returns: string }
      manager_update_application: {
        Args: {
          p_action: string
          p_application_id: string
          p_contract_months?: number
          p_joining_date?: string
        }
        Returns: Json
      }
      manager_update_safety_status: {
        Args: { p_id: string; p_status: string }
        Returns: Json
      }
      marketing_pack_daily: { Args: never; Returns: string }
      outreach_digest_scan: { Args: never; Returns: string }
      owns_crew_profile: {
        Args: { _crew_profile_id: string }
        Returns: boolean
      }
      placement_release_scan: { Args: never; Returns: string }
      process_scoring_jobs: { Args: never; Returns: string }
      rank_group_of: { Args: { p_rank: string }; Returns: string }
      refresh_ticker_stats: { Args: never; Returns: undefined }
      report_company_post: {
        Args: { post_id: string; reason?: string }
        Returns: boolean
      }
      resolve_interview_spec: {
        Args: { p_rank: string; p_vessel: string; p_years_in_rank: number }
        Returns: Json
      }
      resolve_interview_spec_v2: {
        Args: {
          p_contracts_in_rank: number
          p_cv_claims?: Json
          p_rank: string
          p_specialist?: string
          p_vacancy_topics?: Json
          p_vessel: string
          p_years_in_rank: number
        }
        Returns: Json
      }
      resolve_rank: { Args: { p_rank: string }; Returns: Json }
      reveal_contact: { Args: { p_crew_id: string }; Returns: Json }
      seaminds_housekeeping: { Args: never; Returns: string }
      search_maritime_history: {
        Args: { p_kind?: string; p_limit?: number; p_query?: string }
        Returns: {
          attribution: string
          body: string
          cta_angle: string
          id: string
          incident_date: string
          kind: string
          lives_lost: string
          regulation: string
          tags: string[]
          title: string
        }[]
      }
      submit_application: {
        Args: {
          p_company_name?: string
          p_company_post_id?: string
          p_external_url?: string
          p_rank?: string
          p_vacancy_id?: string
          p_vessel?: string
        }
        Returns: Json
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
      validate_discount_code: {
        Args: { input_code: string; product_scope: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "discount_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      verify_certificate: { Args: { p_id: string }; Returns: Json }
      verify_marketing_pin: { Args: { p_pin: string }; Returns: boolean }
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
