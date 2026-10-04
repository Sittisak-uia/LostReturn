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
      admin_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          sender_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_type?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          room_id: string
          sender_id: string
          is_read: boolean
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          room_id: string
          sender_id: string
          is_read?: boolean
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          room_id?: string
          sender_id?: string
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          claimer_id: string
          created_at: string
          depositor_id: string
          id: string
          locker_id: number
          transaction_id: string
        }
        Insert: {
          claimer_id: string
          created_at?: string
          depositor_id: string
          id?: string
          locker_id: number
          transaction_id: string
        }
        Update: {
          claimer_id?: string
          created_at?: string
          depositor_id?: string
          id?: string
          locker_id?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "locker_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "locker_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          door_state: string | null
          has_item: boolean | null
          id: number
          solenoid: string | null
          updated_at: string
        }
        Insert: {
          door_state?: string | null
          has_item?: boolean | null
          id: number
          solenoid?: string | null
          updated_at?: string
        }
        Update: {
          door_state?: string | null
          has_item?: boolean | null
          id?: number
          solenoid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      locker_transactions: {
        Row: {
          collected_at: string | null
          collector_contact: string | null
          collector_name: string | null
          collector_user_id: string | null
          created_at: string
          deposited_at: string
          depositor_contact: string
          depositor_name: string
          id: string
          image_url: string | null
          item_description: string
          locker_id: number
          otp: string | null
          otp_generated_at: string | null
          security_answer: string | null
          security_question: string | null
          status: string
          user_id: string | null
          locked_by: string | null
          locked_until: string | null
          lock_reason: string | null
        }
        Insert: {
          collected_at?: string | null
          collector_contact?: string | null
          collector_name?: string | null
          collector_user_id?: string | null
          created_at?: string
          deposited_at?: string
          depositor_contact: string
          depositor_name: string
          id?: string
          image_url?: string | null
          item_description: string
          locker_id: number
          otp?: string | null
          otp_generated_at?: string | null
          security_answer?: string | null
          security_question?: string | null
          status?: string
          user_id?: string | null
          locked_by?: string | null
          locked_until?: string | null
          lock_reason?: string | null
        }
        Update: {
          collected_at?: string | null
          collector_contact?: string | null
          collector_name?: string | null
          collector_user_id?: string | null
          created_at?: string
          deposited_at?: string
          depositor_contact?: string
          depositor_name?: string
          id?: string
          image_url?: string | null
          item_description?: string
          locker_id?: number
          otp?: string | null
          otp_generated_at?: string | null
          security_answer?: string | null
          security_question?: string | null
          status?: string
          user_id?: string | null
          locked_by?: string | null
          locked_until?: string | null
          lock_reason?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          comments_count: number | null
          contact_info: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number | null
          location: string | null
          locker_number: number | null
          post_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          contact_info?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          location?: string | null
          locker_number?: number | null
          post_type: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number | null
          contact_info?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          location?: string | null
          locker_number?: number | null
          post_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          national_id: string | null
          phone: string | null
          student_id: string | null
          updated_at: string
          user_id: string
          user_type: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          national_id?: string | null
          phone?: string | null
          student_id?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          national_id?: string | null
          phone?: string | null
          student_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      locker_availability: {
        Row: {
          deposited_at: string | null
          id: string | null
          image_url: string | null
          item_description: string | null
          locker_id: number | null
          status: string | null
        }
        Insert: {
          deposited_at?: string | null
          id?: string | null
          image_url?: string | null
          item_description?: string | null
          locker_id?: number | null
          status?: string | null
        }
        Update: {
          deposited_at?: string | null
          id?: string | null
          image_url?: string | null
          item_description?: string | null
          locker_id?: number | null
          status?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          phone?: never
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_transaction_collected: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
