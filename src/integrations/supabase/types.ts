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
      answer_ledger: {
        Row: {
          answer: string
          answer_state: string
          answered_at: string
          assessment_id: string
          crew_profile_id: string
          evaluated_at: string | null
          id: string
          is_correct: boolean | null
          item_type: string
          last_scoring_error: string | null
          paper_id: string
          paper_item_id: string
          result: Json | null
          score: number | null
          scoring_attempts: number
          scoring_state: string
          submit_ip: string | null
        }
        Insert: {
          answer: string
          answer_state?: string
          answered_at?: string
          assessment_id: string
          crew_profile_id: string
          evaluated_at?: string | null
          id?: string
          is_correct?: boolean | null
          item_type: string
          last_scoring_error?: string | null
          paper_id: string
          paper_item_id: string
          result?: Json | null
          score?: number | null
          scoring_attempts?: number
          scoring_state: string
          submit_ip?: string | null
        }
        Update: {
          answer?: string
          answer_state?: string
          answered_at?: string
          assessment_id?: string
          crew_profile_id?: string
          evaluated_at?: string | null
          id?: string
          is_correct?: boolean | null
          item_type?: string
          last_scoring_error?: string | null
          paper_id?: string
          paper_item_id?: string
          result?: Json | null
          score?: number | null
          scoring_attempts?: number
          scoring_state?: string
          submit_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_ledger_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_ledger_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "issued_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      answer_scoring_audit: {
        Row: {
          attempt: number | null
          created_at: string
          id: number
          job_id: string | null
          ledger_id: string
          model: string | null
          outcome: string
          reason: string | null
        }
        Insert: {
          attempt?: number | null
          created_at?: string
          id?: number
          job_id?: string | null
          ledger_id: string
          model?: string | null
          outcome: string
          reason?: string | null
        }
        Update: {
          attempt?: number | null
          created_at?: string
          id?: number
          job_id?: string | null
          ledger_id?: string
          model?: string | null
          outcome?: string
          reason?: string | null
        }
        Relationships: []
      }
      answer_scoring_jobs: {
        Row: {
          assessment_id: string
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          ledger_id: string
          max_attempts: number
          next_attempt_at: string
          status: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          ledger_id: string
          max_attempts?: number
          next_attempt_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          ledger_id?: string
          max_attempts?: number
          next_attempt_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_scoring_jobs_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: true
            referencedRelation: "answer_ledger"
            referencedColumns: ["id"]
          },
        ]
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
      assessment_blueprints: {
        Row: {
          blueprint_version: number
          canonical_rank: string
          created_at: string
          department: string
          id: string
          is_test: boolean
          level: string
          notes: string | null
          requirements: Json
          requirements_by_mode: Json | null
          status: string
          vessel_context: string
        }
        Insert: {
          blueprint_version?: number
          canonical_rank: string
          created_at?: string
          department: string
          id?: string
          is_test?: boolean
          level: string
          notes?: string | null
          requirements: Json
          requirements_by_mode?: Json | null
          status?: string
          vessel_context?: string
        }
        Update: {
          blueprint_version?: number
          canonical_rank?: string
          created_at?: string
          department?: string
          id?: string
          is_test?: boolean
          level?: string
          notes?: string | null
          requirements?: Json
          requirements_by_mode?: Json | null
          status?: string
          vessel_context?: string
        }
        Relationships: []
      }
      assessment_checkpoints: {
        Row: {
          assessment_id: string
          crew_profile_id: string
          current_index: number
          delivered_at: string | null
          elapsed_seconds: number
          interrupted_at: string | null
          interruption_reason: string | null
          interruption_state: string | null
          last_seen_at: string
          lifecycle_state: string
          paper_id: string | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          crew_profile_id: string
          current_index?: number
          delivered_at?: string | null
          elapsed_seconds?: number
          interrupted_at?: string | null
          interruption_reason?: string | null
          interruption_state?: string | null
          last_seen_at?: string
          lifecycle_state?: string
          paper_id?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          crew_profile_id?: string
          current_index?: number
          delivered_at?: string | null
          elapsed_seconds?: number
          interrupted_at?: string | null
          interruption_reason?: string | null
          interruption_state?: string | null
          last_seen_at?: string
          lifecycle_state?: string
          paper_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_checkpoints_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          answer_key: Json
          approval_basis: string | null
          approval_status: string
          cognitive_level: string | null
          created_at: string
          department: string | null
          domain: string | null
          exposure_count: number
          id: string
          is_active: boolean
          item_key: string
          legacy_question_bank_id: string | null
          legacy_rank_group: string | null
          level: string | null
          prompt: Json
          question_type: string
          question_version: number
          rank_scope: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          source_reference: string | null
          source_type: string
          source_version: string | null
          updated_at: string
          vessel_scope: string[]
        }
        Insert: {
          answer_key?: Json
          approval_basis?: string | null
          approval_status?: string
          cognitive_level?: string | null
          created_at?: string
          department?: string | null
          domain?: string | null
          exposure_count?: number
          id?: string
          is_active?: boolean
          item_key: string
          legacy_question_bank_id?: string | null
          legacy_rank_group?: string | null
          level?: string | null
          prompt: Json
          question_type: string
          question_version?: number
          rank_scope?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          source_type: string
          source_version?: string | null
          updated_at?: string
          vessel_scope?: string[]
        }
        Update: {
          answer_key?: Json
          approval_basis?: string | null
          approval_status?: string
          cognitive_level?: string | null
          created_at?: string
          department?: string | null
          domain?: string | null
          exposure_count?: number
          id?: string
          is_active?: boolean
          item_key?: string
          legacy_question_bank_id?: string | null
          legacy_rank_group?: string | null
          level?: string | null
          prompt?: Json
          question_type?: string
          question_version?: number
          rank_scope?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_reference?: string | null
          source_type?: string
          source_version?: string | null
          updated_at?: string
          vessel_scope?: string[]
        }
        Relationships: []
      }
      assessment_start_incidents: {
        Row: {
          assessment_id: string
          category: string
          client_build: string | null
          context: Json | null
          correlation_id: string | null
          crew_profile_id: string
          error_code: string
          first_at: string
          fn_path: string | null
          id: string
          last_at: string
          occurrences: number
          resolved_at: string | null
          status: string
        }
        Insert: {
          assessment_id: string
          category: string
          client_build?: string | null
          context?: Json | null
          correlation_id?: string | null
          crew_profile_id: string
          error_code: string
          first_at?: string
          fn_path?: string | null
          id?: string
          last_at?: string
          occurrences?: number
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assessment_id?: string
          category?: string
          client_build?: string | null
          context?: Json | null
          correlation_id?: string | null
          crew_profile_id?: string
          error_code?: string
          first_at?: string
          fn_path?: string | null
          id?: string
          last_at?: string
          occurrences?: number
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_start_incidents_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_state_log: {
        Row: {
          actor: string | null
          assessment_id: string
          created_at: string
          event: string
          from_state: string | null
          id: number
          paper_id: string | null
          reason: string | null
          source: string | null
          to_state: string | null
        }
        Insert: {
          actor?: string | null
          assessment_id: string
          created_at?: string
          event: string
          from_state?: string | null
          id?: number
          paper_id?: string | null
          reason?: string | null
          source?: string | null
          to_state?: string | null
        }
        Update: {
          actor?: string | null
          assessment_id?: string
          created_at?: string
          event?: string
          from_state?: string | null
          id?: number
          paper_id?: string | null
          reason?: string | null
          source?: string | null
          to_state?: string | null
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
      briefing_log: {
        Row: {
          audience: string
          error: string | null
          id: string
          ok: boolean
          post_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          audience: string
          error?: string | null
          id?: string
          ok?: boolean
          post_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          error?: string | null
          id?: string
          ok?: boolean
          post_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_optout: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
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
      candidate_rate_limits: {
        Row: {
          action: string
          candidate_id: string
          hits: number
          last_ip: string | null
          scope_id: string
          window_start: string
        }
        Insert: {
          action: string
          candidate_id: string
          hits?: number
          last_ip?: string | null
          scope_id: string
          window_start?: string
        }
        Update: {
          action?: string
          candidate_id?: string
          hits?: number
          last_ip?: string | null
          scope_id?: string
          window_start?: string
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
      company_compliance: {
        Row: {
          admin_note: string | null
          ai_checked_at: string | null
          ai_result: Json | null
          ai_runs: number
          ai_runs_day: string | null
          business_license_path: string | null
          crewing_license_path: string | null
          document_paths: string[]
          license_number: string | null
          manager_note: string | null
          manager_user_id: string
          requested_at: string | null
          requested_items: string[]
          responsible_person: Json
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          admin_note?: string | null
          ai_checked_at?: string | null
          ai_result?: Json | null
          ai_runs?: number
          ai_runs_day?: string | null
          business_license_path?: string | null
          crewing_license_path?: string | null
          document_paths?: string[]
          license_number?: string | null
          manager_note?: string | null
          manager_user_id: string
          requested_at?: string | null
          requested_items?: string[]
          responsible_person?: Json
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          admin_note?: string | null
          ai_checked_at?: string | null
          ai_result?: Json | null
          ai_runs?: number
          ai_runs_day?: string | null
          business_license_path?: string | null
          crewing_license_path?: string | null
          document_paths?: string[]
          license_number?: string | null
          manager_note?: string | null
          manager_user_id?: string
          requested_at?: string | null
          requested_items?: string[]
          responsible_person?: Json
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
      credit_control_audit: {
        Row: {
          actor: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity: string
          id: string
        }
        Insert: {
          actor?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity?: string
          id?: string
        }
        Update: {
          actor?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity?: string
          id?: string
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
      credit_plans: {
        Row: {
          active: boolean
          audience: string
          credits: number
          id: string
          interval: string
          name: string
          price_usd: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          credits?: number
          id?: string
          interval?: string
          name?: string
          price_usd?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          credits?: number
          id?: string
          interval?: string
          name?: string
          price_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_program_settings: {
        Row: {
          id: boolean
          profile_credits: number
          referral_credits: number
          reminder_hours: number
          reminders_enabled: boolean
          score_credits: number
          updated_at: string
          welcome_credits: number
        }
        Insert: {
          id?: boolean
          profile_credits?: number
          referral_credits?: number
          reminder_hours?: number
          reminders_enabled?: boolean
          score_credits?: number
          updated_at?: string
          welcome_credits?: number
        }
        Update: {
          id?: boolean
          profile_credits?: number
          referral_credits?: number
          reminder_hours?: number
          reminders_enabled?: boolean
          score_credits?: number
          updated_at?: string
          welcome_credits?: number
        }
        Relationships: []
      }
      crew_appraisals: {
        Row: {
          appraiser_name: string
          appraiser_role: string
          contract_id: string
          created_at: string
          emergency: number
          english: number
          finalized_at: string | null
          id: string
          leadership: number
          manager_id: string
          overall: number
          period_from: string | null
          period_to: string | null
          promotion_verdict: string
          rehire_verdict: string
          remarks: string
          safety: number
          status: string
          teamwork: number
          technical: number
          training_needs: string[]
          updated_at: string
        }
        Insert: {
          appraiser_name?: string
          appraiser_role?: string
          contract_id: string
          created_at?: string
          emergency?: number
          english?: number
          finalized_at?: string | null
          id?: string
          leadership?: number
          manager_id: string
          overall?: number
          period_from?: string | null
          period_to?: string | null
          promotion_verdict?: string
          rehire_verdict?: string
          remarks?: string
          safety?: number
          status?: string
          teamwork?: number
          technical?: number
          training_needs?: string[]
          updated_at?: string
        }
        Update: {
          appraiser_name?: string
          appraiser_role?: string
          contract_id?: string
          created_at?: string
          emergency?: number
          english?: number
          finalized_at?: string | null
          id?: string
          leadership?: number
          manager_id?: string
          overall?: number
          period_from?: string | null
          period_to?: string | null
          promotion_verdict?: string
          rehire_verdict?: string
          remarks?: string
          safety?: number
          status?: string
          teamwork?: number
          technical?: number
          training_needs?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_appraisals_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "sea_contracts"
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
      crew_digest_log: {
        Row: {
          crew_id: string
          sent_on: string
          vacancy_key: string
        }
        Insert: {
          crew_id: string
          sent_on?: string
          vacancy_key: string
        }
        Update: {
          crew_id?: string
          sent_on?: string
          vacancy_key?: string
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
          availability_status: string | null
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
          is_test: boolean
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
          public_card_token: string | null
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
          availability_status?: string | null
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
          is_test?: boolean
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
          public_card_token?: string | null
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
          availability_status?: string | null
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
          is_test?: boolean
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
          public_card_token?: string | null
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
      crew_training_assignments: {
        Row: {
          application_id: string | null
          assigned_by: string | null
          attempts: number
          completed_at: string | null
          created_at: string
          crew_id: string
          dwell_seconds: number | null
          id: string
          invite_id: string | null
          last_attempt_at: string | null
          match_score: number
          module_id: string
          module_version: number
          opened_at: string | null
          quiz_correct: number | null
          quiz_total: number | null
          reasons: Json
          source: string
          status: string
          token: string
          trading_area: string | null
        }
        Insert: {
          application_id?: string | null
          assigned_by?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          crew_id: string
          dwell_seconds?: number | null
          id?: string
          invite_id?: string | null
          last_attempt_at?: string | null
          match_score?: number
          module_id: string
          module_version?: number
          opened_at?: string | null
          quiz_correct?: number | null
          quiz_total?: number | null
          reasons?: Json
          source?: string
          status?: string
          token?: string
          trading_area?: string | null
        }
        Update: {
          application_id?: string | null
          assigned_by?: string | null
          attempts?: number
          completed_at?: string | null
          created_at?: string
          crew_id?: string
          dwell_seconds?: number | null
          id?: string
          invite_id?: string | null
          last_attempt_at?: string | null
          match_score?: number
          module_id?: string
          module_version?: number
          opened_at?: string | null
          quiz_correct?: number | null
          quiz_total?: number | null
          reasons?: Json
          source?: string
          status?: string
          token?: string
          trading_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_training_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
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
      crew_workspace_settings: {
        Row: {
          manager_id: string
          operating_model: string
          updated_at: string
        }
        Insert: {
          manager_id?: string
          operating_model: string
          updated_at?: string
        }
        Update: {
          manager_id?: string
          operating_model?: string
          updated_at?: string
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
      dora_articles: {
        Row: {
          body: string
          created_at: string
          domain: string
          id: string
          intents: string[]
          language: string
          search_tsv: unknown
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          domain: string
          id?: string
          intents?: string[]
          language?: string
          search_tsv?: unknown
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          domain?: string
          id?: string
          intents?: string[]
          language?: string
          search_tsv?: unknown
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      dora_interactions: {
        Row: {
          account_tool_used: string | null
          articles_used: string[]
          created_at: string
          est_cost_usd: number | null
          id: string
          intent: string | null
          latency_ms: number | null
          model: string | null
          outcome: string
          route_template: string | null
          screenshot_used: boolean
          user_id: string | null
        }
        Insert: {
          account_tool_used?: string | null
          articles_used?: string[]
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model?: string | null
          outcome: string
          route_template?: string | null
          screenshot_used?: boolean
          user_id?: string | null
        }
        Update: {
          account_tool_used?: string | null
          articles_used?: string[]
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          model?: string | null
          outcome?: string
          route_template?: string | null
          screenshot_used?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      dora_unanswered_clusters: {
        Row: {
          cluster_key: string
          domain: string | null
          first_seen: string
          hit_count: number
          id: string
          last_seen: string
          status: string
          summary: string
        }
        Insert: {
          cluster_key: string
          domain?: string | null
          first_seen?: string
          hit_count?: number
          id?: string
          last_seen?: string
          status?: string
          summary: string
        }
        Update: {
          cluster_key?: string
          domain?: string | null
          first_seen?: string
          hit_count?: number
          id?: string
          last_seen?: string
          status?: string
          summary?: string
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
      english_attempts: {
        Row: {
          created_at: string
          id: string
          is_daily: boolean
          practice_date: string
          scenario_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_daily?: boolean
          practice_date?: string
          scenario_id: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_daily?: boolean
          practice_date?: string
          scenario_id?: string
          score?: number
          user_id?: string
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
          archived_at: string | null
          archived_by: string | null
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
          archived_at?: string | null
          archived_by?: string | null
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
          archived_at?: string | null
          archived_by?: string | null
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
      fleet_cells: {
        Row: {
          created_at: string
          id: string
          name: string
          superintendent: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          superintendent?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          superintendent?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fleet_staff_members: {
        Row: {
          approval_limit_usd: number
          approved_at: string | null
          approved_by: string | null
          approved_role: string | null
          can_approve_permits: boolean
          can_approve_salaries: boolean
          can_approve_staff: boolean
          can_approve_travel: boolean
          cell_ids: string[]
          company: string | null
          contact_email: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          modules: string[]
          provisioned_by_admin: boolean
          requested_role: string
          staff_code: string | null
          status: string
          updated_at: string
          user_id: string
          vessel_ids: string[]
        }
        Insert: {
          approval_limit_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          approved_role?: string | null
          can_approve_permits?: boolean
          can_approve_salaries?: boolean
          can_approve_staff?: boolean
          can_approve_travel?: boolean
          cell_ids?: string[]
          company?: string | null
          contact_email?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          modules?: string[]
          provisioned_by_admin?: boolean
          requested_role: string
          staff_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vessel_ids?: string[]
        }
        Update: {
          approval_limit_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          approved_role?: string | null
          can_approve_permits?: boolean
          can_approve_salaries?: boolean
          can_approve_staff?: boolean
          can_approve_travel?: boolean
          cell_ids?: string[]
          company?: string | null
          contact_email?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          modules?: string[]
          provisioned_by_admin?: boolean
          requested_role?: string
          staff_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vessel_ids?: string[]
        }
        Relationships: []
      }
      fleet_vessels: {
        Row: {
          cell_id: string | null
          created_at: string
          created_by: string | null
          flag: string | null
          id: string
          imo: string | null
          inspection_id: string | null
          name: string
          owner_company: string | null
          status: string
          updated_at: string
          vessel_type: string | null
        }
        Insert: {
          cell_id?: string | null
          created_at?: string
          created_by?: string | null
          flag?: string | null
          id?: string
          imo?: string | null
          inspection_id?: string | null
          name: string
          owner_company?: string | null
          status?: string
          updated_at?: string
          vessel_type?: string | null
        }
        Update: {
          cell_id?: string | null
          created_at?: string
          created_by?: string | null
          flag?: string | null
          id?: string
          imo?: string | null
          inspection_id?: string | null
          name?: string
          owner_company?: string | null
          status?: string
          updated_at?: string
          vessel_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_vessels_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "fleet_cells"
            referencedColumns: ["id"]
          },
        ]
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
          engine_types: string[] | null
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
          engine_types?: string[] | null
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
          engine_types?: string[] | null
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
          cv_request_status: string
          id: string
          invited_email: string | null
          invited_name: string | null
          invited_whatsapp: string | null
          manager_note: string | null
          overall_score: number | null
          round_2_assessment_id: string | null
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
          cv_request_status?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          invited_whatsapp?: string | null
          manager_note?: string | null
          overall_score?: number | null
          round_2_assessment_id?: string | null
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
          cv_request_status?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          invited_whatsapp?: string | null
          manager_note?: string | null
          overall_score?: number | null
          round_2_assessment_id?: string | null
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
          overlay_kind: string
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
          overlay_kind?: string
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
          overlay_kind?: string
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
          engine_experience: string[] | null
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
          engine_experience?: string[] | null
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
          engine_experience?: string[] | null
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
      interview_question_pool: {
        Row: {
          created_at: string
          id: string
          questions: Json
          spec_key: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          questions?: Json
          spec_key: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          questions?: Json
          spec_key?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      issued_paper_keys: {
        Row: {
          answer_key: Json
          item_id: string
          item_version: number
          paper_id: string
          paper_item_id: string
        }
        Insert: {
          answer_key: Json
          item_id: string
          item_version: number
          paper_id: string
          paper_item_id: string
        }
        Update: {
          answer_key?: Json
          item_id?: string
          item_version?: number
          paper_id?: string
          paper_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issued_paper_keys_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issued_paper_keys_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "issued_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      issued_papers: {
        Row: {
          assessment_id: string
          blueprint_id: string
          blueprint_version: number
          context: Json
          crew_profile_id: string
          id: string
          is_test: boolean
          issued_at: string
          items: Json
          paper_version: number
          status: string
        }
        Insert: {
          assessment_id: string
          blueprint_id: string
          blueprint_version: number
          context: Json
          crew_profile_id: string
          id?: string
          is_test?: boolean
          issued_at?: string
          items: Json
          paper_version?: number
          status?: string
        }
        Update: {
          assessment_id?: string
          blueprint_id?: string
          blueprint_version?: number
          context?: Json
          crew_profile_id?: string
          id?: string
          is_test?: boolean
          issued_at?: string
          items?: Json
          paper_version?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "issued_papers_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issued_papers_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "assessment_blueprints"
            referencedColumns: ["id"]
          },
        ]
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
          offer_details: Json | null
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
          offer_details?: Json | null
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
          offer_details?: Json | null
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
        Relationships: [
          {
            foreignKeyName: "job_applications_external_vacancy_link_fk"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "external_vacancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          additional_notes: string | null
          company_name: string
          contact_email: string | null
          contact_whatsapp: string
          contract_duration: string
          created_at: string
          expires_at: string
          flier_url: string | null
          id: string
          joining_date: string | null
          joining_port: string
          manager_id: string | null
          monthly_salary: string | null
          plan: string
          positions: number
          posting_batch_id: string | null
          rank_required: string
          recruiter_name: string | null
          source_type: string
          status: string
          telegram_posted: boolean | null
          updated_at: string
          verified: boolean
          vessel_type: string
        }
        Insert: {
          additional_notes?: string | null
          company_name: string
          contact_email?: string | null
          contact_whatsapp: string
          contract_duration: string
          created_at?: string
          expires_at?: string
          flier_url?: string | null
          id?: string
          joining_date?: string | null
          joining_port: string
          manager_id?: string | null
          monthly_salary?: string | null
          plan?: string
          positions?: number
          posting_batch_id?: string | null
          rank_required: string
          recruiter_name?: string | null
          source_type?: string
          status?: string
          telegram_posted?: boolean | null
          updated_at?: string
          verified?: boolean
          vessel_type: string
        }
        Update: {
          additional_notes?: string | null
          company_name?: string
          contact_email?: string | null
          contact_whatsapp?: string
          contract_duration?: string
          created_at?: string
          expires_at?: string
          flier_url?: string | null
          id?: string
          joining_date?: string | null
          joining_port?: string
          manager_id?: string | null
          monthly_salary?: string | null
          plan?: string
          positions?: number
          posting_batch_id?: string | null
          rank_required?: string
          recruiter_name?: string | null
          source_type?: string
          status?: string
          telegram_posted?: boolean | null
          updated_at?: string
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
      lineup_ticket_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "lineup_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      lineup_tickets: {
        Row: {
          application_id: string
          category: string
          created_at: string
          crew_id: string
          escalated_at: string | null
          id: string
          raised_by: string
          raised_by_role: string
          resolution_note: string | null
          resolved_at: string | null
          statement: string
          status: string
          ticket_ref: string
          updated_at: string
        }
        Insert: {
          application_id: string
          category: string
          created_at?: string
          crew_id: string
          escalated_at?: string | null
          id?: string
          raised_by: string
          raised_by_role: string
          resolution_note?: string | null
          resolved_at?: string | null
          statement: string
          status?: string
          ticket_ref?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          category?: string
          created_at?: string
          crew_id?: string
          escalated_at?: string | null
          id?: string
          raised_by?: string
          raised_by_role?: string
          resolution_note?: string | null
          resolved_at?: string | null
          statement?: string
          status?: string
          ticket_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_tickets_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      management_periods: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          starts_on: string
          status: string
          updated_at: string
          vessel_id: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          starts_on?: string
          status?: string
          updated_at?: string
          vessel_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          starts_on?: string
          status?: string
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_periods_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "fleet_vessels"
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
      manager_engagement_log: {
        Row: {
          kind: string
          manager_user_id: string
          sent_on: string
        }
        Insert: {
          kind: string
          manager_user_id: string
          sent_on?: string
        }
        Update: {
          kind?: string
          manager_user_id?: string
          sent_on?: string
        }
        Relationships: []
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
          marketing_emails: boolean
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
          marketing_emails?: boolean
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
          marketing_emails?: boolean
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
      marketplace_sellers: {
        Row: {
          approved_at: string
          approved_by: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
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
          link: string | null
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
          link?: string | null
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
          link?: string | null
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
      paper_item_responses: {
        Row: {
          answer: string | null
          created_at: string
          is_correct: boolean | null
          paper_id: string
          paper_item_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          is_correct?: boolean | null
          paper_id: string
          paper_item_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          is_correct?: boolean | null
          paper_id?: string
          paper_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_item_responses_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "issued_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_supersessions: {
        Row: {
          answered_count: number
          assessment_id: string
          authorized_by: string
          created_at: string
          disposition: string
          id: string
          new_paper_id: string | null
          old_paper_id: string
          reason: string
          recovery_policy: string
        }
        Insert: {
          answered_count?: number
          assessment_id: string
          authorized_by: string
          created_at?: string
          disposition: string
          id?: string
          new_paper_id?: string | null
          old_paper_id: string
          reason: string
          recovery_policy: string
        }
        Update: {
          answered_count?: number
          assessment_id?: string
          authorized_by?: string
          created_at?: string
          disposition?: string
          id?: string
          new_paper_id?: string | null
          old_paper_id?: string
          reason?: string
          recovery_policy?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_supersessions_new_paper_id_fkey"
            columns: ["new_paper_id"]
            isOneToOne: false
            referencedRelation: "issued_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_supersessions_old_paper_id_fkey"
            columns: ["old_paper_id"]
            isOneToOne: true
            referencedRelation: "issued_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      portage_entries: {
        Row: {
          allotment: number
          bond_store: number
          bonus: number
          cash_advance: number
          communication: number
          contract_id: string
          created_at: string
          currency: string
          days_in_month: number
          days_served: number
          deductions: number
          extra_ot_hours: number
          finalized_at: string | null
          gross: number
          id: string
          manager_id: string
          net_payable: number
          notes: string
          other_deduction: number
          paid_at: string | null
          prev_balance: number
          sign_off_date: string | null
          status: string
          updated_at: string
          year_month: string
        }
        Insert: {
          allotment?: number
          bond_store?: number
          bonus?: number
          cash_advance?: number
          communication?: number
          contract_id: string
          created_at?: string
          currency?: string
          days_in_month?: number
          days_served?: number
          deductions?: number
          extra_ot_hours?: number
          finalized_at?: string | null
          gross?: number
          id?: string
          manager_id: string
          net_payable?: number
          notes?: string
          other_deduction?: number
          paid_at?: string | null
          prev_balance?: number
          sign_off_date?: string | null
          status?: string
          updated_at?: string
          year_month: string
        }
        Update: {
          allotment?: number
          bond_store?: number
          bonus?: number
          cash_advance?: number
          communication?: number
          contract_id?: string
          created_at?: string
          currency?: string
          days_in_month?: number
          days_served?: number
          deductions?: number
          extra_ot_hours?: number
          finalized_at?: string | null
          gross?: number
          id?: string
          manager_id?: string
          net_payable?: number
          notes?: string
          other_deduction?: number
          paid_at?: string | null
          prev_balance?: number
          sign_off_date?: string | null
          status?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "portage_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "sea_contracts"
            referencedColumns: ["id"]
          },
        ]
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
      post_interests: {
        Row: {
          company_post_id: string
          created_at: string
          crew_id: string
          id: string
        }
        Insert: {
          company_post_id: string
          created_at?: string
          crew_id: string
          id?: string
        }
        Update: {
          company_post_id?: string
          created_at?: string
          crew_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_interests_company_post_id_fkey"
            columns: ["company_post_id"]
            isOneToOne: false
            referencedRelation: "company_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_cv_templates: {
        Row: {
          company_name: string
          created_at: string
          file_path: string
          file_type: string
          id: string
          manager_user_id: string
          mappings: Json
          photo_path: string | null
          template_name: string
        }
        Insert: {
          company_name: string
          created_at?: string
          file_path: string
          file_type: string
          id?: string
          manager_user_id?: string
          mappings?: Json
          photo_path?: string | null
          template_name: string
        }
        Update: {
          company_name?: string
          created_at?: string
          file_path?: string
          file_type?: string
          id?: string
          manager_user_id?: string
          mappings?: Json
          photo_path?: string | null
          template_name?: string
        }
        Relationships: []
      }
      profile_view_links: {
        Row: {
          application_id: string
          created_at: string
          crew_id: string
          expires_at: string
          last_viewed_at: string | null
          recipient_email: string | null
          token: string
          view_count: number
        }
        Insert: {
          application_id: string
          created_at?: string
          crew_id: string
          expires_at?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          token?: string
          view_count?: number
        }
        Update: {
          application_id?: string
          created_at?: string
          crew_id?: string
          expires_at?: string
          last_viewed_at?: string | null
          recipient_email?: string | null
          token?: string
          view_count?: number
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
          canonical_rank: string | null
          department: string
          department_label: string | null
          level: string | null
          rank_group: string
          rank_pattern: string
        }
        Insert: {
          canonical_rank?: string | null
          department: string
          department_label?: string | null
          level?: string | null
          rank_group: string
          rank_pattern: string
        }
        Update: {
          canonical_rank?: string | null
          department?: string
          department_label?: string | null
          level?: string | null
          rank_group?: string
          rank_pattern?: string
        }
        Relationships: []
      }
      recovery_cases: {
        Row: {
          assessment_id: string
          created_at: string
          crew_profile_id: string
          id: string
          interruption_state: string
          is_test: boolean
          last_health: Json | null
          mode: string
          next_action_at: string | null
          phase: string
          reminders_sent: number
          status: string
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          crew_profile_id: string
          id?: string
          interruption_state: string
          is_test?: boolean
          last_health?: Json | null
          mode?: string
          next_action_at?: string | null
          phase?: string
          reminders_sent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          crew_profile_id?: string
          id?: string
          interruption_state?: string
          is_test?: boolean
          last_health?: Json | null
          mode?: string
          next_action_at?: string | null
          phase?: string
          reminders_sent?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_cases_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_events: {
        Row: {
          case_id: string
          created_at: string
          detail: Json | null
          event: string
          id: number
        }
        Insert: {
          case_id: string
          created_at?: string
          detail?: Json | null
          event: string
          id?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          detail?: Json | null
          event?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "recovery_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_outbox: {
        Row: {
          accepted_at: string | null
          attempts: number
          case_id: string
          created_at: string
          delivery_status: string
          id: string
          last_error: string | null
          lease_until: string | null
          link_token: string | null
          max_attempts: number
          message_key: string
          next_attempt_at: string
          payload: Json
          phase: string
          provider_message_id: string | null
          reminder_no: number
          status: string
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          attempts?: number
          case_id: string
          created_at?: string
          delivery_status?: string
          id?: string
          last_error?: string | null
          lease_until?: string | null
          link_token?: string | null
          max_attempts?: number
          message_key: string
          next_attempt_at?: string
          payload?: Json
          phase?: string
          provider_message_id?: string | null
          reminder_no: number
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          attempts?: number
          case_id?: string
          created_at?: string
          delivery_status?: string
          id?: string
          last_error?: string | null
          lease_until?: string | null
          link_token?: string | null
          max_attempts?: number
          message_key?: string
          next_attempt_at?: string
          payload?: Json
          phase?: string
          provider_message_id?: string | null
          reminder_no?: number
          status?: string
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_outbox_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "recovery_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_tokens: {
        Row: {
          assessment_id: string
          case_id: string
          created_at: string
          crew_profile_id: string
          expires_at: string
          purpose: string
          revoked_at: string | null
          token_hash: string
          used_at: string | null
        }
        Insert: {
          assessment_id: string
          case_id: string
          created_at?: string
          crew_profile_id: string
          expires_at: string
          purpose?: string
          revoked_at?: string | null
          token_hash: string
          used_at?: string | null
        }
        Update: {
          assessment_id?: string
          case_id?: string
          created_at?: string
          crew_profile_id?: string
          expires_at?: string
          purpose?: string
          revoked_at?: string | null
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recovery_tokens_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "recovery_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_outreach_contacts: {
        Row: {
          active_vacancies: number
          applications_total: number
          created_at: string
          email: string
          id: string
          last_contacted_at: string | null
          last_kind: string | null
          next_due_at: string
          notes: string | null
          recruiter_name: string | null
          stage: string
          top_ranks: string[]
          touches_sent: number
          updated_at: string
        }
        Insert: {
          active_vacancies?: number
          applications_total?: number
          created_at?: string
          email: string
          id?: string
          last_contacted_at?: string | null
          last_kind?: string | null
          next_due_at?: string
          notes?: string | null
          recruiter_name?: string | null
          stage?: string
          top_ranks?: string[]
          touches_sent?: number
          updated_at?: string
        }
        Update: {
          active_vacancies?: number
          applications_total?: number
          created_at?: string
          email?: string
          id?: string
          last_contacted_at?: string | null
          last_kind?: string | null
          next_due_at?: string
          notes?: string | null
          recruiter_name?: string | null
          stage?: string
          top_ranks?: string[]
          touches_sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      recruiter_outreach_log: {
        Row: {
          contact_id: string
          error: string | null
          id: string
          kind: string
          ok: boolean
          provider_id: string | null
          sent_at: string
          subject: string | null
        }
        Insert: {
          contact_id: string
          error?: string | null
          id?: string
          kind: string
          ok?: boolean
          provider_id?: string | null
          sent_at?: string
          subject?: string | null
        }
        Update: {
          contact_id?: string
          error?: string | null
          id?: string
          kind?: string
          ok?: boolean
          provider_id?: string | null
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_outreach_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "recruiter_outreach_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          active: boolean
          channel: string | null
          code: string
          created_at: string
          notes: string | null
          owner_contact: string | null
          owner_name: string
        }
        Insert: {
          active?: boolean
          channel?: string | null
          code: string
          created_at?: string
          notes?: string | null
          owner_contact?: string | null
          owner_name: string
        }
        Update: {
          active?: boolean
          channel?: string | null
          code?: string
          created_at?: string
          notes?: string | null
          owner_contact?: string | null
          owner_name?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          crew_id: string
          id: string
        }
        Insert: {
          code: string
          created_at?: string
          crew_id: string
          id?: string
        }
        Update: {
          code?: string
          created_at?: string
          crew_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
        ]
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
          ai_result: Json | null
          ai_result_paper: string | null
          assessment_id: string
          attempts: number
          completed_at: string | null
          created_at: string
          final_failures: number
          id: string
          last_error: string | null
          lease_until: string | null
          next_attempt_at: string
          payload: Json
          retry_at: string | null
          status: string
        }
        Insert: {
          ai_result?: Json | null
          ai_result_paper?: string | null
          assessment_id: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          final_failures?: number
          id?: string
          last_error?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          payload: Json
          retry_at?: string | null
          status?: string
        }
        Update: {
          ai_result?: Json | null
          ai_result_paper?: string | null
          assessment_id?: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          final_failures?: number
          id?: string
          last_error?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          payload?: Json
          retry_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sea_contracts: {
        Row: {
          allowances: Json
          application_id: string
          basic_wage: number
          cba_reference: string
          created_at: string
          crew_id: string | null
          currency: string
          duration_months: number
          employer_address: string
          employer_name: string
          extra_ot_rate: number
          fixed_overtime: number
          flag_state: string
          id: string
          imo_number: string
          issued_at: string | null
          leave_days_per_month: number
          leave_pay: number
          manager_id: string
          notes: string
          notice_days: number
          overtime_hours: number
          port_of_engagement: string
          rank: string
          reliever_application_id: string | null
          repatriation_port: string
          signed_at: string | null
          start_date: string | null
          status: string
          tolerance_months: number
          updated_at: string
          vessel_name: string
          vessel_type: string
        }
        Insert: {
          allowances?: Json
          application_id: string
          basic_wage?: number
          cba_reference?: string
          created_at?: string
          crew_id?: string | null
          currency?: string
          duration_months?: number
          employer_address?: string
          employer_name?: string
          extra_ot_rate?: number
          fixed_overtime?: number
          flag_state?: string
          id?: string
          imo_number?: string
          issued_at?: string | null
          leave_days_per_month?: number
          leave_pay?: number
          manager_id?: string
          notes?: string
          notice_days?: number
          overtime_hours?: number
          port_of_engagement?: string
          rank?: string
          reliever_application_id?: string | null
          repatriation_port?: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          tolerance_months?: number
          updated_at?: string
          vessel_name?: string
          vessel_type?: string
        }
        Update: {
          allowances?: Json
          application_id?: string
          basic_wage?: number
          cba_reference?: string
          created_at?: string
          crew_id?: string | null
          currency?: string
          duration_months?: number
          employer_address?: string
          employer_name?: string
          extra_ot_rate?: number
          fixed_overtime?: number
          flag_state?: string
          id?: string
          imo_number?: string
          issued_at?: string | null
          leave_days_per_month?: number
          leave_pay?: number
          manager_id?: string
          notes?: string
          notice_days?: number
          overtime_hours?: number
          port_of_engagement?: string
          rank?: string
          reliever_application_id?: string | null
          repatriation_port?: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          tolerance_months?: number
          updated_at?: string
          vessel_name?: string
          vessel_type?: string
        }
        Relationships: []
      }
      ship_listing_reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          reason: string
          reporter_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ship_listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ship_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ship_listings: {
        Row: {
          authority_basis: string
          authority_confirmed_at: string
          beam_m: number | null
          builder: string | null
          bwts: string | null
          cargo_capacity: string | null
          cargo_gear: string | null
          class_society: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          created_at: string
          delivery_window: string | null
          description: string | null
          dwt: number | null
          eexi_cii: string | null
          featured: boolean
          flag: string | null
          gt: number | null
          id: string
          imo: string | null
          loa_m: number | null
          location: string | null
          main_engine: string | null
          photos: string[]
          price_text: string
          scrubber: string | null
          seller_company: string | null
          seller_id: string
          show_identity: boolean
          status: string
          updated_at: string
          vessel_name: string | null
          vessel_type: string
          year_built: number | null
        }
        Insert: {
          authority_basis: string
          authority_confirmed_at?: string
          beam_m?: number | null
          builder?: string | null
          bwts?: string | null
          cargo_capacity?: string | null
          cargo_gear?: string | null
          class_society?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          delivery_window?: string | null
          description?: string | null
          dwt?: number | null
          eexi_cii?: string | null
          featured?: boolean
          flag?: string | null
          gt?: number | null
          id?: string
          imo?: string | null
          loa_m?: number | null
          location?: string | null
          main_engine?: string | null
          photos?: string[]
          price_text?: string
          scrubber?: string | null
          seller_company?: string | null
          seller_id?: string
          show_identity?: boolean
          status?: string
          updated_at?: string
          vessel_name?: string | null
          vessel_type: string
          year_built?: number | null
        }
        Update: {
          authority_basis?: string
          authority_confirmed_at?: string
          beam_m?: number | null
          builder?: string | null
          bwts?: string | null
          cargo_capacity?: string | null
          cargo_gear?: string | null
          class_society?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          delivery_window?: string | null
          description?: string | null
          dwt?: number | null
          eexi_cii?: string | null
          featured?: boolean
          flag?: string | null
          gt?: number | null
          id?: string
          imo?: string | null
          loa_m?: number | null
          location?: string | null
          main_engine?: string | null
          photos?: string[]
          price_text?: string
          scrubber?: string | null
          seller_company?: string | null
          seller_id?: string
          show_identity?: boolean
          status?: string
          updated_at?: string
          vessel_name?: string | null
          vessel_type?: string
          year_built?: number | null
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
          assessment_mode: string
          assessment_round: number
          behavioural_score: number | null
          campaign_id: string | null
          certificate_id: string | null
          completed_at: string | null
          context_id: string
          crew_profile_id: string
          current_step: number
          cv_version_hash: string | null
          dimension_scores: Json | null
          doc_upload_status: string
          english_score: number | null
          evidence_snapshot: Json | null
          experience_score: number | null
          id: string
          interview_mode: string | null
          invite_id: string | null
          judgment_score: number | null
          level_profile: Json | null
          overall_score: number | null
          parent_assessment_id: string | null
          preflight_confirmed_at: string | null
          preflight_context: Json | null
          preflight_source: string | null
          probed_claims: Json | null
          recommendation: string | null
          red_flags: Json | null
          report: Json | null
          score_band: string | null
          scoring_tier: string
          scoring_version: string | null
          started_at: string
          status: string
          technical_score: number | null
          wellness_score: number | null
        }
        Insert: {
          assessment_mode?: string
          assessment_round?: number
          behavioural_score?: number | null
          campaign_id?: string | null
          certificate_id?: string | null
          completed_at?: string | null
          context_id?: string
          crew_profile_id: string
          current_step?: number
          cv_version_hash?: string | null
          dimension_scores?: Json | null
          doc_upload_status?: string
          english_score?: number | null
          evidence_snapshot?: Json | null
          experience_score?: number | null
          id?: string
          interview_mode?: string | null
          invite_id?: string | null
          judgment_score?: number | null
          level_profile?: Json | null
          overall_score?: number | null
          parent_assessment_id?: string | null
          preflight_confirmed_at?: string | null
          preflight_context?: Json | null
          preflight_source?: string | null
          probed_claims?: Json | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
          score_band?: string | null
          scoring_tier?: string
          scoring_version?: string | null
          started_at?: string
          status?: string
          technical_score?: number | null
          wellness_score?: number | null
        }
        Update: {
          assessment_mode?: string
          assessment_round?: number
          behavioural_score?: number | null
          campaign_id?: string | null
          certificate_id?: string | null
          completed_at?: string | null
          context_id?: string
          crew_profile_id?: string
          current_step?: number
          cv_version_hash?: string | null
          dimension_scores?: Json | null
          doc_upload_status?: string
          english_score?: number | null
          evidence_snapshot?: Json | null
          experience_score?: number | null
          id?: string
          interview_mode?: string | null
          invite_id?: string | null
          judgment_score?: number | null
          level_profile?: Json | null
          overall_score?: number | null
          parent_assessment_id?: string | null
          preflight_confirmed_at?: string | null
          preflight_context?: Json | null
          preflight_source?: string | null
          probed_claims?: Json | null
          recommendation?: string | null
          red_flags?: Json | null
          report?: Json | null
          score_band?: string | null
          scoring_tier?: string
          scoring_version?: string | null
          started_at?: string
          status?: string
          technical_score?: number | null
          wellness_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "smc_assessments_parent_assessment_id_fkey"
            columns: ["parent_assessment_id"]
            isOneToOne: false
            referencedRelation: "smc_assessments"
            referencedColumns: ["id"]
          },
        ]
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
      support_incidents: {
        Row: {
          category: string
          component: string
          error_signature: string
          fingerprint: string
          first_seen_at: string
          id: string
          incident_ref: string
          last_escalated_at: string | null
          last_seen_at: string
          operation: string
          resolved_by_version: string | null
          severity: string
          status: string
          total_reports: number
        }
        Insert: {
          category: string
          component: string
          error_signature: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          incident_ref: string
          last_escalated_at?: string | null
          last_seen_at?: string
          operation: string
          resolved_by_version?: string | null
          severity?: string
          status?: string
          total_reports?: number
        }
        Update: {
          category?: string
          component?: string
          error_signature?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          incident_ref?: string
          last_escalated_at?: string | null
          last_seen_at?: string
          operation?: string
          resolved_by_version?: string | null
          severity?: string
          status?: string
          total_reports?: number
        }
        Relationships: []
      }
      support_rate_limits: {
        Row: {
          action: string
          hits: number
          rate_key: string
          window_start: string
        }
        Insert: {
          action: string
          hits?: number
          rate_key: string
          window_start?: string
        }
        Update: {
          action?: string
          hits?: number
          rate_key?: string
          window_start?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assessment_id: string | null
          assessment_start_incident_id: string | null
          category: string
          client_build: string | null
          component: string | null
          contact_email: string | null
          contact_whatsapp: string | null
          created_at: string
          description: string
          error_signature: string | null
          id: string
          incident_id: string | null
          operation: string | null
          reporter_key: string
          route_pathname: string | null
          status: string
          subject: string
          submission_id: string
          ticket_ref: string
          user_id: string | null
        }
        Insert: {
          assessment_id?: string | null
          assessment_start_incident_id?: string | null
          category: string
          client_build?: string | null
          component?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description: string
          error_signature?: string | null
          id?: string
          incident_id?: string | null
          operation?: string | null
          reporter_key: string
          route_pathname?: string | null
          status?: string
          subject: string
          submission_id: string
          ticket_ref: string
          user_id?: string | null
        }
        Update: {
          assessment_id?: string | null
          assessment_start_incident_id?: string | null
          category?: string
          client_build?: string | null
          component?: string | null
          contact_email?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          description?: string
          error_signature?: string | null
          id?: string
          incident_id?: string | null
          operation?: string | null
          reporter_key?: string
          route_pathname?: string | null
          status?: string
          subject?: string
          submission_id?: string
          ticket_ref?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assessment_start_incident_id_fkey"
            columns: ["assessment_start_incident_id"]
            isOneToOne: false
            referencedRelation: "assessment_start_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "support_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_answers: {
        Row: {
          author_id: string
          created_at: string
          data: Json
          group_key: string
          id: string
          inspection_id: string
          item_ref: string
          template_version: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          author_id?: string
          created_at?: string
          data?: Json
          group_key: string
          id?: string
          inspection_id: string
          item_ref: string
          template_version?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          author_id?: string
          created_at?: string
          data?: Json
          group_key?: string
          id?: string
          inspection_id?: string
          item_ref?: string
          template_version?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "takeover_answers_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "takeover_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_attachments: {
        Row: {
          caption: string | null
          created_at: string
          group_key: string | null
          id: string
          inspection_id: string
          item_ref: string | null
          mime_type: string | null
          photo_no: number | null
          size_bytes: number | null
          source_type: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          group_key?: string | null
          id?: string
          inspection_id: string
          item_ref?: string | null
          mime_type?: string | null
          photo_no?: number | null
          size_bytes?: number | null
          source_type?: string
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          group_key?: string | null
          id?: string
          inspection_id?: string
          item_ref?: string | null
          mime_type?: string | null
          photo_no?: number | null
          size_bytes?: number | null
          source_type?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeover_attachments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "takeover_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: string
          inspection_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: string
          inspection_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          inspection_id?: string
        }
        Relationships: []
      }
      takeover_inspections: {
        Row: {
          class_society: string | null
          created_at: string
          flag: string | null
          id: string
          imo: string | null
          inspector_name: string | null
          is_partial: boolean
          limitation_note: string | null
          owner_id: string
          port_of_registry: string | null
          record_version: number
          started_on: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_snapshot: Json | null
          template_id: string
          template_version: number
          updated_at: string
          vessel_name: string
        }
        Insert: {
          class_society?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          imo?: string | null
          inspector_name?: string | null
          is_partial?: boolean
          limitation_note?: string | null
          owner_id?: string
          port_of_registry?: string | null
          record_version?: number
          started_on?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_snapshot?: Json | null
          template_id?: string
          template_version?: number
          updated_at?: string
          vessel_name: string
        }
        Update: {
          class_society?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          imo?: string | null
          inspector_name?: string | null
          is_partial?: boolean
          limitation_note?: string | null
          owner_id?: string
          port_of_registry?: string | null
          record_version?: number
          started_on?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_snapshot?: Json | null
          template_id?: string
          template_version?: number
          updated_at?: string
          vessel_name?: string
        }
        Relationships: []
      }
      takeover_members: {
        Row: {
          added_by: string
          created_at: string
          id: string
          inspection_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_by?: string
          created_at?: string
          id?: string
          inspection_id: string
          role: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          inspection_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeover_members_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "takeover_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      takeover_template_requirements: {
        Row: {
          group_key: string
          item_ref: string
          photo_required: boolean
          template_id: string
          template_version: number
        }
        Insert: {
          group_key: string
          item_ref: string
          photo_required?: boolean
          template_id: string
          template_version: number
        }
        Update: {
          group_key?: string
          item_ref?: string
          photo_required?: boolean
          template_id?: string
          template_version?: number
        }
        Relationships: []
      }
      training_modules: {
        Row: {
          concepts: string[]
          created_at: string
          departments: string[]
          domains: string[]
          id: string
          is_published: boolean
          key_points: Json
          levels: string[]
          media_label: string | null
          media_url: string | null
          min_dwell_seconds: number
          pass_mark: number
          priority: number
          quiz: Json
          slug: string
          summary: string
          tier: string
          title: string
          trading_areas: string[]
          updated_at: string
          version: number
          vessel_families: string[]
        }
        Insert: {
          concepts?: string[]
          created_at?: string
          departments?: string[]
          domains?: string[]
          id?: string
          is_published?: boolean
          key_points?: Json
          levels?: string[]
          media_label?: string | null
          media_url?: string | null
          min_dwell_seconds?: number
          pass_mark?: number
          priority?: number
          quiz?: Json
          slug: string
          summary: string
          tier?: string
          title: string
          trading_areas?: string[]
          updated_at?: string
          version?: number
          vessel_families?: string[]
        }
        Update: {
          concepts?: string[]
          created_at?: string
          departments?: string[]
          domains?: string[]
          id?: string
          is_published?: boolean
          key_points?: Json
          levels?: string[]
          media_label?: string | null
          media_url?: string | null
          min_dwell_seconds?: number
          pass_mark?: number
          priority?: number
          quiz?: Json
          slug?: string
          summary?: string
          tier?: string
          title?: string
          trading_areas?: string[]
          updated_at?: string
          version?: number
          vessel_families?: string[]
        }
        Relationships: []
      }
      user_legal_consents: {
        Row: {
          acknowledged_at: string
          consent_version: string
          id: string
          role: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          consent_version: string
          id?: string
          role: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          acknowledged_at?: string
          consent_version?: string
          id?: string
          role?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vacancy_cleanup_audit: {
        Row: {
          action: string
          actor_id: string
          actor_scope: string
          affected_count: number
          affected_ids: string[]
          blocked_applications: number
          blocked_ids: string[]
          created_at: string
          filters: Json | null
          id: string
          requested_ids: string[]
          vacancy_kind: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_scope: string
          affected_count?: number
          affected_ids?: string[]
          blocked_applications?: number
          blocked_ids?: string[]
          created_at?: string
          filters?: Json | null
          id?: string
          requested_ids: string[]
          vacancy_kind: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_scope?: string
          affected_count?: number
          affected_ids?: string[]
          blocked_applications?: number
          blocked_ids?: string[]
          created_at?: string
          filters?: Json | null
          id?: string
          requested_ids?: string[]
          vacancy_kind?: string
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
      vessel_manning: {
        Row: {
          manager_id: string
          required_complement: number
          updated_at: string
          vessel_name: string
        }
        Insert: {
          manager_id?: string
          required_complement: number
          updated_at?: string
          vessel_name: string
        }
        Update: {
          manager_id?: string
          required_complement?: number
          updated_at?: string
          vessel_name?: string
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
      whatsapp_crew_leads: {
        Row: {
          audience: string
          batch_tag: string | null
          created_at: string
          id: string
          last_error: string | null
          message_sid: string | null
          name: string | null
          phone_e164: string
          phone_raw: string | null
          rank_detected: string | null
          sent_at: string | null
          source: string
          status: string
        }
        Insert: {
          audience?: string
          batch_tag?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_sid?: string | null
          name?: string | null
          phone_e164: string
          phone_raw?: string | null
          rank_detected?: string | null
          sent_at?: string | null
          source?: string
          status?: string
        }
        Update: {
          audience?: string
          batch_tag?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_sid?: string | null
          name?: string | null
          phone_e164?: string
          phone_raw?: string | null
          rank_detected?: string | null
          sent_at?: string | null
          source?: string
          status?: string
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
      _crew_desk_app_owned: { Args: { _app: string }; Returns: boolean }
      _gen_public_ref: { Args: { p_prefix: string }; Returns: string }
      _start_incident_upsert: {
        Args: {
          p_assessment: string
          p_build: string
          p_category: string
          p_code: string
          p_corr: string
          p_path: string
          p_uid: string
        }
        Returns: string
      }
      add_interview_invites: {
        Args: { p_campaign_id: string; p_people: Json }
        Returns: Json
      }
      admin_credit_report: {
        Args: { p_offset?: number; p_search?: string }
        Returns: Json
      }
      admin_get_incident_diagnostic_bundle: {
        Args: { p_incident_id: string }
        Returns: Json
      }
      admin_growth_pulse: { Args: never; Returns: Json }
      admin_manage_marketing_member: {
        Args: { p_activate: boolean; p_email: string }
        Returns: string
      }
      admin_manager_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      admin_mark_compliance_verified: {
        Args: { p_manager: string }
        Returns: Json
      }
      admin_ops_action: {
        Args: { p_action: string; p_assessment_id: string; p_reason?: string }
        Returns: Json
      }
      admin_ops_list: {
        Args: {
          p_limit?: number
          p_mode?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_ops_readiness: { Args: never; Returns: Json }
      admin_ops_test_simulate: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      admin_ops_timeline: { Args: { p_assessment_id: string }; Returns: Json }
      admin_reissue_paper: {
        Args: { p_assessment_id: string; p_policy?: string; p_reason: string }
        Returns: Json
      }
      admin_request_company_docs: {
        Args: { p_items: string[]; p_manager: string; p_note: string }
        Returns: Json
      }
      admin_support_set_status: {
        Args: {
          p_entity: string
          p_id: string
          p_resolved_by_version?: string
          p_status: string
        }
        Returns: Json
      }
      admin_upsert_referral_code: {
        Args: {
          p_channel: string
          p_code: string
          p_contact: string
          p_owner: string
        }
        Returns: Json
      }
      ai_spend_sentinel: { Args: never; Returns: string }
      answer_scoring_complete: {
        Args: {
          p_attempt: number
          p_job: string
          p_ledger: string
          p_model: string
          p_result: Json
          p_score: number
        }
        Returns: Json
      }
      answer_scoring_fail: {
        Args: {
          p_attempt: number
          p_error: string
          p_job: string
          p_ledger: string
          p_model: string
        }
        Returns: Json
      }
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
      blueprint_coverage: {
        Args: { p_ctx: Json; p_include_test: boolean }
        Returns: Json
      }
      blueprint_coverage_for: {
        Args: { p_bp: string; p_rank: string }
        Returns: Json
      }
      build_daily_notifications: { Args: never; Returns: string }
      build_evidence_snapshot: {
        Args: {
          p_mode: string
          p_target_rank: string
          p_target_vessel?: string
          p_uid: string
        }
        Returns: Json
      }
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
          cv_request_status: string
          english: number
          invite_id: string
          judgment: number
          name: string
          nationality: string
          overall: number
          red_flag_count: number
          round: number
          scoring_tier: string
          shortlisted: boolean
          status: string
          technical: number
          token: string
          whatsapp: string
        }[]
      }
      campaign_training_summary: {
        Args: { p_campaign_id: string }
        Returns: {
          assigned: number
          completed: number
          invite_id: string
        }[]
      }
      candidate_rate_ok: {
        Args: {
          p_action: string
          p_candidate: string
          p_ip?: string
          p_max: number
          p_scope: string
          p_window: string
        }
        Returns: boolean
      }
      claim_answer_scoring_jobs: {
        Args: { p_assessment_id?: string; p_limit?: number }
        Returns: {
          assessment_id: string
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          ledger_id: string
          max_attempts: number
          next_attempt_at: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "answer_scoring_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_interview: {
        Args: { p_assessment_id?: string; p_token: string }
        Returns: Json
      }
      claim_referral: { Args: { p_code: string }; Returns: Json }
      claim_welcome_credits: { Args: never; Returns: Json }
      complete_interview: {
        Args: { p_assessment_id: string; p_invite_id: string }
        Returns: Json
      }
      confirm_preflight: { Args: { p_assessment_id: string }; Returns: Json }
      confirm_resume: {
        Args: { p_assessment_id: string; p_paper_id: string }
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
      credit_cv_ready: { Args: { p_uid: string }; Returns: boolean }
      credit_profile_ready: { Args: { p_uid: string }; Returns: boolean }
      crew_desk_certificate_radar: { Args: never; Returns: Json }
      crew_desk_master_record: {
        Args: { _application_id: string }
        Returns: Json
      }
      crew_desk_roster: { Args: never; Returns: Json }
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
      digest_rank_stats: {
        Args: never
        Returns: {
          fresh: boolean
          n: number
          origin: string
          rank_raw: string
          vessel_bucket: string
        }[]
      }
      dora_get_my_context: { Args: never; Returns: Json }
      dora_log_unanswered: {
        Args: { p_key: string; p_summary: string }
        Returns: undefined
      }
      dora_search_articles: {
        Args: { p_domain?: string; p_limit?: number; p_query: string }
        Returns: {
          body: string
          domain: string
          rank: number
          slug: string
          title: string
        }[]
      }
      dora_search_articles_lang: {
        Args: { p_language?: string; p_limit?: number; p_query: string }
        Returns: {
          body: string
          domain: string
          language: string
          rank: number
          slug: string
          title: string
        }[]
      }
      enforce_retention: { Args: never; Returns: string }
      engage_company_post: {
        Args: { p_action: string; p_post_id: string }
        Returns: Json
      }
      english_summary_for: { Args: { p_uid: string }; Returns: Json }
      enqueue_scoring: { Args: { p_assessment_id: string }; Returns: Json }
      expire_old_vacancies: { Args: never; Returns: string }
      final_scoring_lease: {
        Args: {
          p_assessment_id: string
          p_is_worker: boolean
          p_paper_id: string
        }
        Returns: Json
      }
      final_scoring_release: {
        Args: { p_assessment_id: string; p_error: string }
        Returns: undefined
      }
      final_scoring_save_ai: {
        Args: { p_assessment_id: string; p_dims: Json; p_paper_id: string }
        Returns: boolean
      }
      finalize_assessment_commit: {
        Args: {
          p_assessment_id: string
          p_caller: string
          p_certificate_id: string
          p_level_profile: Json
          p_paper_id: string
          p_red_flags: Json
          p_scores: Json
        }
        Returns: Json
      }
      finalize_assessment_prepare: {
        Args: { p_assessment_id: string; p_caller: string }
        Returns: Json
      }
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
      get_crew_card: { Args: { p_token: string }; Returns: Json }
      get_crew_card_by_link: { Args: { p_token: string }; Returns: Json }
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
      get_missing_answers: { Args: { p_assessment_id: string }; Returns: Json }
      get_my_applicants: { Args: never; Returns: Json }
      get_my_applications: { Args: never; Returns: Json }
      get_my_credit_balance: { Args: never; Returns: Json }
      get_my_english_summary: { Args: never; Returns: Json }
      get_my_fleet: { Args: never; Returns: Json }
      get_my_offers: { Args: never; Returns: Json }
      get_my_recovery: { Args: never; Returns: Json }
      get_my_referral_stats: { Args: never; Returns: Json }
      get_my_safety_reports: { Args: never; Returns: Json }
      get_my_sos_contacts: { Args: never; Returns: Json }
      get_my_wallet: { Args: never; Returns: Json }
      get_public_ticker_stats: { Args: never; Returns: Json }
      get_referral_stats: { Args: never; Returns: Json }
      get_resume_state: { Args: { p_assessment_id: string }; Returns: Json }
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
      is_approved_manager: { Args: { _uid: string }; Returns: boolean }
      is_marketing_member: { Args: never; Returns: boolean }
      is_marketplace_seller: { Args: { _uid: string }; Returns: boolean }
      issue_paper: { Args: { p_assessment_id: string }; Returns: Json }
      lineup_party_role: { Args: { p_application_id: string }; Returns: string }
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
          p_offer?: Json
        }
        Returns: Json
      }
      manager_update_safety_status: {
        Args: { p_id: string; p_status: string }
        Returns: Json
      }
      marketing_pack_daily: { Args: never; Returns: string }
      open_assessment_v2: {
        Args: { p_invite_id?: string; p_mode: string; p_restart?: boolean }
        Returns: Json
      }
      outreach_digest_scan: { Args: never; Returns: string }
      owns_crew_profile: {
        Args: { _crew_profile_id: string }
        Returns: boolean
      }
      placement_release_scan: { Args: never; Returns: string }
      preflight_assessment: {
        Args: { p_assessment_id: string; p_rank?: string }
        Returns: Json
      }
      process_answer_scoring_queue: { Args: never; Returns: string }
      process_recovery_queue: { Args: never; Returns: string }
      process_scoring_jobs: { Args: never; Returns: string }
      raise_lineup_ticket: {
        Args: {
          p_application_id: string
          p_category: string
          p_statement: string
        }
        Returns: Json
      }
      rank_group_of: { Args: { p_rank: string }; Returns: string }
      record_english_attempt: {
        Args: { p_daily: boolean; p_scenario: string; p_score: number }
        Returns: Json
      }
      record_interruption: {
        Args: { p_assessment_id: string; p_kind: string; p_reason?: string }
        Returns: Json
      }
      record_referral: { Args: { p_code: string }; Returns: Json }
      record_start_incident: {
        Args: {
          p_assessment_id: string
          p_build?: string
          p_correlation?: string
          p_error_code: string
          p_kind: string
          p_path?: string
        }
        Returns: Json
      }
      record_system_interruption: {
        Args: { p_assessment_id: string; p_reason: string }
        Returns: undefined
      }
      recovery_claim_due: {
        Args: { p_assessment_id?: string; p_limit?: number }
        Returns: Json
      }
      recovery_health_check: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      recovery_log: {
        Args: { p_case: string; p_detail?: Json; p_event: string }
        Returns: undefined
      }
      recovery_mark_sent: {
        Args: { p_case: string; p_error?: string; p_ok: boolean }
        Returns: undefined
      }
      recovery_outbox_lease: {
        Args: { p_case?: string; p_limit?: number }
        Returns: {
          attempts: number
          case_id: string
          id: string
          link_token: string
          message_key: string
          payload: Json
          phase: string
          reminder_no: number
        }[]
      }
      recovery_outbox_result: {
        Args: {
          p_attempt: number
          p_error: string
          p_id: string
          p_ok: boolean
          p_provider_id: string
        }
        Returns: Json
      }
      recovery_policy: { Args: never; Returns: Json }
      recovery_test_simulate: {
        Args: { p_assessment_id: string }
        Returns: Json
      }
      recruiter_outreach_sync: { Args: never; Returns: Json }
      redeem_recovery_token: { Args: { p_token: string }; Returns: Json }
      refresh_ticker_stats: { Args: never; Returns: undefined }
      reply_lineup_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: Json
      }
      report_company_post: {
        Args: { post_id: string; reason?: string }
        Returns: boolean
      }
      report_rank_mismatch: {
        Args: { p_assessment_id: string; p_note?: string }
        Returns: Json
      }
      resolve_canonical_rank: { Args: { p_rank: string }; Returns: Json }
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
      resolve_interview_spec_v3: {
        Args: {
          p_contracts_in_rank: number
          p_cv_claims?: Json
          p_engine_types?: Json
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
      rpc_submit_support_ticket: {
        Args: {
          p_assessment_id: string
          p_category: string
          p_client_build: string
          p_component: string
          p_contact_email: string
          p_contact_whatsapp: string
          p_description: string
          p_error_signature: string
          p_operation: string
          p_reporter_key: string
          p_route_pathname: string
          p_subject: string
          p_submission_id: string
          p_user_id: string
        }
        Returns: Json
      }
      save_checkpoint: {
        Args: {
          p_assessment_id: string
          p_current_index: number
          p_elapsed_seconds?: number
        }
        Returns: Json
      }
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
      set_lineup_ticket_status: {
        Args: { p_action: string; p_note?: string; p_ticket_id: string }
        Returns: Json
      }
      ship_photo_visible: { Args: { _path: string }; Returns: boolean }
      start_or_resume_assessment: { Args: never; Returns: Json }
      submit_application: {
        Args: {
          p_company_name?: string
          p_company_post_id?: string
          p_external_url?: string
          p_job_posting_id?: string
          p_rank?: string
          p_vacancy_id?: string
          p_vessel?: string
        }
        Returns: Json
      }
      submit_company_compliance: {
        Args: {
          p_license: string
          p_note: string
          p_paths: string[]
          p_website: string
        }
        Returns: Json
      }
      submit_company_verification: {
        Args: {
          p_business_path: string
          p_crewing_path: string
          p_license: string
          p_person: Json
          p_website: string
        }
        Returns: Json
      }
      submit_paper_answer: {
        Args: {
          p_answer: string
          p_assessment_id: string
          p_paper_item_id: string
        }
        Returns: Json
      }
      support_rate_ok: {
        Args: {
          p_action: string
          p_key: string
          p_max: number
          p_window: string
        }
        Returns: boolean
      }
      sync_credit_milestones: { Args: { p_uid: string }; Returns: undefined }
      takeover_add_member: {
        Args: { p_email: string; p_inspection_id: string; p_role: string }
        Returns: Json
      }
      takeover_can_edit: { Args: { _inspection_id: string }; Returns: boolean }
      takeover_can_read: { Args: { _inspection_id: string }; Returns: boolean }
      takeover_create_inspection: {
        Args: {
          p_class_society?: string
          p_flag?: string
          p_imo?: string
          p_inspector_name?: string
          p_port_of_registry?: string
          p_started_on?: string
          p_vessel_name: string
        }
        Returns: Json
      }
      takeover_limitations: { Args: { p_inspection_id: string }; Returns: Json }
      takeover_list_members: {
        Args: { p_inspection_id: string }
        Returns: {
          created_at: string
          email: string
          role: string
          user_id: string
        }[]
      }
      takeover_member_role: {
        Args: { _inspection_id: string }
        Returns: string
      }
      takeover_remove_member: {
        Args: { p_inspection_id: string; p_user_id: string }
        Returns: Json
      }
      takeover_save_answer: {
        Args: {
          p_data: Json
          p_expected_version: number
          p_group_key: string
          p_inspection_id: string
          p_item_ref: string
        }
        Returns: Json
      }
      takeover_submit:
        | {
            Args: { p_inspection_id: string; p_limitation_note?: string }
            Returns: Json
          }
        | {
            Args: {
              p_expected_answer_count?: number
              p_expected_version_sum?: number
              p_inspection_id: string
              p_limitation_note?: string
            }
            Returns: Json
          }
      training_assign: {
        Args: {
          p_application_id?: string
          p_area?: string
          p_invite_id?: string
          p_slugs?: string[]
        }
        Returns: Json
      }
      training_catalog: { Args: never; Returns: Json }
      training_complete: {
        Args: { p_answers: number[]; p_token: string }
        Returns: Json
      }
      training_ledger: {
        Args: { p_application_id?: string; p_invite_id?: string }
        Returns: Json
      }
      training_open: { Args: { p_token: string }; Returns: Json }
      training_recommend: {
        Args: {
          p_application_id?: string
          p_area?: string
          p_invite_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      training_recommend_core: {
        Args: {
          p_area: string
          p_crew: string
          p_limit: number
          p_target_vessel: string
        }
        Returns: Json
      }
      training_resolve_crew: {
        Args: { p_application_id?: string; p_invite_id: string }
        Returns: Json
      }
      training_vessel_family: { Args: { p: string }; Returns: string }
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
      vacancy_application_counts: {
        Args: { p_ids: string[] }
        Returns: {
          applications: number
          vacancy_id: string
        }[]
      }
      vacancy_lifecycle_action: {
        Args: {
          p_action: string
          p_filters?: Json
          p_ids: string[]
          p_kind: string
        }
        Returns: Json
      }
      vacancy_origin_counts: { Args: never; Returns: Json }
      vacancy_origin_of: {
        Args: { email: string; rname: string; wa: string }
        Returns: string
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
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
