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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounts_receivable: {
        Row: {
          amount: number
          amount_paid: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_entry_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          description: string
          due_date: string
          financial_movement_id: string | null
          id: string
          installment_number: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment_origin: string
          professional_id: string | null
          sale_id: string | null
          source_type: string
          status: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          description?: string
          due_date: string
          financial_movement_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_origin?: string
          professional_id?: string | null
          sale_id?: string | null
          source_type?: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          description?: string
          due_date?: string
          financial_movement_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_origin?: string
          professional_id?: string | null
          sale_id?: string | null
          source_type?: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_payments: {
        Row: {
          amount: number
          cash_entry_id: string | null
          created_at: string
          created_by: string | null
          financial_movement_id: string | null
          id: string
          notes: string | null
          paid_at: string
          payment_method: string
          receivable_id: string
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
        }
        Insert: {
          amount: number
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method: string
          receivable_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cash_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          paid_at?: string
          payment_method?: string
          receivable_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_reversed_by_fkey"
            columns: ["reversed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_settings: {
        Row: {
          allow_overbooking: boolean
          closing_time: string
          created_at: string | null
          default_view: string
          id: string
          opening_time: string
          slot_interval_minutes: number
          timezone: string
          updated_at: string | null
        }
        Insert: {
          allow_overbooking?: boolean
          closing_time?: string
          created_at?: string | null
          default_view?: string
          id?: string
          opening_time?: string
          slot_interval_minutes?: number
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          allow_overbooking?: boolean
          closing_time?: string
          created_at?: string | null
          default_view?: string
          id?: string
          opening_time?: string
          slot_interval_minutes?: number
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_action_logs: {
        Row: {
          action_type: string
          after_data: Json | null
          ai_command_id: string | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          message: string | null
          status: string
        }
        Insert: {
          action_type: string
          after_data?: Json | null
          ai_command_id?: string | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          message?: string | null
          status: string
        }
        Update: {
          action_type?: string
          after_data?: Json | null
          ai_command_id?: string | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_logs_ai_command_id_fkey"
            columns: ["ai_command_id"]
            isOneToOne: false
            referencedRelation: "ai_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_commands: {
        Row: {
          command_text: string
          created_at: string
          executed_at: string | null
          executed_by: string | null
          id: string
          intent: string
          parsed_payload: Json
          requested_by: string | null
          status: string
        }
        Insert: {
          command_text: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          intent: string
          parsed_payload: Json
          requested_by?: string | null
          status: string
        }
        Update: {
          command_text?: string
          created_at?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          intent?: string
          parsed_payload?: Json
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_commands_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_commands_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          ai_enabled: boolean
          created_at: string
          critical_stock_alert_enabled: boolean
          currency: string
          default_markup: number
          id: string
          low_stock_alert_enabled: boolean
          organization_name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          created_at?: string
          critical_stock_alert_enabled?: boolean
          currency?: string
          default_markup?: number
          id?: string
          low_stock_alert_enabled?: boolean
          organization_name?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          created_at?: string
          critical_stock_alert_enabled?: boolean
          currency?: string
          default_markup?: number
          id?: string
          low_stock_alert_enabled?: boolean
          organization_name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_blocks: {
        Row: {
          block_type: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          end_at: string
          id: string
          is_active: boolean
          professional_id: string
          reason: string | null
          start_at: string
          updated_at: string | null
        }
        Insert: {
          block_type?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at: string
          id?: string
          is_active?: boolean
          professional_id: string
          reason?: string | null
          start_at: string
          updated_at?: string | null
        }
        Update: {
          block_type?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at?: string
          id?: string
          is_active?: boolean
          professional_id?: string
          reason?: string | null
          start_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_command_items: {
        Row: {
          appointment_id: string
          created_at: string | null
          description_snapshot: string
          id: string
          item_type: string
          product_id: string | null
          professional_id: string | null
          quantity: number
          service_id: string | null
          total_price_snapshot: number | null
          unit_price_snapshot: number
          updated_at: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          description_snapshot: string
          id?: string
          item_type: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          total_price_snapshot?: number | null
          unit_price_snapshot?: number
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          description_snapshot?: string
          id?: string
          item_type?: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          service_id?: string | null
          total_price_snapshot?: number | null
          unit_price_snapshot?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_command_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_command_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_command_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "appointment_command_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_command_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_waitlist: {
        Row: {
          converted_appointment_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          desired_date: string | null
          desired_professional_id: string | null
          desired_service_id: string | null
          id: string
          notes: string | null
          preferred_period: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          converted_appointment_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          desired_date?: string | null
          desired_professional_id?: string | null
          desired_service_id?: string | null
          id?: string
          notes?: string | null
          preferred_period?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          converted_appointment_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          desired_date?: string | null
          desired_professional_id?: string | null
          desired_service_id?: string | null
          id?: string
          notes?: string | null
          preferred_period?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_waitlist_converted_appointment_id_fkey"
            columns: ["converted_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_desired_professional_id_fkey"
            columns: ["desired_professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_desired_service_id_fkey"
            columns: ["desired_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          end_at: string
          id: string
          is_subscription: boolean
          linked_sale_id: string | null
          notes: string | null
          professional_id: string
          recurrence_rule: Json | null
          service_duration_minutes_snapshot: number | null
          service_id: string | null
          service_name_snapshot: string | null
          service_price_snapshot: number | null
          source: string
          start_at: string
          status: string
          subscription_id: string | null
          subscription_occurrence_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          end_at: string
          id?: string
          is_subscription?: boolean
          linked_sale_id?: string | null
          notes?: string | null
          professional_id: string
          recurrence_rule?: Json | null
          service_duration_minutes_snapshot?: number | null
          service_id?: string | null
          service_name_snapshot?: string | null
          service_price_snapshot?: number | null
          source?: string
          start_at: string
          status?: string
          subscription_id?: string | null
          subscription_occurrence_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          end_at?: string
          id?: string
          is_subscription?: boolean
          linked_sale_id?: string | null
          notes?: string | null
          professional_id?: string
          recurrence_rule?: Json | null
          service_duration_minutes_snapshot?: number | null
          service_id?: string | null
          service_name_snapshot?: string | null
          service_price_snapshot?: number | null
          source?: string
          start_at?: string
          status?: string
          subscription_id?: string | null
          subscription_occurrence_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_occurrence_id_fkey"
            columns: ["subscription_occurrence_id"]
            isOneToOne: false
            referencedRelation: "subscription_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          performed_at: string | null
          performed_by: string | null
          performed_by_ai: boolean | null
          record_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          performed_by_ai?: boolean | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          performed_by_ai?: boolean | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          context: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          context?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          context?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_entries: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_session_id: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          entry_type: string
          id: string
          occurred_at: string
          payment_method_id: string | null
          reference_id: string | null
          reference_type: string | null
          reversal_of_entry_id: string | null
          reversed_by_entry_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id: string
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          entry_type: string
          id?: string
          occurred_at?: string
          payment_method_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_entry_id?: string | null
          reversed_by_entry_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_type?: string
          id?: string
          occurred_at?: string
          payment_method_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_entry_id?: string | null
          reversed_by_entry_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_entries_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "vw_daily_cash_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "cash_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_reversal_of_entry_id_fkey"
            columns: ["reversal_of_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_entries_reversed_by_entry_id_fkey"
            columns: ["reversed_by_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string | null
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_balance: number | null
          status: string | null
          total_expenses: number | null
          total_receipts: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number | null
          status?: string | null
          total_expenses?: number | null
          total_receipts?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_balance?: number | null
          status?: string | null
          total_expenses?: number | null
          total_receipts?: number | null
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference_amount: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_amount: number
          session_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference_amount?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          session_date?: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference_amount?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          session_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          id: string
          payment_method: string | null
          reference_id: string | null
          register_id: string
          type: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          register_id: string
          type: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          register_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          created_at: string
          default_commission_percent: number | null
          display_name: string | null
          id: string
          is_active: boolean
          name: string
          role: string
          settlement_primary_day: number | null
          settlement_secondary_day: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_commission_percent?: number | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          role: string
          settlement_primary_day?: number | null
          settlement_secondary_day?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_commission_percent?: number | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          settlement_primary_day?: number | null
          settlement_secondary_day?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_entries: {
        Row: {
          base_amount: number
          collaborator_id: string
          commission_amount: number
          commission_rule_id: string | null
          competence_date: string
          created_at: string
          id: string
          sale_id: string
          sale_item_id: string | null
          status: string
        }
        Insert: {
          base_amount: number
          collaborator_id: string
          commission_amount: number
          commission_rule_id?: string | null
          competence_date: string
          created_at?: string
          id?: string
          sale_id: string
          sale_item_id?: string | null
          status?: string
        }
        Update: {
          base_amount?: number
          collaborator_id?: string
          commission_amount?: number
          commission_rule_id?: string | null
          competence_date?: string
          created_at?: string
          id?: string
          sale_id?: string
          sale_item_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          total_base: number
          total_commission: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          total_base?: number
          total_commission?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          total_base?: number
          total_commission?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          applies_to: string
          category_id: string | null
          collaborator_id: string | null
          created_at: string
          fixed_amount: number | null
          id: string
          is_active: boolean
          percent: number | null
          priority: number
          product_id: string | null
          profile_id: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          applies_to: string
          category_id?: string | null
          collaborator_id?: string | null
          created_at?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          percent?: number | null
          priority?: number
          product_id?: string | null
          profile_id: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          category_id?: string | null
          collaborator_id?: string | null
          created_at?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          percent?: number | null
          priority?: number
          product_id?: string | null
          profile_id?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "commission_rules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "commission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          deleted_at: string | null
          due_day: number | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          recurrence: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_day?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          recurrence?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          due_day?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          recurrence?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_subscriptions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activated_manually: boolean
          billing_day: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          checkout_mode: string
          created_at: string
          created_by: string | null
          current_period_end: string | null
          current_period_start: string | null
          custom_plan_name: string | null
          custom_services_snapshot: Json | null
          customer_id: string
          duration_minutes_snapshot: number | null
          ends_at: string | null
          fixed_time: string
          fixed_weekday: number
          id: string
          is_customized: boolean | null
          metadata: Json | null
          monthly_price_snapshot: number | null
          notes: string | null
          payment_method: string | null
          payment_provider: string
          plan_id: string
          preferred_professional_id: string | null
          provider_checkout_id: string | null
          provider_checkout_url: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          recurring_authorization_accepted_at: string | null
          source: string
          starts_at: string | null
          status: string
          subscriber_discount_percent: number
          terms_accepted_at: string | null
          updated_at: string
          visits_per_cycle_snapshot: number | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activated_manually?: boolean
          billing_day?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_mode?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          custom_plan_name?: string | null
          custom_services_snapshot?: Json | null
          customer_id: string
          duration_minutes_snapshot?: number | null
          ends_at?: string | null
          fixed_time: string
          fixed_weekday: number
          id?: string
          is_customized?: boolean | null
          metadata?: Json | null
          monthly_price_snapshot?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_provider?: string
          plan_id: string
          preferred_professional_id?: string | null
          provider_checkout_id?: string | null
          provider_checkout_url?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          recurring_authorization_accepted_at?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          subscriber_discount_percent?: number
          terms_accepted_at?: string | null
          updated_at?: string
          visits_per_cycle_snapshot?: number | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activated_manually?: boolean
          billing_day?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checkout_mode?: string
          created_at?: string
          created_by?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          custom_plan_name?: string | null
          custom_services_snapshot?: Json | null
          customer_id?: string
          duration_minutes_snapshot?: number | null
          ends_at?: string | null
          fixed_time?: string
          fixed_weekday?: number
          id?: string
          is_customized?: boolean | null
          metadata?: Json | null
          monthly_price_snapshot?: number | null
          notes?: string | null
          payment_method?: string | null
          payment_provider?: string
          plan_id?: string
          preferred_professional_id?: string | null
          provider_checkout_id?: string | null
          provider_checkout_url?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          recurring_authorization_accepted_at?: string | null
          source?: string
          starts_at?: string | null
          status?: string
          subscriber_discount_percent?: number
          terms_accepted_at?: string | null
          updated_at?: string
          visits_per_cycle_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscriptions_activated_by_fkey"
            columns: ["activated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line: string | null
          address_number: string | null
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          days_since_last_visit: number | null
          ddi: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          legacy_created_at: string | null
          legacy_last_visit_at: string | null
          legacy_login: string | null
          loyalty_points: number | null
          mobile_phone: string | null
          neighborhood: string | null
          normalized_name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          referral_source: string | null
          rg: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          address_number?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          days_since_last_visit?: number | null
          ddi?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          legacy_created_at?: string | null
          legacy_last_visit_at?: string | null
          legacy_login?: string | null
          loyalty_points?: number | null
          mobile_phone?: string | null
          neighborhood?: string | null
          normalized_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          referral_source?: string | null
          rg?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          address_number?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          days_since_last_visit?: number | null
          ddi?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          legacy_created_at?: string | null
          legacy_last_visit_at?: string | null
          legacy_login?: string | null
          loyalty_points?: number | null
          mobile_phone?: string | null
          neighborhood?: string | null
          normalized_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          referral_source?: string | null
          rg?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          export_type: string
          file_url: string | null
          filters: Json | null
          id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          export_type: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          export_type?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          movement_type: string
          occurred_on: string
          origin_id: string | null
          origin_type: string
          subcategory: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description: string
          id?: string
          movement_type: string
          occurred_on: string
          origin_id?: string | null
          origin_type: string
          subcategory?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          movement_type?: string
          occurred_on?: string
          origin_id?: string | null
          origin_type?: string
          subcategory?: string | null
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          due_day: number | null
          frequency: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          due_day?: number | null
          frequency: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          due_day?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gamification_feature_flags: {
        Row: {
          description: string | null
          flag_key: string
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          flag_key: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          flag_key?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_goals: {
        Row: {
          collaborator_id: string
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          reward_description: string | null
          reward_points: number
          status: string
          target_appointments: number
          target_average_ticket: number | null
          target_revenue: number
          target_services: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          reward_description?: string | null
          reward_points?: number
          status?: string
          target_appointments?: number
          target_average_ticket?: number | null
          target_revenue?: number
          target_services?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          reward_description?: string | null
          reward_points?: number
          status?: string
          target_appointments?: number
          target_average_ticket?: number | null
          target_revenue?: number
          target_services?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_goals_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_goals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_notification_logs: {
        Row: {
          collaborator_id: string
          goal_id: string
          id: string
          metadata: Json
          notification_type: string
          sent_at: string
          threshold: string
        }
        Insert: {
          collaborator_id: string
          goal_id: string
          id?: string
          metadata?: Json
          notification_type: string
          sent_at?: string
          threshold: string
        }
        Update: {
          collaborator_id?: string
          goal_id?: string
          id?: string
          metadata?: Json
          notification_type?: string
          sent_at?: string
          threshold?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_notification_logs_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_notification_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "gamification_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_period_results: {
        Row: {
          approval_reason: string | null
          approved_bonus_amount: number | null
          assignment_id: string | null
          closing_day: number
          collaborator_id: string
          created_at: string
          cycle_label: string
          id: string
          is_dirty: boolean
          metrics_snapshot: Json
          payout_reference_id: string | null
          period_end: string
          period_end_exclusive: string
          period_key: string
          period_start: string
          projected_bonus_amount: number
          revenue_tier: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          rule_set_id: string
          rules_snapshot: Json
          score: number
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approved_bonus_amount?: number | null
          assignment_id?: string | null
          closing_day: number
          collaborator_id: string
          created_at?: string
          cycle_label: string
          id?: string
          is_dirty?: boolean
          metrics_snapshot?: Json
          payout_reference_id?: string | null
          period_end: string
          period_end_exclusive: string
          period_key: string
          period_start: string
          projected_bonus_amount?: number
          revenue_tier?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_set_id: string
          rules_snapshot?: Json
          score?: number
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approved_bonus_amount?: number | null
          assignment_id?: string | null
          closing_day?: number
          collaborator_id?: string
          created_at?: string
          cycle_label?: string
          id?: string
          is_dirty?: boolean
          metrics_snapshot?: Json
          payout_reference_id?: string | null
          period_end?: string
          period_end_exclusive?: string
          period_key?: string
          period_start?: string
          projected_bonus_amount?: number
          revenue_tier?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_set_id?: string
          rules_snapshot?: Json
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_period_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "gamification_professional_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_period_results_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_period_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_period_results_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "gamification_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_points_ledger: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          collaborator_id: string
          goal_id: string | null
          id: string
          metadata: Json
          points: number
          reason: string
          source: string
          status: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          collaborator_id: string
          goal_id?: string | null
          id?: string
          metadata?: Json
          points: number
          reason: string
          source: string
          status?: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          collaborator_id?: string
          goal_id?: string | null
          id?: string
          metadata?: Json
          points?: number
          reason?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_points_ledger_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_points_ledger_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_points_ledger_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "gamification_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_professional_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          collaborator_id: string
          id: string
          overrides: Json
          rule_set_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          collaborator_id: string
          id?: string
          overrides?: Json
          rule_set_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          collaborator_id?: string
          id?: string
          overrides?: Json
          rule_set_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_professional_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_professional_assignments_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_professional_assignments_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "gamification_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_recompute_queue: {
        Row: {
          attempt_count: number
          collaborator_id: string
          created_at: string
          id: string
          last_error: string | null
          lock_token: string | null
          locked_at: string | null
          period_key: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          collaborator_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          period_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          collaborator_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lock_token?: string | null
          locked_at?: string | null
          period_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_recompute_queue_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_reward_applications: {
        Row: {
          amount: number
          applied_at: string | null
          applied_by: string | null
          collaborator_id: string
          created_at: string
          id: string
          notes: string | null
          period_result_id: string
          professional_closure_id: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          applied_at?: string | null
          applied_by?: string | null
          collaborator_id: string
          created_at?: string
          id?: string
          notes?: string | null
          period_result_id: string
          professional_closure_id?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          applied_at?: string | null
          applied_by?: string | null
          collaborator_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_result_id?: string
          professional_closure_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_reward_applications_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_reward_applications_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_reward_applications_period_result_id_fkey"
            columns: ["period_result_id"]
            isOneToOne: false
            referencedRelation: "gamification_period_results"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_rule_sets: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          effective_from: string
          effective_until: string | null
          id: string
          is_pilot: boolean
          name: string
          period_type: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from: string
          effective_until?: string | null
          id?: string
          is_pilot?: boolean
          name: string
          period_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          is_pilot?: boolean
          name?: string
          period_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "gamification_rule_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_rule_sets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_rows: number
          file_name: string
          id: string
          mapping: Json | null
          source_type: string
          status: string
          success_rows: number
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_rows?: number
          file_name: string
          id?: string
          mapping?: Json | null
          source_type: string
          status: string
          success_rows?: number
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_rows?: number
          file_name?: string
          id?: string
          mapping?: Json | null
          source_type?: string
          status?: string
          success_rows?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          import_job_id: string
          normalized_payload: Json | null
          raw_payload: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_job_id: string
          normalized_payload?: Json | null
          raw_payload: Json
          row_number: number
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          import_job_id?: string
          normalized_payload?: Json | null
          raw_payload?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          aliases: Json | null
          code_prefix: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          aliases?: Json | null
          code_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          aliases?: Json | null
          code_prefix?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_locations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_product_deletion_snapshots: {
        Row: {
          created_at: string
          deleted_at: string
          deleted_by: string | null
          deletion_mode: string
          dependency_summary: Json
          id: string
          original_product_id: string
          product_snapshot: Json
          reason: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          deletion_mode: string
          dependency_summary: Json
          id?: string
          original_product_id: string
          product_snapshot: Json
          reason?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string
          deleted_by?: string | null
          deletion_mode?: string
          dependency_summary?: Json
          id?: string
          original_product_id?: string
          product_snapshot?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_deletion_snapshots_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          cost_price: number
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_snapshot_id: string | null
          deletion_mode: string | null
          deletion_reason: string | null
          external_code: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          is_for_internal_use: boolean
          is_for_resale: boolean
          markup_percent: number
          markup_value_generated: number | null
          max_stock: number
          min_stock: number
          name: string
          normalized_name: string
          notes: string | null
          reorder_point: number | null
          sale_price_cash: number | null
          sale_price_generated: number | null
          sale_price_installment: number | null
          sku: string | null
          unit_type: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_snapshot_id?: string | null
          deletion_mode?: string | null
          deletion_reason?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_for_internal_use?: boolean
          is_for_resale?: boolean
          markup_percent?: number
          markup_value_generated?: number | null
          max_stock?: number
          min_stock?: number
          name: string
          normalized_name: string
          notes?: string | null
          reorder_point?: number | null
          sale_price_cash?: number | null
          sale_price_generated?: number | null
          sale_price_installment?: number | null
          sku?: string | null
          unit_type?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_snapshot_id?: string | null
          deletion_mode?: string | null
          deletion_reason?: string | null
          external_code?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_for_internal_use?: boolean
          is_for_resale?: boolean
          markup_percent?: number
          markup_value_generated?: number | null
          max_stock?: number
          min_stock?: number
          name?: string
          normalized_name?: string
          notes?: string | null
          reorder_point?: number | null
          sale_price_cash?: number | null
          sale_price_generated?: number | null
          sale_price_installment?: number | null
          sku?: string | null
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_products_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_products_deleted_snapshot_id_fkey"
            columns: ["deleted_snapshot_id"]
            isOneToOne: false
            referencedRelation: "inventory_product_deletion_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_logs: {
        Row: {
          collaborator_id: string | null
          created_at: string
          error_message: string | null
          id: string
          notification_event_id: string
          provider: string
          provider_message_id: string | null
          push_subscription_id: string
          sent_at: string | null
          status: string
          target_role: string | null
          user_profile_id: string | null
        }
        Insert: {
          collaborator_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notification_event_id: string
          provider?: string
          provider_message_id?: string | null
          push_subscription_id: string
          sent_at?: string | null
          status?: string
          target_role?: string | null
          user_profile_id?: string | null
        }
        Update: {
          collaborator_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          notification_event_id?: string
          provider?: string
          provider_message_id?: string | null
          push_subscription_id?: string
          sent_at?: string | null
          status?: string
          target_role?: string | null
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_logs_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_logs_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_logs_push_subscription_id_fkey"
            columns: ["push_subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_logs_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          data: Json
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          data?: Json
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          idempotency_key: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          notify_cancelled_appointment: boolean
          notify_checkin: boolean
          notify_completed: boolean
          notify_new_appointment: boolean
          notify_no_show: boolean
          notify_rescheduled_appointment: boolean
          notify_subscription_cancelled: boolean
          notify_subscription_closed: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_cancelled_appointment?: boolean
          notify_checkin?: boolean
          notify_completed?: boolean
          notify_new_appointment?: boolean
          notify_no_show?: boolean
          notify_rescheduled_appointment?: boolean
          notify_subscription_cancelled?: boolean
          notify_subscription_closed?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_cancelled_appointment?: boolean
          notify_checkin?: boolean
          notify_completed?: boolean
          notify_new_appointment?: boolean
          notify_no_show?: boolean
          notify_rescheduled_appointment?: boolean
          notify_subscription_cancelled?: boolean
          notify_subscription_closed?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfume_sale_installments: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_entry_id: string | null
          created_at: string
          due_date: string
          financial_movement_id: string | null
          id: string
          installment_number: number
          notes: string | null
          paid_at: string | null
          paid_method: string | null
          perfume_sale_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          created_at?: string
          due_date: string
          financial_movement_id?: string | null
          id?: string
          installment_number: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          perfume_sale_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          created_at?: string
          due_date?: string
          financial_movement_id?: string | null
          id?: string
          installment_number?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          perfume_sale_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_sale_installments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sale_installments_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sale_installments_financial_movement_id_fkey"
            columns: ["financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sale_installments_perfume_sale_id_fkey"
            columns: ["perfume_sale_id"]
            isOneToOne: false
            referencedRelation: "perfume_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      perfume_sales: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          commission_amount_snapshot: number
          commission_percent_snapshot: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string
          customer_phone_snapshot: string | null
          due_day: number | null
          external_code_snapshot: string | null
          id: string
          installment_count: number | null
          inventory_product_id: string
          linked_cash_entry_id: string | null
          linked_financial_movement_id: string | null
          notes: string | null
          payment_method_initial: string | null
          payment_mode: string
          perfume_name_snapshot: string
          professional_id: string
          quantity: number
          sale_date: string
          status: string
          stock_movement_id: string | null
          total_price: number
          unit_price_snapshot: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount_snapshot?: number
          commission_percent_snapshot?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot: string
          customer_phone_snapshot?: string | null
          due_day?: number | null
          external_code_snapshot?: string | null
          id?: string
          installment_count?: number | null
          inventory_product_id: string
          linked_cash_entry_id?: string | null
          linked_financial_movement_id?: string | null
          notes?: string | null
          payment_method_initial?: string | null
          payment_mode: string
          perfume_name_snapshot: string
          professional_id: string
          quantity?: number
          sale_date?: string
          status?: string
          stock_movement_id?: string | null
          total_price: number
          unit_price_snapshot: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount_snapshot?: number
          commission_percent_snapshot?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string
          customer_phone_snapshot?: string | null
          due_day?: number | null
          external_code_snapshot?: string | null
          id?: string
          installment_count?: number | null
          inventory_product_id?: string
          linked_cash_entry_id?: string | null
          linked_financial_movement_id?: string | null
          notes?: string | null
          payment_method_initial?: string | null
          payment_mode?: string
          perfume_name_snapshot?: string
          professional_id?: string
          quantity?: number
          sale_date?: string
          status?: string
          stock_movement_id?: string | null
          total_price?: number
          unit_price_snapshot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfume_sales_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_inventory_product_id_fkey"
            columns: ["inventory_product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_inventory_product_id_fkey"
            columns: ["inventory_product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "perfume_sales_linked_cash_entry_id_fkey"
            columns: ["linked_cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_linked_financial_movement_id_fkey"
            columns: ["linked_financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfume_sales_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          aliases: Json | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          updated_at: string
        }
        Insert: {
          aliases?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          updated_at?: string
        }
        Update: {
          aliases?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_advances: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          carry_over_to_next_period: boolean
          cash_entry_id: string | null
          closure_id: string | null
          created_at: string
          created_by: string | null
          description: string
          financial_movement_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          product_id: string | null
          professional_id: string
          quantity: number
          source_method: string
          status: string
          stock_movement_id: string | null
          total_amount: number
          type: string
          unit_amount: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          carry_over_to_next_period?: boolean
          cash_entry_id?: string | null
          closure_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id?: string | null
          professional_id: string
          quantity?: number
          source_method: string
          status?: string
          stock_movement_id?: string | null
          total_amount?: number
          type: string
          unit_amount?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          carry_over_to_next_period?: boolean
          cash_entry_id?: string | null
          closure_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          product_id?: string | null
          professional_id?: string
          quantity?: number
          source_method?: string
          status?: string
          stock_movement_id?: string | null
          total_amount?: number
          type?: string
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_advance_closure"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "professional_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_financial_movement_id_fkey"
            columns: ["financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "professional_advances_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_advances_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_closures: {
        Row: {
          advances_total: number
          barber_share: number
          barbershop_share: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_entry_id: string | null
          commission_percent_snapshot: number
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          deferred_total: number
          financial_movement_id: string | null
          gross_total: number
          id: string
          legit_text: string | null
          net_payable: number
          notes: string | null
          paid_at: string | null
          paid_method: string | null
          payment_reference_date: string
          period_end: string
          period_start: string
          professional_id: string
          snapshot_json: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          advances_total?: number
          barber_share?: number
          barbershop_share?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          commission_percent_snapshot: number
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deferred_total?: number
          financial_movement_id?: string | null
          gross_total?: number
          id?: string
          legit_text?: string | null
          net_payable?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          payment_reference_date: string
          period_end: string
          period_start: string
          professional_id: string
          snapshot_json?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          advances_total?: number
          barber_share?: number
          barbershop_share?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          commission_percent_snapshot?: number
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deferred_total?: number
          financial_movement_id?: string | null
          gross_total?: number
          id?: string
          legit_text?: string | null
          net_payable?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          payment_reference_date?: string
          period_end?: string
          period_start?: string
          professional_id?: string
          snapshot_json?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_closures_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_closures_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_closures_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_closures_financial_movement_id_fkey"
            columns: ["financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_closures_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_requests: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          id: string
          inventory_product_id: string | null
          linked_advance_id: string | null
          linked_cash_entry_id: string | null
          linked_financial_movement_id: string | null
          linked_perfume_sale_id: string | null
          linked_sale_id: string | null
          linked_stock_movement_id: string | null
          payload_json: Json
          professional_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_type: string
          service_id: string | null
          status: string
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          id?: string
          inventory_product_id?: string | null
          linked_advance_id?: string | null
          linked_cash_entry_id?: string | null
          linked_financial_movement_id?: string | null
          linked_perfume_sale_id?: string | null
          linked_sale_id?: string | null
          linked_stock_movement_id?: string | null
          payload_json: Json
          professional_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_type: string
          service_id?: string | null
          status?: string
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          id?: string
          inventory_product_id?: string | null
          linked_advance_id?: string | null
          linked_cash_entry_id?: string | null
          linked_financial_movement_id?: string | null
          linked_perfume_sale_id?: string | null
          linked_sale_id?: string | null
          linked_stock_movement_id?: string | null
          payload_json?: Json
          professional_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_type?: string
          service_id?: string | null
          status?: string
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_inventory_product_id_fkey"
            columns: ["inventory_product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_inventory_product_id_fkey"
            columns: ["inventory_product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "professional_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_requests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_working_hours: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean
          professional_id: string
          start_time: string
          updated_at: string | null
          weekday: number
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          professional_id: string
          start_time: string
          updated_at?: string | null
          weekday: number
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          professional_id?: string
          start_time?: string
          updated_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_working_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          browser: string | null
          collaborator_id: string | null
          created_at: string
          customer_id: string | null
          device_label: string | null
          endpoint: string | null
          id: string
          is_active: boolean
          is_pwa: boolean
          last_seen_at: string | null
          p256dh: string | null
          permission_status: string | null
          platform: string | null
          provider: string
          revoked_at: string | null
          role: string
          token: string
          updated_at: string
          user_agent: string | null
          user_profile_id: string
        }
        Insert: {
          auth_key?: string | null
          browser?: string | null
          collaborator_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_label?: string | null
          endpoint?: string | null
          id?: string
          is_active?: boolean
          is_pwa?: boolean
          last_seen_at?: string | null
          p256dh?: string | null
          permission_status?: string | null
          platform?: string | null
          provider?: string
          revoked_at?: string | null
          role: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_profile_id: string
        }
        Update: {
          auth_key?: string | null
          browser?: string | null
          collaborator_id?: string | null
          created_at?: string
          customer_id?: string | null
          device_label?: string | null
          endpoint?: string | null
          id?: string
          is_active?: boolean
          is_pwa?: boolean
          last_seen_at?: string | null
          p256dh?: string | null
          permission_status?: string | null
          platform?: string | null
          provider?: string
          revoked_at?: string | null
          role?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_advances: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_entry_id: string | null
          closure_id: string | null
          created_at: string
          created_by: string | null
          description: string
          financial_movement_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          period_end: string
          period_start: string
          product_id: string | null
          quantity: number
          source_method: string
          staff_id: string
          status: string
          stock_movement_id: string | null
          total_amount: number
          type: string
          unit_amount: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          closure_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          period_end: string
          period_start: string
          product_id?: string | null
          quantity?: number
          source_method: string
          staff_id: string
          status?: string
          stock_movement_id?: string | null
          total_amount: number
          type: string
          unit_amount: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          closure_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          financial_movement_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          period_end?: string
          period_start?: string
          product_id?: string | null
          quantity?: number
          source_method?: string
          staff_id?: string
          status?: string
          stock_movement_id?: string | null
          total_amount?: number
          type?: string
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_advances_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "reception_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_financial_movement_id_fkey"
            columns: ["financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reception_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "reception_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_advances_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_closures: {
        Row: {
          adjustments_total: number
          advances_total: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_entry_id: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          financial_movement_id: string | null
          id: string
          legit_text: string | null
          net_payable: number
          notes: string | null
          paid_at: string | null
          paid_method: string | null
          period_end: string
          period_start: string
          salary_amount: number
          snapshot_json: Json | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          adjustments_total?: number
          advances_total?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_movement_id?: string | null
          id?: string
          legit_text?: string | null
          net_payable?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          period_end: string
          period_start: string
          salary_amount?: number
          snapshot_json?: Json | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          adjustments_total?: number
          advances_total?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_entry_id?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_movement_id?: string | null
          id?: string
          legit_text?: string | null
          net_payable?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          period_end?: string
          period_start?: string
          salary_amount?: number
          snapshot_json?: Json | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_closures_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_closures_cash_entry_id_fkey"
            columns: ["cash_entry_id"]
            isOneToOne: false
            referencedRelation: "cash_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_closures_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_closures_financial_movement_id_fkey"
            columns: ["financial_movement_id"]
            isOneToOne: false
            referencedRelation: "financial_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reception_closures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "reception_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      reception_staff: {
        Row: {
          base_salary_per_period: number | null
          created_at: string
          display_name: string
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          settlement_primary_day: number | null
          settlement_secondary_day: number | null
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          base_salary_per_period?: number | null
          created_at?: string
          display_name: string
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          settlement_primary_day?: number | null
          settlement_secondary_day?: number | null
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          base_salary_per_period?: number | null
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          settlement_primary_day?: number | null
          settlement_secondary_day?: number | null
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reception_staff_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          commission_amount_snapshot: number | null
          commission_percent_snapshot: number | null
          commission_rule_snapshot: string | null
          created_at: string
          discount_amount: number
          id: string
          item_type: string
          product_id: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          service_name: string | null
          total: number | null
          unit_cost_snapshot: number
          unit_price_snapshot: number
        }
        Insert: {
          commission_amount_snapshot?: number | null
          commission_percent_snapshot?: number | null
          commission_rule_snapshot?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          item_type: string
          product_id?: string | null
          quantity: number
          sale_id: string
          service_id?: string | null
          service_name?: string | null
          total?: number | null
          unit_cost_snapshot: number
          unit_price_snapshot: number
        }
        Update: {
          commission_amount_snapshot?: number | null
          commission_percent_snapshot?: number | null
          commission_rule_snapshot?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          item_type?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          service_name?: string | null
          total?: number | null
          unit_cost_snapshot?: number
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          collaborator_id: string | null
          commission_amount_snapshot: number | null
          commission_is_custom: boolean | null
          commission_source: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name_snapshot: string | null
          customer_phone_snapshot: string | null
          discount_amount: number
          id: string
          notes: string | null
          payment_method_id: string | null
          payment_mode: string
          payment_status: string
          receivable_total: number
          sale_date: string
          status: string
          subtotal: number
          total: number | null
          updated_at: string
          upfront_amount: number
        }
        Insert: {
          collaborator_id?: string | null
          commission_amount_snapshot?: number | null
          commission_is_custom?: boolean | null
          commission_source?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_method_id?: string | null
          payment_mode?: string
          payment_status?: string
          receivable_total?: number
          sale_date?: string
          status: string
          subtotal?: number
          total?: number | null
          updated_at?: string
          upfront_amount?: number
        }
        Update: {
          collaborator_id?: string | null
          commission_amount_snapshot?: number | null
          commission_is_custom?: boolean | null
          commission_source?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name_snapshot?: string | null
          customer_phone_snapshot?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_method_id?: string | null
          payment_mode?: string
          payment_status?: string
          receivable_total?: number
          sale_date?: string
          status?: string
          subtotal?: number
          total?: number | null
          updated_at?: string
          upfront_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          normalized_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          normalized_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          normalized_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string | null
          commission_percent: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_bookable: boolean | null
          name: string
          normalized_name: string
          notes: string | null
          price: number
          price_type: string | null
          return_days: number | null
          show_price: boolean | null
          simultaneous_slots: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          commission_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bookable?: boolean | null
          name: string
          normalized_name: string
          notes?: string | null
          price?: number
          price_type?: string | null
          return_days?: number | null
          show_price?: boolean | null
          simultaneous_slots?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          commission_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_bookable?: boolean | null
          name?: string
          normalized_name?: string
          notes?: string | null
          price?: number
          price_type?: string | null
          return_days?: number | null
          show_price?: boolean | null
          simultaneous_slots?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjusted_by: string | null
          created_at: string
          difference: number | null
          id: string
          new_balance: number
          notes: string | null
          previous_balance: number
          product_id: string
          reason: string
        }
        Insert: {
          adjusted_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          new_balance: number
          notes?: string | null
          previous_balance: number
          product_id: string
          reason: string
        }
        Update: {
          adjusted_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          product_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          approved_by: string | null
          created_at: string
          destination_type: string
          id: string
          location_id: string | null
          movement_date: string
          movement_reason: string
          movement_type: Database["public"]["Enums"]["movement_type_enum"]
          notes: string | null
          performed_by: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          source_type: string
          total_cost_snapshot: number | null
          total_sale_snapshot: number | null
          unit_cost_snapshot: number | null
          unit_sale_snapshot: number | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          destination_type: string
          id?: string
          location_id?: string | null
          movement_date?: string
          movement_reason: string
          movement_type: Database["public"]["Enums"]["movement_type_enum"]
          notes?: string | null
          performed_by?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          source_type: string
          total_cost_snapshot?: number | null
          total_sale_snapshot?: number | null
          unit_cost_snapshot?: number | null
          unit_sale_snapshot?: number | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          destination_type?: string
          id?: string
          location_id?: string | null
          movement_date?: string
          movement_reason?: string
          movement_type?: Database["public"]["Enums"]["movement_type_enum"]
          notes?: string | null
          performed_by?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          source_type?: string
          total_cost_snapshot?: number | null
          total_sale_snapshot?: number | null
          unit_cost_snapshot?: number | null
          unit_sale_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
      subscription_occurrences: {
        Row: {
          appointment_id: string | null
          consumed_by_status: string | null
          created_at: string
          id: string
          notes: string | null
          occurrence_date: string
          occurrence_end_at: string
          occurrence_index: number
          occurrence_start_at: string
          status: string
          subscription_id: string
          template_items_json: Json
          updated_at: string
          used_at: string | null
          used_by: string | null
          visit_label: string | null
        }
        Insert: {
          appointment_id?: string | null
          consumed_by_status?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          occurrence_date: string
          occurrence_end_at: string
          occurrence_index: number
          occurrence_start_at: string
          status?: string
          subscription_id: string
          template_items_json?: Json
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          visit_label?: string | null
        }
        Update: {
          appointment_id?: string | null
          consumed_by_status?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          occurrence_date?: string
          occurrence_end_at?: string
          occurrence_index?: number
          occurrence_start_at?: string
          status?: string
          subscription_id?: string
          template_items_json?: Json
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          visit_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_occurrences_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_occurrences_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_at: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          professional_id: string | null
          provider: string
          provider_invoice_id: string | null
          provider_payment_id: string | null
          raw_event: Json | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          due_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          professional_id?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          raw_event?: Json | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          professional_id?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_payment_id?: string | null
          raw_event?: Json | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_professionals: {
        Row: {
          plan_id: string
          professional_id: string
        }
        Insert: {
          plan_id: string
          professional_id: string
        }
        Update: {
          plan_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_professionals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          display_name: string
          duration_minutes_per_visit: number
          id: string
          imported_from_service: boolean
          included_services_json: Json | null
          is_active: boolean
          monthly_price: number
          name: string
          needs_manual_review: boolean
          plan_number: number | null
          professional_scope: string | null
          show_in_customer_portal: boolean
          slug: string
          sort_order: number
          source_service_id: string | null
          updated_at: string
          visit_template_json: Json
          visits_per_cycle: number
        }
        Insert: {
          created_at?: string
          display_name: string
          duration_minutes_per_visit: number
          id?: string
          imported_from_service?: boolean
          included_services_json?: Json | null
          is_active?: boolean
          monthly_price: number
          name: string
          needs_manual_review?: boolean
          plan_number?: number | null
          professional_scope?: string | null
          show_in_customer_portal?: boolean
          slug: string
          sort_order?: number
          source_service_id?: string | null
          updated_at?: string
          visit_template_json?: Json
          visits_per_cycle: number
        }
        Update: {
          created_at?: string
          display_name?: string
          duration_minutes_per_visit?: number
          id?: string
          imported_from_service?: boolean
          included_services_json?: Json | null
          is_active?: boolean
          monthly_price?: number
          name?: string
          needs_manual_review?: boolean
          plan_number?: number | null
          professional_scope?: string | null
          show_in_customer_portal?: boolean
          slug?: string
          sort_order?: number
          source_service_id?: string | null
          updated_at?: string
          visit_template_json?: Json
          visits_per_cycle?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          processed_at: string | null
          provider: string
          raw_payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          processed_at?: string | null
          provider: string
          raw_payload?: Json | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string | null
          provider?: string
          raw_payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          auth_user_id: string | null
          can_approve_professional_requests: boolean | null
          can_manage_system: boolean | null
          can_submit_professional_requests: boolean | null
          can_view_all_professionals: boolean | null
          collaborator_id: string | null
          created_at: string
          display_name: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          system_role: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          can_approve_professional_requests?: boolean | null
          can_manage_system?: boolean | null
          can_submit_professional_requests?: boolean | null
          can_view_all_professionals?: boolean | null
          collaborator_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          role?: string
          system_role?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          can_approve_professional_requests?: boolean | null
          can_manage_system?: boolean | null
          can_submit_professional_requests?: boolean | null
          can_view_all_professionals?: boolean | null
          collaborator_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          system_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_costs: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          occurred_on: string
          reference_id: string | null
          reference_type: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          occurred_on?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          occurred_on?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_agent_permissions: {
        Row: {
          can_cancel_appointment: boolean
          can_create_appointment: boolean
          can_read: boolean
          can_reschedule_appointment: boolean
          can_write: boolean
          created_at: string
          id: string
          is_enabled: boolean
          requires_human_confirmation: boolean
          scope: string
          updated_at: string
        }
        Insert: {
          can_cancel_appointment?: boolean
          can_create_appointment?: boolean
          can_read?: boolean
          can_reschedule_appointment?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          requires_human_confirmation?: boolean
          scope: string
          updated_at?: string
        }
        Update: {
          can_cancel_appointment?: boolean
          can_create_appointment?: boolean
          can_read?: boolean
          can_reschedule_appointment?: boolean
          can_write?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          requires_human_confirmation?: boolean
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          instance_name: string
          last_connected_at: string | null
          last_disconnected_at: string | null
          last_error: string | null
          last_qr_at: string | null
          last_qr_code: string | null
          metadata: Json
          phone_number: string | null
          profile_name: string | null
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
          webhook_enabled: boolean
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          instance_name: string
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          last_qr_at?: string | null
          last_qr_code?: string | null
          metadata?: Json
          phone_number?: string | null
          profile_name?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          webhook_enabled?: boolean
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          last_qr_at?: string | null
          last_qr_code?: string | null
          metadata?: Json
          phone_number?: string | null
          profile_name?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          webhook_enabled?: boolean
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          agent_handled: boolean
          appointment_id: string | null
          body: string | null
          created_at: string
          customer_id: string | null
          direction: string
          human_takeover: boolean
          id: string
          instance_name: string
          intent: string | null
          message_id: string | null
          message_type: string | null
          phone_normalized: string | null
          raw_payload: Json | null
          remote_jid: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_handled?: boolean
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          customer_id?: string | null
          direction: string
          human_takeover?: boolean
          id?: string
          instance_name: string
          intent?: string | null
          message_id?: string | null
          message_type?: string | null
          phone_normalized?: string | null
          raw_payload?: Json | null
          remote_jid: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_handled?: boolean
          appointment_id?: string | null
          body?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          human_takeover?: boolean
          id?: string
          instance_name?: string
          intent?: string | null
          message_id?: string | null
          message_type?: string | null
          phone_normalized?: string | null
          raw_payload?: Json | null
          remote_jid?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_outbound_queue: {
        Row: {
          appointment_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          instance_name: string
          message_body: string
          phone_normalized: string | null
          remote_jid: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          template_key: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          instance_name: string
          message_body: string
          phone_normalized?: string | null
          remote_jid: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          instance_name?: string
          message_body?: string
          phone_normalized?: string | null
          remote_jid?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          direction: string | null
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          instance_name: string
          message_id: string | null
          processed_at: string | null
          processed_status: string
          provider: string
          raw_payload: Json
          received_at: string
          remote_jid: string | null
        }
        Insert: {
          direction?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          instance_name: string
          message_id?: string | null
          processed_at?: string | null
          processed_status?: string
          provider?: string
          raw_payload: Json
          received_at?: string
          remote_jid?: string | null
        }
        Update: {
          direction?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          instance_name?: string
          message_id?: string | null
          processed_at?: string | null
          processed_status?: string
          provider?: string
          raw_payload?: Json
          received_at?: string
          remote_jid?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_commission_summary: {
        Row: {
          collaborator_id: string | null
          month: string | null
          paid_commission: number | null
          total_base_commissionable: number | null
          total_commission: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_daily_cash_summary: {
        Row: {
          calculated_expected: number | null
          closing_amount: number | null
          difference_amount: number | null
          opening_amount: number | null
          session_date: string | null
          session_id: string | null
          status: string | null
          total_inflows: number | null
          total_outflows: number | null
        }
        Insert: {
          calculated_expected?: never
          closing_amount?: number | null
          difference_amount?: number | null
          opening_amount?: number | null
          session_date?: string | null
          session_id?: string | null
          status?: string | null
          total_inflows?: never
          total_outflows?: never
        }
        Update: {
          calculated_expected?: never
          closing_amount?: number | null
          difference_amount?: number | null
          opening_amount?: number | null
          session_date?: string | null
          session_id?: string | null
          status?: string | null
          total_inflows?: never
          total_outflows?: never
        }
        Relationships: []
      }
      vw_financial_flow_summary: {
        Row: {
          fixed_costs: number | null
          flow_date: string | null
          net_profit: number | null
          total_expenses: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      vw_inventory_position: {
        Row: {
          brand_name: string | null
          category_name: string | null
          cost_price: number | null
          current_balance: number | null
          external_code: string | null
          is_active: boolean | null
          markup_percent: number | null
          max_stock: number | null
          min_stock: number | null
          product_id: string | null
          product_name: string | null
          sale_price: number | null
          sale_price_cash: number | null
          sale_price_installment: number | null
          stock_status: string | null
          suggested_purchase: number | null
          total_cost_value: number | null
          total_sale_value: number | null
        }
        Relationships: []
      }
      vw_stock_movement_summary: {
        Row: {
          consumption: number | null
          day: string | null
          losses: number | null
          product_id: string | null
          total_in: number | null
          total_out: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "inventory_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_inventory_position"
            referencedColumns: ["product_id"]
          },
        ]
      }
    }
    Functions: {
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      cash_entry_type:
        | "income"
        | "expense"
        | "withdrawal"
        | "reinforcement"
        | "sale_income"
        | "manual_income"
        | "manual_expense"
      movement_type_enum:
        | "initial_balance"
        | "purchase_entry"
        | "sale_exit"
        | "internal_consumption"
        | "loss"
        | "damage"
        | "manual_adjustment_in"
        | "manual_adjustment_out"
        | "transfer"
        | "return_from_customer"
        | "supplier_return"
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
      cash_entry_type: [
        "income",
        "expense",
        "withdrawal",
        "reinforcement",
        "sale_income",
        "manual_income",
        "manual_expense",
      ],
      movement_type_enum: [
        "initial_balance",
        "purchase_entry",
        "sale_exit",
        "internal_consumption",
        "loss",
        "damage",
        "manual_adjustment_in",
        "manual_adjustment_out",
        "transfer",
        "return_from_customer",
        "supplier_return",
      ],
    },
  },
} as const
