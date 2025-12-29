CREATE TABLE "ai_usage_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"deployment_name" text,
	"feature" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"estimated_cost_microdollars" integer,
	"latency_ms" integer,
	"was_streaming" boolean DEFAULT false,
	"request_id" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_summaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"total_prompt_tokens" integer DEFAULT 0 NOT NULL,
	"total_completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_microdollars" integer DEFAULT 0 NOT NULL,
	"usage_by_model" jsonb,
	"usage_by_feature" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_usage_summaries_tenant_id_period_type_period_start_unique" UNIQUE("tenant_id","period_type","period_start")
);
--> statement-breakpoint
CREATE TABLE "big_rock_planner_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"big_rock_id" varchar NOT NULL,
	"planner_task_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "big_rock_planner_tasks_big_rock_id_planner_task_id_unique" UNIQUE("big_rock_id","planner_task_id")
);
--> statement-breakpoint
CREATE TABLE "big_rocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"objective_id" varchar,
	"key_result_id" varchar,
	"linked_strategies" jsonb,
	"status" text DEFAULT 'not_started',
	"completion_percentage" integer DEFAULT 0,
	"owner_id" varchar,
	"owner_email" text,
	"team_id" varchar,
	"accountable_id" varchar,
	"accountable_email" text,
	"quarter" integer,
	"year" integer,
	"start_date" timestamp,
	"due_date" timestamp,
	"completed_at" timestamp,
	"priority" text,
	"blocked_by" jsonb,
	"tasks" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"last_check_in_at" timestamp,
	"last_check_in_note" text,
	"planner_plan_id" varchar,
	"planner_bucket_id" varchar,
	"planner_sync_enabled" boolean DEFAULT false,
	"planner_last_sync_at" timestamp,
	"planner_sync_error" text,
	CONSTRAINT "big_rocks_tenant_id_title_quarter_year_unique" UNIQUE("tenant_id","title","quarter","year")
);
--> statement-breakpoint
CREATE TABLE "blocked_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"reason" text,
	"blocked_by" varchar,
	"blocked_at" timestamp DEFAULT now(),
	CONSTRAINT "blocked_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"previous_value" double precision,
	"new_value" double precision,
	"previous_progress" double precision,
	"new_progress" double precision,
	"previous_status" text,
	"new_status" text,
	"status_manually_set" varchar DEFAULT 'false',
	"note" text,
	"achievements" jsonb,
	"challenges" jsonb,
	"next_steps" jsonb,
	"source" text DEFAULT 'manual',
	"integration_id" varchar,
	"user_id" varchar NOT NULL,
	"user_email" text,
	"as_of_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultant_tenant_access" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultant_user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"granted_by" varchar NOT NULL,
	"granted_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"notes" text,
	CONSTRAINT "consultant_tenant_access_consultant_user_id_tenant_id_unique" UNIQUE("consultant_user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "foundations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"mission" text,
	"vision" text,
	"values" jsonb,
	"annual_goals" jsonb,
	"fiscal_year_start_month" integer,
	"tagline" text,
	"company_summary" text,
	"messaging_statement" text,
	"culture_statement" text,
	"brand_voice" text,
	"effective_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "foundations_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "graph_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"service" varchar DEFAULT 'planner' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" jsonb,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "graph_tokens_user_id_service_unique" UNIQUE("user_id","service")
);
--> statement-breakpoint
CREATE TABLE "grounding_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_tenant_background" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"import_type" text NOT NULL,
	"file_name" text,
	"file_size" integer,
	"status" text NOT NULL,
	"objectives_created" integer DEFAULT 0,
	"key_results_created" integer DEFAULT 0,
	"big_rocks_created" integer DEFAULT 0,
	"check_ins_created" integer DEFAULT 0,
	"teams_created" integer DEFAULT 0,
	"warnings" jsonb,
	"errors" jsonb,
	"skipped_items" jsonb,
	"duplicate_strategy" text,
	"fiscal_year_start_month" integer,
	"imported_by" varchar NOT NULL,
	"imported_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "key_result_big_rocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_result_id" varchar NOT NULL,
	"big_rock_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "key_result_big_rocks_key_result_id_big_rock_id_unique" UNIQUE("key_result_id","big_rock_id")
);
--> statement-breakpoint
CREATE TABLE "key_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric_type" text NOT NULL,
	"current_value" double precision DEFAULT 0,
	"target_value" double precision NOT NULL,
	"initial_value" double precision DEFAULT 0,
	"unit" text,
	"progress" double precision DEFAULT 0,
	"weight" integer DEFAULT 25,
	"is_weight_locked" boolean DEFAULT false,
	"is_promoted_to_kpi" varchar DEFAULT 'false',
	"promoted_kpi_id" varchar,
	"promoted_at" timestamp,
	"promoted_by" varchar,
	"status" text DEFAULT 'not_started',
	"owner_id" varchar,
	"phased_targets" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"last_check_in_at" timestamp,
	"last_check_in_note" text,
	"excel_source_type" text,
	"excel_file_id" text,
	"excel_drive_id" text,
	"excel_file_name" text,
	"excel_file_path" text,
	"excel_sheet_name" text,
	"excel_cell_reference" text,
	"excel_last_sync_at" timestamp,
	"excel_last_sync_value" double precision,
	"excel_sync_error" text,
	"excel_auto_sync" boolean DEFAULT false,
	"planner_plan_id" varchar,
	"planner_bucket_id" varchar,
	"planner_sync_enabled" boolean DEFAULT false,
	"planner_last_sync_at" timestamp,
	"planner_sync_error" text
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"label" text NOT NULL,
	"value" integer,
	"change" integer,
	"target" integer,
	"linked_goals" jsonb,
	"quarter" integer,
	"year" integer,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kpis_tenant_id_label_quarter_year_unique" UNIQUE("tenant_id","label","quarter","year")
);
--> statement-breakpoint
CREATE TABLE "launchpad_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"source_document_name" text,
	"source_document_text" text,
	"ai_proposal" jsonb,
	"user_edits" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_year" integer NOT NULL,
	"target_quarter" integer,
	"analysis_progress" integer DEFAULT 0,
	"analysis_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"meeting_type" text,
	"title" text NOT NULL,
	"date" timestamp,
	"attendees" jsonb,
	"summary" text,
	"decisions" jsonb,
	"action_items" jsonb,
	"next_meeting_date" timestamp,
	"template_id" text,
	"facilitator" text,
	"agenda" jsonb,
	"risks" jsonb,
	"linked_objective_ids" jsonb,
	"linked_key_result_ids" jsonb,
	"linked_big_rock_ids" jsonb,
	"meeting_notes" text,
	"outlook_event_id" text,
	"outlook_calendar_id" text,
	"synced_at" timestamp,
	"sync_status" text,
	"sync_error" text,
	"summary_email_status" text,
	"summary_email_sent_at" timestamp,
	"series_id" varchar,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"recurrence_end_date" timestamp,
	"recurrence_day" integer,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "meetings_tenant_id_title_date_unique" UNIQUE("tenant_id","title","date")
);
--> statement-breakpoint
CREATE TABLE "objective_big_rocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"big_rock_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "objective_big_rocks_objective_id_big_rock_id_unique" UNIQUE("objective_id","big_rock_id")
);
--> statement-breakpoint
CREATE TABLE "objective_planner_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"planner_task_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "objective_planner_tasks_objective_id_planner_task_id_unique" UNIQUE("objective_id","planner_task_id")
);
--> statement-breakpoint
CREATE TABLE "objective_values" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" varchar NOT NULL,
	"value_title" text NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "objective_values_objective_id_value_title_unique" UNIQUE("objective_id","value_title")
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"parent_id" varchar,
	"level" text NOT NULL,
	"owner_id" varchar,
	"owner_email" text,
	"team_id" varchar,
	"co_owner_ids" jsonb,
	"check_in_owner_id" varchar,
	"progress" double precision DEFAULT 0,
	"progress_mode" text DEFAULT 'rollup',
	"status" text DEFAULT 'not_started',
	"status_override" varchar DEFAULT 'false',
	"quarter" integer,
	"year" integer,
	"start_date" timestamp,
	"end_date" timestamp,
	"linked_strategies" jsonb,
	"linked_goals" jsonb,
	"linked_values" jsonb,
	"aligned_to_objective_ids" jsonb,
	"goal_type" text DEFAULT 'committed',
	"phased_targets" jsonb,
	"last_reminder_sent" timestamp,
	"reminder_frequency" text DEFAULT 'weekly',
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"last_check_in_at" timestamp,
	"last_check_in_note" text,
	CONSTRAINT "objectives_tenant_id_title_quarter_year_unique" UNIQUE("tenant_id","title","quarter","year")
);
--> statement-breakpoint
CREATE TABLE "okrs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"objective" text NOT NULL,
	"progress" double precision,
	"linked_goals" jsonb,
	"linked_strategies" jsonb,
	"key_results" jsonb,
	"department" text,
	"assigned_to" text,
	"quarter" integer,
	"year" integer,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "okrs_tenant_id_objective_quarter_year_unique" UNIQUE("tenant_id","objective","quarter","year")
);
--> statement-breakpoint
CREATE TABLE "page_visits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page" text NOT NULL,
	"visitor_id" text,
	"user_agent" text,
	"referrer" text,
	"ip_address" text,
	"country" text,
	"visited_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "planner_buckets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"graph_bucket_id" text NOT NULL,
	"name" text NOT NULL,
	"order_hint" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "planner_buckets_plan_id_graph_bucket_id_unique" UNIQUE("plan_id","graph_bucket_id")
);
--> statement-breakpoint
CREATE TABLE "planner_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"graph_plan_id" text NOT NULL,
	"graph_group_id" text,
	"title" text NOT NULL,
	"owner" text,
	"last_synced_at" timestamp,
	"synced_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "planner_plans_tenant_id_graph_plan_id_unique" UNIQUE("tenant_id","graph_plan_id")
);
--> statement-breakpoint
CREATE TABLE "planner_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"bucket_id" varchar,
	"tenant_id" varchar NOT NULL,
	"graph_task_id" text NOT NULL,
	"title" text NOT NULL,
	"percent_complete" integer DEFAULT 0,
	"priority" integer,
	"start_date_time" timestamp,
	"due_date_time" timestamp,
	"completed_date_time" timestamp,
	"assignments" jsonb,
	"description" text,
	"checklist" jsonb,
	"references" jsonb,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "planner_tasks_plan_id_graph_task_id_unique" UNIQUE("plan_id","graph_task_id")
);
--> statement-breakpoint
CREATE TABLE "report_instances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"template_id" varchar,
	"snapshot_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"report_type" text NOT NULL,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"quarter" integer,
	"year" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"generated_at" timestamp,
	"generation_error" text,
	"pdf_url" text,
	"pdf_size" integer,
	"report_data" jsonb,
	"emailed_to" jsonb,
	"emailed_at" timestamp,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"template_type" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"sections" jsonb,
	"filters" jsonb,
	"branding_overrides" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"review_type" text NOT NULL,
	"quarter" integer,
	"year" integer NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"snapshot_date" timestamp NOT NULL,
	"executive_summary" text,
	"key_achievements" jsonb,
	"challenges" jsonb,
	"lessons_learned" jsonb,
	"next_quarter_priorities" jsonb,
	"objectives_snapshot" jsonb,
	"key_results_snapshot" jsonb,
	"big_rocks_snapshot" jsonb,
	"overall_progress" integer,
	"objectives_completed" integer,
	"objectives_total" integer,
	"key_results_completed" integer,
	"key_results_total" integer,
	"presenter_id" varchar,
	"attendee_ids" jsonb,
	"status" text DEFAULT 'draft',
	"published_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"max_read_write_users" integer,
	"max_read_only_users" integer,
	"duration_days" integer,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "service_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text,
	"linked_goals" jsonb,
	"status" text,
	"owner" text,
	"timeline" text,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "strategies_tenant_id_title_unique" UNIQUE("tenant_id","title")
);
--> statement-breakpoint
CREATE TABLE "strategy_values" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strategy_id" varchar NOT NULL,
	"value_title" text NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "strategy_values_strategy_id_value_title_unique" UNIQUE("strategy_id","value_title")
);
--> statement-breakpoint
CREATE TABLE "system_banners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"link_url" text,
	"link_text" text,
	"status" text DEFAULT 'off' NOT NULL,
	"scheduled_start" timestamp,
	"scheduled_end" timestamp,
	"background_color" text DEFAULT '#0EA5E9',
	"text_color" text DEFAULT '#FFFFFF',
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_vocabulary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terms" jsonb NOT NULL,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_team_id" varchar,
	"level" integer DEFAULT 0,
	"leader_id" varchar,
	"leader_email" text,
	"member_ids" jsonb,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "teams_tenant_id_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"logo_url" text,
	"allowed_domains" jsonb,
	"default_time_period" jsonb,
	"azure_tenant_id" text,
	"enforce_sso" boolean DEFAULT false,
	"allow_local_auth" boolean DEFAULT true,
	"connector_onedrive" boolean DEFAULT false,
	"connector_sharepoint" boolean DEFAULT false,
	"connector_outlook" boolean DEFAULT false,
	"connector_excel" boolean DEFAULT false,
	"connector_planner" boolean DEFAULT false,
	"admin_consent_granted" boolean DEFAULT false,
	"admin_consent_granted_at" timestamp,
	"admin_consent_granted_by" varchar,
	"vocabulary_overrides" jsonb,
	"branding" jsonb,
	"logo_url_dark" text,
	"favicon_url" text,
	"custom_subdomain" text,
	"service_plan_id" varchar,
	"plan_started_at" timestamp,
	"plan_expires_at" timestamp,
	"plan_status" text DEFAULT 'active',
	"plan_cancelled_at" timestamp,
	"plan_cancelled_by" varchar,
	"plan_cancel_reason" text,
	"self_service_signup" boolean DEFAULT false,
	"signup_completed_at" timestamp,
	"invite_only" boolean DEFAULT false,
	CONSTRAINT "tenants_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text,
	"role" text NOT NULL,
	"tenant_id" varchar,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"auth_provider" text DEFAULT 'local',
	"azure_object_id" text,
	"azure_tenant_id" text,
	"license_type" text DEFAULT 'read_write',
	"user_type" text DEFAULT 'client',
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_summaries" ADD CONSTRAINT "ai_usage_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rock_planner_tasks" ADD CONSTRAINT "big_rock_planner_tasks_big_rock_id_big_rocks_id_fk" FOREIGN KEY ("big_rock_id") REFERENCES "public"."big_rocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rock_planner_tasks" ADD CONSTRAINT "big_rock_planner_tasks_planner_task_id_planner_tasks_id_fk" FOREIGN KEY ("planner_task_id") REFERENCES "public"."planner_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rock_planner_tasks" ADD CONSTRAINT "big_rock_planner_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rock_planner_tasks" ADD CONSTRAINT "big_rock_planner_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_accountable_id_users_id_fk" FOREIGN KEY ("accountable_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_planner_plan_id_planner_plans_id_fk" FOREIGN KEY ("planner_plan_id") REFERENCES "public"."planner_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_rocks" ADD CONSTRAINT "big_rocks_planner_bucket_id_planner_buckets_id_fk" FOREIGN KEY ("planner_bucket_id") REFERENCES "public"."planner_buckets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_tenant_access" ADD CONSTRAINT "consultant_tenant_access_consultant_user_id_users_id_fk" FOREIGN KEY ("consultant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_tenant_access" ADD CONSTRAINT "consultant_tenant_access_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultant_tenant_access" ADD CONSTRAINT "consultant_tenant_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foundations" ADD CONSTRAINT "foundations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_tokens" ADD CONSTRAINT "graph_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_tokens" ADD CONSTRAINT "graph_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grounding_documents" ADD CONSTRAINT "grounding_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_history" ADD CONSTRAINT "import_history_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_result_big_rocks" ADD CONSTRAINT "key_result_big_rocks_key_result_id_key_results_id_fk" FOREIGN KEY ("key_result_id") REFERENCES "public"."key_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_result_big_rocks" ADD CONSTRAINT "key_result_big_rocks_big_rock_id_big_rocks_id_fk" FOREIGN KEY ("big_rock_id") REFERENCES "public"."big_rocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_result_big_rocks" ADD CONSTRAINT "key_result_big_rocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_promoted_by_users_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_planner_plan_id_planner_plans_id_fk" FOREIGN KEY ("planner_plan_id") REFERENCES "public"."planner_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_planner_bucket_id_planner_buckets_id_fk" FOREIGN KEY ("planner_bucket_id") REFERENCES "public"."planner_buckets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_sessions" ADD CONSTRAINT "launchpad_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launchpad_sessions" ADD CONSTRAINT "launchpad_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_big_rocks" ADD CONSTRAINT "objective_big_rocks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_big_rocks" ADD CONSTRAINT "objective_big_rocks_big_rock_id_big_rocks_id_fk" FOREIGN KEY ("big_rock_id") REFERENCES "public"."big_rocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_big_rocks" ADD CONSTRAINT "objective_big_rocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_planner_tasks" ADD CONSTRAINT "objective_planner_tasks_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_planner_tasks" ADD CONSTRAINT "objective_planner_tasks_planner_task_id_planner_tasks_id_fk" FOREIGN KEY ("planner_task_id") REFERENCES "public"."planner_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_planner_tasks" ADD CONSTRAINT "objective_planner_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_planner_tasks" ADD CONSTRAINT "objective_planner_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_values" ADD CONSTRAINT "objective_values_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_values" ADD CONSTRAINT "objective_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_parent_id_objectives_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_check_in_owner_id_users_id_fk" FOREIGN KEY ("check_in_owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "okrs" ADD CONSTRAINT "okrs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_buckets" ADD CONSTRAINT "planner_buckets_plan_id_planner_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planner_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_buckets" ADD CONSTRAINT "planner_buckets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_plans" ADD CONSTRAINT "planner_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_plans" ADD CONSTRAINT "planner_plans_synced_by_users_id_fk" FOREIGN KEY ("synced_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_plan_id_planner_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."planner_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_bucket_id_planner_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."planner_buckets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_template_id_report_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_snapshot_id_review_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."review_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_instances" ADD CONSTRAINT "report_instances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_presenter_id_users_id_fk" FOREIGN KEY ("presenter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_snapshots" ADD CONSTRAINT "review_snapshots_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_values" ADD CONSTRAINT "strategy_values_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_values" ADD CONSTRAINT "strategy_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_service_plan_id_service_plans_id_fk" FOREIGN KEY ("service_plan_id") REFERENCES "public"."service_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;