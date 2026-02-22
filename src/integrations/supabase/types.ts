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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          cloudwatch_alarm_name: string | null
          comparison_operator: string
          created_at: string
          deleted_at: string | null
          duration: number
          enabled: boolean
          id: string
          metric: string
          name: string
          severity: Database["public"]["Enums"]["severity_level"]
          threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cloudwatch_alarm_name?: string | null
          comparison_operator?: string
          created_at?: string
          deleted_at?: string | null
          duration?: number
          enabled?: boolean
          id?: string
          metric: string
          name: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threshold: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cloudwatch_alarm_name?: string | null
          comparison_operator?: string
          created_at?: string
          deleted_at?: string | null
          duration?: number
          enabled?: boolean
          id?: string
          metric?: string
          name?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aws_configurations: {
        Row: {
          alert_thresholds: Json | null
          aws_region: string
          configuration_name: string
          created_at: string
          id: string
          is_active: boolean | null
          projects: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_thresholds?: Json | null
          aws_region?: string
          configuration_name?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          projects?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_thresholds?: Json | null
          aws_region?: string
          configuration_name?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          projects?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cloudhub_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_session_duration_seconds: number
          role_arn: string
          role_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_session_duration_seconds?: number
          role_arn: string
          role_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_session_duration_seconds?: number
          role_arn?: string
          role_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compliance_remediation_log: {
        Row: {
          compliance_check_id: string
          created_at: string
          details: Json | null
          id: string
          remediation_type: string
          status: Database["public"]["Enums"]["remediation_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          compliance_check_id: string
          created_at?: string
          details?: Json | null
          id?: string
          remediation_type: string
          status: Database["public"]["Enums"]["remediation_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          compliance_check_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          remediation_type?: string
          status?: Database["public"]["Enums"]["remediation_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cost_data_cache: {
        Row: {
          anomalies: Json | null
          aws_region: string
          cached_at: string | null
          created_at: string | null
          expires_at: string | null
          historical_costs: Json | null
          historical_expires_at: string | null
          id: string
          service_breakdown: Json | null
          total_cost: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anomalies?: Json | null
          aws_region?: string
          cached_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          historical_costs?: Json | null
          historical_expires_at?: string | null
          id?: string
          service_breakdown?: Json | null
          total_cost?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anomalies?: Json | null
          aws_region?: string
          cached_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          historical_costs?: Json | null
          historical_expires_at?: string | null
          id?: string
          service_breakdown?: Json | null
          total_cost?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      drift_events: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          changes: Json
          current_hash: string
          deleted_at: string | null
          detected_at: string
          id: string
          previous_hash: string
          resource_id: string
          resource_name: string | null
          resource_type: string
          severity: Database["public"]["Enums"]["severity_level"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          changes: Json
          current_hash: string
          deleted_at?: string | null
          detected_at?: string
          id?: string
          previous_hash: string
          resource_id: string
          resource_name?: string | null
          resource_type: string
          severity?: Database["public"]["Enums"]["severity_level"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          changes?: Json
          current_hash?: string
          deleted_at?: string | null
          detected_at?: string
          id?: string
          previous_hash?: string
          resource_id?: string
          resource_name?: string | null
          resource_type?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monitoring_data_cache: {
        Row: {
          cached_at: string | null
          cpu_metrics: Json | null
          created_at: string | null
          disk_read_metrics: Json | null
          disk_write_metrics: Json | null
          expires_at: string | null
          id: string
          network_in_metrics: Json | null
          network_out_metrics: Json | null
          status_check_metrics: Json | null
          time_range: Database["public"]["Enums"]["monitoring_time_range"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cached_at?: string | null
          cpu_metrics?: Json | null
          created_at?: string | null
          disk_read_metrics?: Json | null
          disk_write_metrics?: Json | null
          expires_at?: string | null
          id?: string
          network_in_metrics?: Json | null
          network_out_metrics?: Json | null
          status_check_metrics?: Json | null
          time_range?: Database["public"]["Enums"]["monitoring_time_range"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cached_at?: string | null
          cpu_metrics?: Json | null
          created_at?: string | null
          disk_read_metrics?: Json | null
          disk_write_metrics?: Json | null
          expires_at?: string | null
          id?: string
          network_in_metrics?: Json | null
          network_out_metrics?: Json | null
          status_check_metrics?: Json | null
          time_range?: Database["public"]["Enums"]["monitoring_time_range"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          cost_explorer_enabled: boolean | null
          cost_explorer_last_charged_at: string | null
          created_at: string
          drift_scan_enabled: boolean | null
          drift_scan_frequency:
            | Database["public"]["Enums"]["drift_scan_frequency_enum"]
            | null
          drift_scan_last_run: string | null
          email_enabled: boolean | null
          encrypted_discord_webhook: string | null
          encrypted_slack_webhook: string | null
          encrypted_webhook_url: string | null
          id: string
          notify_on_approval_needed: boolean | null
          notify_on_compliance_issue: boolean | null
          notify_on_drift: boolean | null
          notify_on_security_alert: boolean | null
          ses_sender_email: string | null
          updated_at: string
          user_id: string
          webhook_nonce: string | null
        }
        Insert: {
          cost_explorer_enabled?: boolean | null
          cost_explorer_last_charged_at?: string | null
          created_at?: string
          drift_scan_enabled?: boolean | null
          drift_scan_frequency?:
            | Database["public"]["Enums"]["drift_scan_frequency_enum"]
            | null
          drift_scan_last_run?: string | null
          email_enabled?: boolean | null
          encrypted_discord_webhook?: string | null
          encrypted_slack_webhook?: string | null
          encrypted_webhook_url?: string | null
          id?: string
          notify_on_approval_needed?: boolean | null
          notify_on_compliance_issue?: boolean | null
          notify_on_drift?: boolean | null
          notify_on_security_alert?: boolean | null
          ses_sender_email?: string | null
          updated_at?: string
          user_id: string
          webhook_nonce?: string | null
        }
        Update: {
          cost_explorer_enabled?: boolean | null
          cost_explorer_last_charged_at?: string | null
          created_at?: string
          drift_scan_enabled?: boolean | null
          drift_scan_frequency?:
            | Database["public"]["Enums"]["drift_scan_frequency_enum"]
            | null
          drift_scan_last_run?: string | null
          email_enabled?: boolean | null
          encrypted_discord_webhook?: string | null
          encrypted_slack_webhook?: string | null
          encrypted_webhook_url?: string | null
          id?: string
          notify_on_approval_needed?: boolean | null
          notify_on_compliance_issue?: boolean | null
          notify_on_drift?: boolean | null
          notify_on_security_alert?: boolean | null
          ses_sender_email?: string | null
          updated_at?: string
          user_id?: string
          webhook_nonce?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aws_default_region: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          project_tags: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aws_default_region?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          project_tags?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aws_default_region?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          project_tags?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_snapshots: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          resource_arn: string | null
          resource_id: string
          resource_type: string
          snapshot_hash: string
          source: string
          user_id: string
        }
        Insert: {
          configuration: Json
          created_at?: string
          id?: string
          resource_arn?: string | null
          resource_id: string
          resource_type: string
          snapshot_hash: string
          source?: string
          user_id: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          resource_arn?: string | null
          resource_id?: string
          resource_type?: string
          snapshot_hash?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      security_change_approvals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_details: Json
          change_type: Database["public"]["Enums"]["security_change_type"]
          created_at: string
          deleted_at: string | null
          executed_at: string | null
          execution_result: Json | null
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_details: Json
          change_type: Database["public"]["Enums"]["security_change_type"]
          created_at?: string
          deleted_at?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_details?: Json
          change_type?: Database["public"]["Enums"]["security_change_type"]
          created_at?: string
          deleted_at?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_dashboard_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_aws_credentials: {
        Row: {
          created_at: string | null
          encrypted_access_key: string | null
          encrypted_secret_key: string | null
          id: string
          is_active: boolean | null
          key_nonce: string | null
          region: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_access_key?: string | null
          encrypted_secret_key?: string | null
          id?: string
          is_active?: boolean | null
          key_nonce?: string | null
          region?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_access_key?: string | null
          encrypted_secret_key?: string | null
          id?: string
          is_active?: boolean | null
          key_nonce?: string | null
          region?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_setup: {
        Row: {
          aws_connected: boolean | null
          aws_setup_completed: boolean | null
          created_at: string
          id: string
          initial_configuration_completed: boolean | null
          onboarding_completed: boolean | null
          profile_completed: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aws_connected?: boolean | null
          aws_setup_completed?: boolean | null
          created_at?: string
          id?: string
          initial_configuration_completed?: boolean | null
          onboarding_completed?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aws_connected?: boolean | null
          aws_setup_completed?: boolean | null
          created_at?: string
          id?: string
          initial_configuration_completed?: boolean | null
          onboarding_completed?: boolean | null
          profile_completed?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_records: {
        Args: { retention_days?: number }
        Returns: {
          deleted_compliance_logs: number
          deleted_drift_events: number
          deleted_resource_snapshots: number
        }[]
      }
      decrypt_secret: {
        Args: { encrypted_data: string; nonce: string }
        Returns: string
      }
      encrypt_secret: { Args: { secret: string }; Returns: string }
      get_user_aws_credentials: {
        Args: { user_id_param: string }
        Returns: {
          access_key_id: string
          region: string
          secret_access_key: string
        }[]
      }
    }
    Enums: {
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "executed"
        | "failed"
      drift_scan_frequency_enum: "daily" | "weekly" | "monthly"
      monitoring_time_range: "1h" | "6h" | "24h" | "7d"
      remediation_status: "pending" | "success" | "failed"
      security_change_type:
        | "security_group_rule"
        | "iam_user_create"
        | "iam_user_delete"
        | "iam_key_rotation"
        | "compliance_remediation"
      severity_level: "info" | "warning" | "critical"
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
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "executed",
        "failed",
      ],
      drift_scan_frequency_enum: ["daily", "weekly", "monthly"],
      monitoring_time_range: ["1h", "6h", "24h", "7d"],
      remediation_status: ["pending", "success", "failed"],
      security_change_type: [
        "security_group_rule",
        "iam_user_create",
        "iam_user_delete",
        "iam_key_rotation",
        "compliance_remediation",
      ],
      severity_level: ["info", "warning", "critical"],
    },
  },
} as const
