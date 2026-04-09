export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Trade =
  | "roofing"
  | "hvac"
  | "plumbing"
  | "electrical"
  | "landscaping"
  | "general";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled";

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          trade: Trade;
          phone: string | null;
          email: string | null;
          address: string | null;
          logo_url: string | null;
          stripe_customer_id: string | null;
          subscription_status: SubscriptionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          trade?: Trade;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          logo_url?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: SubscriptionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          trade?: Trade;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          logo_url?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: SubscriptionStatus;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          notes: string | null;
          tags: string[] | null;
          source: "referral" | "google" | "facebook" | "door-knock" | "other" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          source?: "referral" | "google" | "facebook" | "door-knock" | "other" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          tags?: string[] | null;
          source?: "referral" | "google" | "facebook" | "door-knock" | "other" | null;
          updated_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          title: string;
          description: string | null;
          status: "scheduled" | "in_progress" | "completed" | "cancelled";
          priority: "low" | "normal" | "high" | "urgent";
          scheduled_date: string | null;
          scheduled_time: string | null;
          completed_date: string | null;
          estimated_amount: number | null;
          actual_amount: number | null;
          notes: string | null;
          before_photos: string[] | null;
          after_photos: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          title: string;
          description?: string | null;
          status?: "scheduled" | "in_progress" | "completed" | "cancelled";
          priority?: "low" | "normal" | "high" | "urgent";
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          completed_date?: string | null;
          estimated_amount?: number | null;
          actual_amount?: number | null;
          notes?: string | null;
          before_photos?: string[] | null;
          after_photos?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          title?: string;
          description?: string | null;
          status?: "scheduled" | "in_progress" | "completed" | "cancelled";
          priority?: "low" | "normal" | "high" | "urgent";
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          completed_date?: string | null;
          estimated_amount?: number | null;
          actual_amount?: number | null;
          notes?: string | null;
          before_photos?: string[] | null;
          after_photos?: string[] | null;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          job_id: string | null;
          invoice_number: string;
          amount: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
          stripe_invoice_id: string | null;
          stripe_payment_link: string | null;
          due_date: string | null;
          paid_date: string | null;
          notes: string | null;
          line_items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          job_id?: string | null;
          invoice_number: string;
          amount: number;
          tax_rate?: number;
          due_date?: string | null;
          paid_date?: string | null;
          status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
          stripe_invoice_id?: string | null;
          stripe_payment_link?: string | null;
          notes?: string | null;
          line_items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          job_id?: string | null;
          invoice_number?: string;
          amount?: number;
          tax_rate?: number;
          due_date?: string | null;
          paid_date?: string | null;
          status?: "draft" | "sent" | "paid" | "overdue" | "cancelled";
          stripe_invoice_id?: string | null;
          stripe_payment_link?: string | null;
          notes?: string | null;
          line_items?: Json;
          updated_at?: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          job_id: string | null;
          type: "appointment_reminder" | "follow_up" | "review_request" | "payment_reminder";
          message: string;
          phone: string;
          scheduled_for: string;
          sent_at: string | null;
          status: "pending" | "sent" | "failed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          job_id?: string | null;
          type: "appointment_reminder" | "follow_up" | "review_request" | "payment_reminder";
          message: string;
          phone: string;
          scheduled_for: string;
          sent_at?: string | null;
          status?: "pending" | "sent" | "failed" | "cancelled";
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          customer_id?: string;
          job_id?: string | null;
          type?: "appointment_reminder" | "follow_up" | "review_request" | "payment_reminder";
          message?: string;
          phone?: string;
          scheduled_for?: string;
          sent_at?: string | null;
          status?: "pending" | "sent" | "failed" | "cancelled";
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};
