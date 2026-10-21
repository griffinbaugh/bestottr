export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      listing_assets: {
        Row: import("@/lib/listing-assets").ListingAsset;
        Insert: Omit<
          import("@/lib/listing-assets").ListingAsset,
          "id" | "created_at" | "status" | "position"
        > & { id?: string; created_at?: string; status?: "pending" | "ready"; position?: number };
        Update: Partial<import("@/lib/listing-assets").ListingAsset>;
        Relationships: [];
      };
      listing_drafts: {
        Row: import("@/lib/listing-drafts").ListingDraft;
        Insert: Omit<
          import("@/lib/listing-drafts").ListingDraft,
          "id" | "created_at" | "updated_at" | "cover_asset_id" | "auction_ends_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          cover_asset_id?: string | null;
          auction_ends_at?: number | null;
        };
        Update: Partial<import("@/lib/listing-drafts").ListingDraft>;
        Relationships: [];
      };
      account_preferences: {
        Row: {
          currency: string;
          email_bids: boolean;
          email_listings: boolean;
          email_news: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          currency?: string;
          email_bids?: boolean;
          email_listings?: boolean;
          email_news?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          currency?: string;
          email_bids?: boolean;
          email_listings?: boolean;
          email_news?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          bio: string;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          bio?: string;
          created_at?: string;
          display_name: string;
          handle: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          bio?: string;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roblox_accounts: {
        Row: {
          display_name: string;
          roblox_user_id: string;
          user_id: string;
          username: string;
          verified_at: string;
        };
        Insert: {
          display_name: string;
          roblox_user_id: string;
          user_id: string;
          username: string;
          verified_at?: string;
        };
        Update: {
          display_name?: string;
          roblox_user_id?: string;
          user_id?: string;
          username?: string;
          verified_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          admin_notes: string | null;
          contact_email: string;
          created_at: string;
          custom_topic: string | null;
          description: string;
          id: string;
          phone: string | null;
          priority: string;
          relevant_url: string | null;
          status: string;
          subject_category: string;
          ticket_number: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          contact_email: string;
          created_at?: string;
          custom_topic?: string | null;
          description: string;
          id?: string;
          phone?: string | null;
          priority?: string;
          relevant_url?: string | null;
          status?: string;
          subject_category: string;
          ticket_number: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          contact_email?: string;
          created_at?: string;
          custom_topic?: string | null;
          description?: string;
          id?: string;
          phone?: string | null;
          priority?: string;
          relevant_url?: string | null;
          status?: string;
          subject_category?: string;
          ticket_number?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      reserve_listing_asset: {
        Args: {
          p_seller: string;
          p_draft: string;
          p_category: string;
          p_filename: string;
          p_content_type: string;
          p_size: number;
        };
        Returns: import("@/lib/listing-assets").ListingAsset;
      };
      move_listing_image: {
        Args: { p_seller: string; p_asset: string; p_direction: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      submit_support_ticket: {
        Args: {
          _category: string;
          _custom_topic: string;
          _description: string;
          _email: string;
          _phone: string;
          _url: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
