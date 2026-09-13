export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string;
          code: string;
          description: string;
          emoji: string;
          gold_reward: number;
          name: string;
          sort_order: number;
          threshold: number;
        };
        Insert: {
          category: string;
          code: string;
          description: string;
          emoji: string;
          gold_reward?: number;
          name: string;
          sort_order?: number;
          threshold?: number;
        };
        Update: {
          category?: string;
          code?: string;
          description?: string;
          emoji?: string;
          gold_reward?: number;
          name?: string;
          sort_order?: number;
          threshold?: number;
        };
        Relationships: [];
      };
      daily_activity: {
        Row: {
          day: string;
          gold_earned: number;
          quests_completed: number;
          user_id: string;
          xp_earned: number;
        };
        Insert: {
          day: string;
          gold_earned?: number;
          quests_completed?: number;
          user_id: string;
          xp_earned?: number;
        };
        Update: {
          day?: string;
          gold_earned?: number;
          quests_completed?: number;
          user_id?: string;
          xp_earned?: number;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          completed_at: string | null;
          completed_quests: number;
          created_at: string;
          emoji: string;
          id: string;
          target_quests: number;
          title: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          completed_quests?: number;
          created_at?: string;
          emoji?: string;
          id?: string;
          target_quests?: number;
          title: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          completed_quests?: number;
          created_at?: string;
          emoji?: string;
          id?: string;
          target_quests?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          item_code: string;
          quantity: number;
          user_id: string;
        };
        Insert: {
          item_code: string;
          quantity?: number;
          user_id: string;
        };
        Update: {
          item_code?: string;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_item_code_fkey";
            columns: ["item_code"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["code"];
          },
        ];
      };
      items: {
        Row: {
          code: string;
          description: string;
          effect: string;
          emoji: string;
          name: string;
          price_gold: number;
          rarity: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          description: string;
          effect: string;
          emoji: string;
          name: string;
          price_gold: number;
          rarity?: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          description?: string;
          effect?: string;
          emoji?: string;
          name?: string;
          price_gold?: number;
          rarity?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      player_effects: {
        Row: {
          streak_shields: number;
          user_id: string;
        };
        Insert: {
          streak_shields?: number;
          user_id: string;
        };
        Update: {
          streak_shields?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_emoji: string;
          created_at: string;
          current_streak: number;
          display_name: string;
          gold: number;
          id: string;
          is_public: boolean;
          last_active_date: string | null;
          level: number;
          longest_streak: number;
          quests_completed: number;
          timezone: string;
          title: string;
          xp: number;
          username: string | null;
          full_name: string | null;
          main_goal: string | null;
          focus_xp: number;
          body_xp: number;
          mind_xp: number;
          craft_xp: number;
          reward_prefs: string[];
          onboarding_complete: boolean;
          reduced_motion: boolean;
        };
        Insert: {
          avatar_emoji?: string;
          created_at?: string;
          current_streak?: number;
          display_name?: string;
          gold?: number;
          id: string;
          is_public?: boolean;
          last_active_date?: string | null;
          level?: number;
          longest_streak?: number;
          quests_completed?: number;
          timezone?: string;
          title?: string;
          xp?: number;
          username?: string | null;
          full_name?: string | null;
          main_goal?: string | null;
          focus_xp?: number;
          body_xp?: number;
          mind_xp?: number;
          craft_xp?: number;
          reward_prefs?: string[];
          onboarding_complete?: boolean;
          reduced_motion?: boolean;
        };
        Update: {
          avatar_emoji?: string;
          created_at?: string;
          current_streak?: number;
          display_name?: string;
          gold?: number;
          id?: string;
          is_public?: boolean;
          last_active_date?: string | null;
          level?: number;
          longest_streak?: number;
          quests_completed?: number;
          timezone?: string;
          title?: string;
          xp?: number;
          username?: string | null;
          full_name?: string | null;
          main_goal?: string | null;
          focus_xp?: number;
          body_xp?: number;
          mind_xp?: number;
          craft_xp?: number;
          reward_prefs?: string[];
          onboarding_complete?: boolean;
          reduced_motion?: boolean;
        };
        Relationships: [];
      };
      quest_completions: {
        Row: {
          category: string;
          completed_at: string;
          day: string;
          gold_awarded: number;
          id: string;
          quest_id: string;
          user_id: string;
          xp_awarded: number;
        };
        Insert: {
          category?: string;
          completed_at?: string;
          day: string;
          gold_awarded: number;
          id?: string;
          quest_id: string;
          user_id: string;
          xp_awarded: number;
        };
        Update: {
          category?: string;
          completed_at?: string;
          day?: string;
          gold_awarded?: number;
          id?: string;
          quest_id?: string;
          user_id?: string;
          xp_awarded?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quest_completions_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: true;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
        ];
      };
      quests: {
        Row: {
          category: string;
          completed_at: string | null;
          created_at: string;
          difficulty: Database["public"]["Enums"]["quest_difficulty"];
          goal_id: string | null;
          gold_reward: number;
          id: string;
          quest_date: string;
          recovered_from: string | null;
          source: string;
          status: Database["public"]["Enums"]["quest_status"];
          title: string;
          user_id: string;
          xp_reward: number;
          rewards_locked: boolean;
          description: string | null;
          activity_key: string | null;
          attribute: string | null;
          est_duration_min: number;
          due_at: string | null;
          deadline_external: boolean;
          times_postponed: number;
          actual_duration_min: number | null;
          parent_quest_id: string | null;
        };
        Insert: {
          category?: string;
          completed_at?: string | null;
          created_at?: string;
          difficulty?: Database["public"]["Enums"]["quest_difficulty"];
          goal_id?: string | null;
          gold_reward?: number;
          id?: string;
          quest_date: string;
          recovered_from?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["quest_status"];
          title: string;
          user_id: string;
          xp_reward?: number;
          rewards_locked?: boolean;
          description?: string | null;
          activity_key?: string | null;
          attribute?: string | null;
          est_duration_min?: number;
          due_at?: string | null;
          deadline_external?: boolean;
          times_postponed?: number;
          actual_duration_min?: number | null;
          parent_quest_id?: string | null;
        };
        Update: {
          category?: string;
          completed_at?: string | null;
          created_at?: string;
          difficulty?: Database["public"]["Enums"]["quest_difficulty"];
          goal_id?: string | null;
          gold_reward?: number;
          id?: string;
          quest_date?: string;
          recovered_from?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["quest_status"];
          title?: string;
          user_id?: string;
          xp_reward?: number;
          rewards_locked?: boolean;
          description?: string | null;
          activity_key?: string | null;
          attribute?: string | null;
          est_duration_min?: number;
          due_at?: string | null;
          deadline_external?: boolean;
          times_postponed?: number;
          actual_duration_min?: number | null;
          parent_quest_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quests_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quests_recovered_from_fkey";
            columns: ["recovered_from"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
        ];
      };
      user_activities: {
        Row: {
          id: string;
          user_id: string;
          activity_key: string;
          config: Json;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_key: string;
          config?: Json;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_key?: string;
          config?: Json;
          enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      rescope_suggestions: {
        Row: {
          id: string;
          user_id: string;
          quest_id: string;
          risk_score: number;
          intervention: string;
          plan: Json;
          rationale: string;
          engine_version: string;
          outcome: string;
          suggested_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          quest_id: string;
          risk_score: number;
          intervention: string;
          plan?: Json;
          rationale: string;
          engine_version?: string;
          outcome?: string;
          suggested_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          quest_id?: string;
          risk_score?: number;
          intervention?: string;
          plan?: Json;
          rationale?: string;
          engine_version?: string;
          outcome?: string;
          suggested_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rescope_suggestions_quest_id_fkey";
            columns: ["quest_id"];
            isOneToOne: false;
            referencedRelation: "quests";
            referencedColumns: ["id"];
          },
        ];
      };
      security_flags: {
        Row: {
          created_at: string;
          details: Json;
          id: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          details?: Json;
          id?: string;
          reason: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          details?: Json;
          id?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          created_at: string;
          description: string;
          gold_delta: number;
          id: string;
          kind: string;
          user_id: string;
          xp_delta: number;
        };
        Insert: {
          created_at?: string;
          description?: string;
          gold_delta?: number;
          id?: string;
          kind: string;
          user_id: string;
          xp_delta?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          gold_delta?: number;
          id?: string;
          kind?: string;
          user_id?: string;
          xp_delta?: number;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          code: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          code: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey";
            columns: ["code"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_achievements: { Args: { p_user: string }; Returns: Json };
      accept_rescope: {
        Args: { p_suggestion_id: string; p_plan?: Json };
        Returns: Json;
      };
      complete_onboarding: {
        Args: { p_profile: Json; p_activities: Json; p_quests: Json };
        Returns: Json;
      };
      complete_quest: {
        Args: { p_quest_id: string; p_actual_duration_min?: number | null };
        Returns: Json;
      };
      dismiss_rescope: { Args: { p_suggestion_id: string }; Returns: Json };
      grant_rewards: {
        Args: {
          p_desc: string;
          p_gold: number;
          p_kind: string;
          p_user: string;
          p_xp: number;
        };
        Returns: undefined;
      };
      level_for_xp: { Args: { p_xp: number }; Returns: number };
      purchase_item: { Args: { p_item_code: string }; Returns: Json };
      title_for_level: { Args: { p_level: number }; Returns: string };
      username_available: { Args: { p_username: string }; Returns: boolean };
      use_item: { Args: { p_item_code: string }; Returns: Json };
      user_today: { Args: { p_user: string }; Returns: string };
      xp_for_level: { Args: { p_level: number }; Returns: number };
    };
    Enums: {
      quest_difficulty: "easy" | "medium" | "hard" | "epic";
      quest_status: "pending" | "completed" | "skipped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      quest_difficulty: ["easy", "medium", "hard", "epic"],
      quest_status: ["pending", "completed", "skipped"],
    },
  },
} as const;
