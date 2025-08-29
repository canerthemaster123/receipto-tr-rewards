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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          alert_type: string
          chain_group: string
          created_at: string | null
          current_value: number
          geo_level: string
          geo_value: string
          id: string
          metric_name: string
          previous_value: number
          sample_size: number
          severity: string
          week_start: string
          z_score: number
        }
        Insert: {
          alert_type: string
          chain_group: string
          created_at?: string | null
          current_value: number
          geo_level: string
          geo_value: string
          id?: string
          metric_name: string
          previous_value: number
          sample_size: number
          severity?: string
          week_start: string
          z_score: number
        }
        Update: {
          alert_type?: string
          chain_group?: string
          created_at?: string | null
          current_value?: number
          geo_level?: string
          geo_value?: string
          id?: string
          metric_name?: string
          previous_value?: number
          sample_size?: number
          severity?: string
          week_start?: string
          z_score?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          id: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          active: boolean
          desc_en: string | null
          desc_tr: string | null
          icon: string
          id: string
          key: string
          name_en: string
          name_tr: string
          sort: number
        }
        Insert: {
          active?: boolean
          desc_en?: string | null
          desc_tr?: string | null
          icon: string
          id?: string
          key: string
          name_en: string
          name_tr: string
          sort?: number
        }
        Update: {
          active?: boolean
          desc_en?: string | null
          desc_tr?: string | null
          icon?: string
          id?: string
          key?: string
          name_en?: string
          name_tr?: string
          sort?: number
        }
        Relationships: []
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string | null
          created_by: string | null
          ends_at: string
          goal_key: string
          goal_target: number
          id: string
          reward_points: number
          starts_at: string
          title_en: string
          title_tr: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          goal_key: string
          goal_target: number
          id?: string
          reward_points?: number
          starts_at: string
          title_en: string
          title_tr: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          goal_key?: string
          goal_target?: number
          id?: string
          reward_points?: number
          starts_at?: string
          title_en?: string
          title_tr?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          created_at: string | null
          id: string
          period_key: string
          points: number
          public_name: string
          rank: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          period_key: string
          points: number
          public_name: string
          rank: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          period_key?: string
          points?: number
          public_name?: string
          rank?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_map: {
        Row: {
          active: boolean | null
          chain_group: string
          created_at: string | null
          id: string
          priority: number | null
          raw_merchant: string
        }
        Insert: {
          active?: boolean | null
          chain_group: string
          created_at?: string | null
          id?: string
          priority?: number | null
          raw_merchant: string
        }
        Update: {
          active?: boolean | null
          chain_group?: string
          created_at?: string | null
          id?: string
          priority?: number | null
          raw_merchant?: string
        }
        Relationships: []
      }
      period_geo_merchant_week: {
        Row: {
          avg_basket_value: number | null
          chain_group: string
          city: string
          created_at: string | null
          district: string
          neighborhood: string
          new_users: number | null
          receipt_count: number | null
          returning_users: number | null
          total_spend: number | null
          unique_users: number | null
          week_start: string
        }
        Insert: {
          avg_basket_value?: number | null
          chain_group: string
          city: string
          created_at?: string | null
          district: string
          neighborhood: string
          new_users?: number | null
          receipt_count?: number | null
          returning_users?: number | null
          total_spend?: number | null
          unique_users?: number | null
          week_start: string
        }
        Update: {
          avg_basket_value?: number | null
          chain_group?: string
          city?: string
          created_at?: string | null
          district?: string
          neighborhood?: string
          new_users?: number | null
          receipt_count?: number | null
          returning_users?: number | null
          total_spend?: number | null
          unique_users?: number | null
          week_start?: string
        }
        Relationships: []
      }
      period_user_merchant_week: {
        Row: {
          avg_basket_value: number | null
          chain_group: string
          created_at: string | null
          first_visit_week: boolean | null
          last_visit_week: boolean | null
          receipt_count: number | null
          total_spend: number | null
          user_id: string
          week_start: string
        }
        Insert: {
          avg_basket_value?: number | null
          chain_group: string
          created_at?: string | null
          first_visit_week?: boolean | null
          last_visit_week?: boolean | null
          receipt_count?: number | null
          total_spend?: number | null
          user_id: string
          week_start: string
        }
        Update: {
          avg_basket_value?: number | null
          chain_group?: string
          created_at?: string | null
          first_visit_week?: boolean | null
          last_visit_week?: boolean | null
          receipt_count?: number | null
          total_spend?: number | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          created_at: string | null
          delta: number
          id: string
          meta: Json | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delta: number
          id?: string
          meta?: Json | null
          source: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          delta?: number
          id?: string
          meta?: Json | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          bbox: Json | null
          created_at: string | null
          ean13: string | null
          id: string
          item_name: string
          item_name_norm: string | null
          item_name_raw: string | null
          line_no: number | null
          line_total: number | null
          product_code: string | null
          qty: number | null
          raw_line: string | null
          receipt_id: string
          unit: string | null
          unit_price: number | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          bbox?: Json | null
          created_at?: string | null
          ean13?: string | null
          id?: string
          item_name: string
          item_name_norm?: string | null
          item_name_raw?: string | null
          line_no?: number | null
          line_total?: number | null
          product_code?: string | null
          qty?: number | null
          raw_line?: string | null
          receipt_id: string
          unit?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          bbox?: Json | null
          created_at?: string | null
          ean13?: string | null
          id?: string
          item_name?: string
          item_name_norm?: string | null
          item_name_raw?: string | null
          line_no?: number | null
          line_total?: number | null
          product_code?: string | null
          qty?: number | null
          raw_line?: string | null
          receipt_id?: string
          unit?: string | null
          unit_price?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          address_raw: string | null
          barcode_numbers: string[] | null
          card_scheme: string | null
          city: string | null
          created_at: string | null
          discount_total: number | null
          district: string | null
          fis_no: string | null
          h3_8: string | null
          id: string
          image_url: string | null
          items: string | null
          masked_pan: string | null
          merchant: string | null
          merchant_brand: string | null
          neighborhood: string | null
          ocr_engine: string | null
          ocr_json: Json | null
          parse_confidence: number | null
          payment_method: string | null
          points: number | null
          purchase_date: string | null
          purchase_time: string | null
          receipt_unique_no: string | null
          status: string | null
          store_address: string | null
          store_id: string | null
          street: string | null
          subtotal: number | null
          total: number | null
          updated_at: string | null
          user_id: string
          vat_total: number | null
        }
        Insert: {
          address_raw?: string | null
          barcode_numbers?: string[] | null
          card_scheme?: string | null
          city?: string | null
          created_at?: string | null
          discount_total?: number | null
          district?: string | null
          fis_no?: string | null
          h3_8?: string | null
          id?: string
          image_url?: string | null
          items?: string | null
          masked_pan?: string | null
          merchant?: string | null
          merchant_brand?: string | null
          neighborhood?: string | null
          ocr_engine?: string | null
          ocr_json?: Json | null
          parse_confidence?: number | null
          payment_method?: string | null
          points?: number | null
          purchase_date?: string | null
          purchase_time?: string | null
          receipt_unique_no?: string | null
          status?: string | null
          store_address?: string | null
          store_id?: string | null
          street?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id: string
          vat_total?: number | null
        }
        Update: {
          address_raw?: string | null
          barcode_numbers?: string[] | null
          card_scheme?: string | null
          city?: string | null
          created_at?: string | null
          discount_total?: number | null
          district?: string | null
          fis_no?: string | null
          h3_8?: string | null
          id?: string
          image_url?: string | null
          items?: string | null
          masked_pan?: string | null
          merchant?: string | null
          merchant_brand?: string | null
          neighborhood?: string | null
          ocr_engine?: string | null
          ocr_json?: Json | null
          parse_confidence?: number | null
          payment_method?: string | null
          points?: number | null
          purchase_date?: string | null
          purchase_time?: string | null
          receipt_unique_no?: string | null
          status?: string | null
          store_address?: string | null
          store_id?: string | null
          street?: string | null
          subtotal?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
          vat_total?: number | null
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          created_at: string | null
          id: string
          points_cost: number
          reward_name: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points_cost: number
          reward_name: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points_cost?: number
          reward_name?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          points_awarded: number | null
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points_awarded?: number | null
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points_awarded?: number | null
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      request_throttle: {
        Row: {
          action: string
          created_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_dim: {
        Row: {
          address: string | null
          chain_group: string
          city: string | null
          created_at: string | null
          district: string | null
          h3_8: string | null
          id: string
          lat: number | null
          lng: number | null
          neighborhood: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          chain_group: string
          city?: string | null
          created_at?: string | null
          district?: string | null
          h3_8?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          chain_group?: string
          city?: string | null
          created_at?: string | null
          district?: string | null
          h3_8?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_key: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          current_streak: number
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_profile"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profile: {
        Row: {
          birth_date: string | null
          city: string | null
          created_at: string | null
          display_name: string | null
          gender: string | null
          id: string
          phone_number: string | null
          referral_code: string | null
          referred_by: string | null
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id: string
          phone_number?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string
          phone_number?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_action: {
        Args: { p_action: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      apply_referral_bonus: {
        Args: { code: string; new_user_id: string }
        Returns: Json
      }
      approve_all_pending_for_merchant: {
        Args: { p_merchant: string }
        Returns: Json
      }
      approve_receipt_with_points: {
        Args: { points_awarded?: number; receipt_id: string }
        Returns: Json
      }
      award_badges_if_any: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      build_leaderboard_snapshot: {
        Args: { p_end_date: string; p_period_key: string; p_start_date: string }
        Returns: undefined
      }
      cleanup_throttle_records: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fn_detect_alerts_for_week: {
        Args: { p_week_start: string }
        Returns: undefined
      }
      fn_fill_period_geo_merchant_week: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      fn_fill_period_user_merchant_week: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      fn_run_weekly_rollups: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_admin: {
        Args: Record<PropertyKey, never> | { p_user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_admin_action: {
        Args:
          | {
              _action: string
              _new_values?: Json
              _old_values?: Json
              _record_id?: string
              _table_name?: string
            }
          | {
              _action: string
              _new_values?: Json
              _old_values?: Json
              _record_id?: string
              _table_name?: string
            }
        Returns: undefined
      }
      mask_name: {
        Args: { display_name: string }
        Returns: string
      }
      normalize_merchant_to_chain: {
        Args: { p_raw_merchant: string }
        Returns: string
      }
      process_referral: {
        Args: { referral_code: string }
        Returns: Json
      }
      qa_make_self_admin: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      qa_reset_test_data: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      redeem_reward: {
        Args: { points_cost: number; reward_name: string }
        Returns: Json
      }
      reject_receipt: {
        Args: { p_receipt_id: string }
        Returns: Json
      }
      secure_upload_check: {
        Args: { p_file_size?: number }
        Returns: Json
      }
      update_challenge_progress: {
        Args: { p_goal_key: string; p_increment?: number; p_user_id: string }
        Returns: undefined
      }
      update_user_profile_safe: {
        Args: { p_display_name?: string; p_other_field?: string }
        Returns: Json
      }
      update_user_streak: {
        Args: { p_date?: string; p_user_id: string }
        Returns: undefined
      }
      upsert_store_dim: {
        Args: {
          p_address?: string
          p_chain_group: string
          p_city?: string
          p_district?: string
          p_h3_8?: string
          p_lat?: number
          p_lng?: number
          p_neighborhood?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
