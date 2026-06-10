export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type PublicTables = {
      profiles: {
        Row: {
          id: string
          username: string
          signal_core: string | null
          profile_energy: string | null
          onboarding_complete: boolean
          is_private: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          username: string
          signal_core?: string | null
          profile_energy?: string | null
          onboarding_complete?: boolean
          is_private?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          username?: string
          signal_core?: string | null
          profile_energy?: string | null
          onboarding_complete?: boolean
          is_private?: boolean
          updated_at?: string | null
        }
      }
      audio_files: {
        Row: {
          id: string
          owner_id: string | null
          bucket: string
          path: string
          title: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          mime_type: string | null
          waveform_data: Json
          is_public: boolean
          is_archived: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          owner_id?: string | null
          bucket: string
          path: string
          title?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          mime_type?: string | null
          waveform_data?: Json
          is_public?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          title?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          mime_type?: string | null
          waveform_data?: Json
          is_public?: boolean
          is_archived?: boolean
          updated_at?: string | null
        }
      }
      signals: {
        Row: {
          id: string
          creator_id: string | null
          audio_file_id: string | null
          ai_moderation_checked_at: string | null
          ai_moderation_flags: string[]
          ai_moderation_status: 'not_checked' | 'passed' | 'flagged'
          type: string
          title: string
          caption: string | null
          duration_seconds: number | null
          emotional_tags: string[]
          mood: string | null
          frequency: string | null
          visibility: 'public' | 'private' | 'unlisted'
          privacy_state: 'private' | 'public' | 'anonymous_public' | 'archived' | 'deleted'
          deleted_at: string | null
          moderation_state: 'active' | 'under_review' | 'hidden' | 'cleared'
          hidden_at: string | null
          report_count: number
          replay_count: number
          is_anonymous: boolean
          is_public: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          creator_id?: string | null
          audio_file_id?: string | null
          ai_moderation_checked_at?: string | null
          ai_moderation_flags?: string[]
          ai_moderation_status?: 'not_checked' | 'passed' | 'flagged'
          type: string
          title: string
          caption?: string | null
          duration_seconds?: number | null
          emotional_tags?: string[]
          mood?: string | null
          frequency?: string | null
          visibility?: 'public' | 'private' | 'unlisted'
          privacy_state?: 'private' | 'public' | 'anonymous_public' | 'archived' | 'deleted'
          deleted_at?: string | null
          moderation_state?: 'active' | 'under_review' | 'hidden' | 'cleared'
          hidden_at?: string | null
          report_count?: number
          replay_count?: number
          is_anonymous?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          title?: string
          ai_moderation_checked_at?: string | null
          ai_moderation_flags?: string[]
          ai_moderation_status?: 'not_checked' | 'passed' | 'flagged'
          caption?: string | null
          duration_seconds?: number | null
          emotional_tags?: string[]
          mood?: string | null
          frequency?: string | null
          visibility?: 'public' | 'private' | 'unlisted'
          privacy_state?: 'private' | 'public' | 'anonymous_public' | 'archived' | 'deleted'
          deleted_at?: string | null
          moderation_state?: 'active' | 'under_review' | 'hidden' | 'cleared'
          hidden_at?: string | null
          report_count?: number
          replay_count?: number
          is_anonymous?: boolean
          updated_at?: string | null
        }
      }
      signal_reports: {
        Row: {
          id: string
          signal_id: string
          reporter_id: string
          reason: 'harassment' | 'self_harm' | 'sexual_content' | 'violence' | 'spam' | 'privacy' | 'other'
          details: string | null
          status: 'open' | 'reviewed' | 'dismissed' | 'actioned'
          created_at: string
        }
        Insert: {
          id?: string
          signal_id: string
          reporter_id: string
          reason?: 'harassment' | 'self_harm' | 'sexual_content' | 'violence' | 'spam' | 'privacy' | 'other'
          details?: string | null
          status?: 'open' | 'reviewed' | 'dismissed' | 'actioned'
          created_at?: string
        }
        Update: {
          reason?: 'harassment' | 'self_harm' | 'sexual_content' | 'violence' | 'spam' | 'privacy' | 'other'
          details?: string | null
          status?: 'open' | 'reviewed' | 'dismissed' | 'actioned'
        }
      }
      moderation_reviews: {
        Row: {
          id: string
          signal_id: string
          report_id: string | null
          status: 'queued' | 'reviewing' | 'resolved' | 'dismissed'
          action: 'none' | 'hide_signal' | 'restore_signal' | 'delete_signal' | null
          reviewer_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          signal_id: string
          report_id?: string | null
          status?: 'queued' | 'reviewing' | 'resolved' | 'dismissed'
          action?: 'none' | 'hide_signal' | 'restore_signal' | 'delete_signal' | null
          reviewer_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'queued' | 'reviewing' | 'resolved' | 'dismissed'
          action?: 'none' | 'hide_signal' | 'restore_signal' | 'delete_signal' | null
          reviewer_id?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      replays: {
        Row: {
          id: string
          signal_id: string
          listener_id: string | null
          session_id: string | null
          dedupe_key: string | null
          source_page: string | null
          created_at: string
        }
        Insert: {
          id?: string
          signal_id: string
          listener_id?: string | null
          session_id?: string | null
          dedupe_key?: string | null
          source_page?: string | null
          created_at?: string
        }
        Update: {
          dedupe_key?: string | null
          source_page?: string | null
        }
      }
      capsules: {
        Row: {
          id: string
          user_id: string
          title: string
          audio_path: string | null
          text_note: string | null
          emotional_tag: string | null
          status: 'saved' | 'archived' | 'private' | 'new'
          unlock_at: string | null
          opened_at: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          audio_path?: string | null
          text_note?: string | null
          emotional_tag?: string | null
          status?: 'saved' | 'archived' | 'private' | 'new'
          unlock_at?: string | null
          opened_at?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          title?: string
          audio_path?: string | null
          text_note?: string | null
          emotional_tag?: string | null
          status?: 'saved' | 'archived' | 'private' | 'new'
          unlock_at?: string | null
          opened_at?: string | null
          updated_at?: string | null
        }
      }
      saved_signals: {
        Row: {
          id: string
          user_id: string
          signal_id: string
          note: string | null
          saved_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_id: string
          note?: string | null
          saved_at?: string
        }
        Update: {
          note?: string | null
        }
      }
      archive_items: {
        Row: {
          id: string
          user_id: string
          item_type: 'signal' | 'audio' | 'capsule' | 'relic'
          item_id: string
          note: string | null
          archived_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_type: 'signal' | 'audio' | 'capsule' | 'relic'
          item_id: string
          note?: string | null
          archived_at?: string
        }
        Update: {
          note?: string | null
        }
      }
      relics: {
        Row: {
          id: string
          name: string
          rarity: 'common' | 'rare' | 'mythic' | 'forbidden'
          description: string
          unlock_condition: string | null
          is_public: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          rarity: 'common' | 'rare' | 'mythic' | 'forbidden'
          description: string
          unlock_condition?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          name?: string
          rarity?: 'common' | 'rare' | 'mythic' | 'forbidden'
          description?: string
          unlock_condition?: string | null
          is_public?: boolean
          updated_at?: string | null
        }
      }
      user_relics: {
        Row: {
          id: string
          user_id: string
          relic_id: string
          source_signal_id: string | null
          is_favorite: boolean
          discovery_source: string | null
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          relic_id: string
          source_signal_id?: string | null
          is_favorite?: boolean
          discovery_source?: string | null
          unlocked_at?: string
        }
        Update: {
          source_signal_id?: string | null
          is_favorite?: boolean
          discovery_source?: string | null
        }
      }
      soul_pod_items: {
        Row: {
          id: string
          user_id: string
          item_type: string
          signal_id: string | null
          capsule_id: string | null
          relic_id: string | null
          note: string | null
          saved_at: string
        }
        Insert: {
          id?: string
          user_id: string
          item_type: string
          signal_id?: string | null
          capsule_id?: string | null
          relic_id?: string | null
          note?: string | null
          saved_at?: string
        }
        Update: {
          note?: string | null
        }
      }
      archived_signals: {
        Row: {
          id: string
          user_id: string
          signal_id: string
          archive_reason: string | null
          is_private: boolean
          archived_at: string
        }
        Insert: {
          id?: string
          user_id: string
          signal_id: string
          archive_reason?: string | null
          is_private?: boolean
          archived_at?: string
        }
        Update: {
          archive_reason?: string | null
          is_private?: boolean
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          mood: string | null
          frequency: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          mood?: string | null
          frequency?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          mood?: string | null
          frequency?: string | null
          status?: string | null
        }
      }
      room_presence: {
        Row: {
          id: string
          room_id: string
          user_id: string
          joined_at: string
          last_active_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          joined_at?: string
          last_active_at?: string
        }
        Update: {
          last_active_at?: string
        }
      }
      activity_events: {
        Row: {
          id: string
          type: string
          user_id: string | null
          signal_id: string | null
          audio_file_id: string | null
          relic_id: string | null
          capsule_id: string | null
          metadata: Json | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          user_id?: string | null
          signal_id?: string | null
          audio_file_id?: string | null
          relic_id?: string | null
          capsule_id?: string | null
          metadata?: Json | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          metadata?: Json | null
          is_public?: boolean
        }
      }
      frequencies: {
        Row: {
          id: string
          name: string
          mood: string | null
          frequency_label: string | null
          description: string | null
          signal_strength: number
          color_accent: string | null
          is_demo: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          mood?: string | null
          frequency_label?: string | null
          description?: string | null
          signal_strength?: number
          color_accent?: string | null
          is_demo?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          mood?: string | null
          frequency_label?: string | null
          description?: string | null
          signal_strength?: number
          color_accent?: string | null
          is_demo?: boolean
          metadata?: Json
          updated_at?: string
        }
      }
      drift_nodes: {
        Row: {
          id: string
          label: string
          zone: string | null
          x: number
          y: number
          intensity: number
          description: string | null
          is_demo: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          label: string
          zone?: string | null
          x: number
          y: number
          intensity?: number
          description?: string | null
          is_demo?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          label?: string
          zone?: string | null
          x?: number
          y?: number
          intensity?: number
          description?: string | null
          is_demo?: boolean
          metadata?: Json
          updated_at?: string
        }
      }
}

export type Database = {
  public: {
    Tables: {
      [K in keyof PublicTables]: PublicTables[K] & { Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      report_signal: {
        Args: {
          p_signal_id: string
          p_reason?: 'harassment' | 'self_harm' | 'sexual_content' | 'violence' | 'spam' | 'privacy' | 'other'
          p_details?: string | null
        }
        Returns: Json
      }
    }
    Enums: Record<string, never>
  }
}
