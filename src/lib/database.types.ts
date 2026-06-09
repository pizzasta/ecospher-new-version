export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          signal_core: string | null
          profile_energy: string | null
          onboarding_complete: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          username: string
          signal_core?: string | null
          profile_energy?: string | null
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          username?: string
          signal_core?: string | null
          profile_energy?: string | null
          onboarding_complete?: boolean
          updated_at?: string | null
        }
      }
      signals: {
        Row: {
          id: string
          creator_id: string | null
          type: string
          title: string
          caption: string | null
          audio_path: string | null
          duration_seconds: number | null
          mood: string | null
          frequency: string | null
          visibility: 'public' | 'private' | 'unlisted'
          ai_moderation_status: 'not_checked' | 'passed' | 'flagged'
          ai_moderation_flags: string[]
          ai_moderation_checked_at: string | null
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          creator_id?: string | null
          type: string
          title: string
          caption?: string | null
          audio_path?: string | null
          duration_seconds?: number | null
          mood?: string | null
          frequency?: string | null
          visibility?: 'public' | 'private' | 'unlisted'
          ai_moderation_status?: 'not_checked' | 'passed' | 'flagged'
          ai_moderation_flags?: string[]
          ai_moderation_checked_at?: string | null
          is_anonymous?: boolean
          created_at?: string
        }
        Update: {
          title?: string
          caption?: string | null
          audio_path?: string | null
          duration_seconds?: number | null
          mood?: string | null
          frequency?: string | null
          visibility?: 'public' | 'private' | 'unlisted'
          ai_moderation_status?: 'not_checked' | 'passed' | 'flagged'
          ai_moderation_flags?: string[]
          ai_moderation_checked_at?: string | null
          is_anonymous?: boolean
        }
      }
      signal_replays: {
        Row: {
          id: string
          signal_id: string
          listener_id: string | null
          session_id: string | null
          source_page: string | null
          replayed_at: string
          dedupe_key: string | null
        }
        Insert: {
          id?: string
          signal_id: string
          listener_id?: string | null
          session_id?: string | null
          source_page?: string | null
          replayed_at?: string
          dedupe_key?: string | null
        }
        Update: {
          source_page?: string | null
        }
      }
      audio_files: {
        Row: {
          id: string
          signal_id: string | null
          uploader_id: string | null
          storage_path: string
          mime_type: string
          size_bytes: number | null
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          signal_id?: string | null
          uploader_id?: string | null
          storage_path: string
          mime_type: string
          size_bytes?: number | null
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          signal_id?: string | null
          storage_path?: string
          mime_type?: string
          size_bytes?: number | null
          duration_seconds?: number | null
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
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          audio_path?: string | null
          text_note?: string | null
          emotional_tag?: string | null
          status?: 'saved' | 'archived' | 'private' | 'new'
          created_at?: string
        }
        Update: {
          title?: string
          audio_path?: string | null
          text_note?: string | null
          emotional_tag?: string | null
          status?: 'saved' | 'archived' | 'private' | 'new'
        }
      }
      relics: {
        Row: {
          id: string
          name: string
          rarity: 'common' | 'rare' | 'mythic' | 'forbidden'
          description: string
          unlock_condition: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          rarity: 'common' | 'rare' | 'mythic' | 'forbidden'
          description: string
          unlock_condition?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          rarity?: 'common' | 'rare' | 'mythic' | 'forbidden'
          description?: string
          unlock_condition?: string | null
        }
      }
      user_relics: {
        Row: {
          id: string
          user_id: string
          relic_id: string
          source_signal_id: string | null
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          relic_id: string
          source_signal_id?: string | null
          unlocked_at?: string
        }
        Update: {
          source_signal_id?: string | null
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
          capsule_id: string | null
          relic_id: string | null
          room_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          user_id?: string | null
          signal_id?: string | null
          capsule_id?: string | null
          relic_id?: string | null
          room_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          metadata?: Json | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
