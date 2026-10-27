import type { MigrationInterface, QueryRunner } from 'typeorm'

const INITIAL_SCHEMA_TABLES = [
  'app_settings',
  'asset_assignments',
  'asset_categories',
  'asset_maintenance',
  'asset_status_history',
  'assets',
  'audit_logs',
  'departments',
  'inventory_audit_items',
  'inventory_audits',
  'locations',
  'notifications',
  'permissions',
  'refresh_tokens',
  'role_permissions',
  'roles',
  'ticket_assignments',
  'ticket_attachments',
  'ticket_categories',
  'ticket_comments',
  'ticket_sla_policies',
  'ticket_status_history',
  'tickets',
  'user_roles',
  'users',
  'vendors',
]

const INITIAL_SCHEMA_COLUMNS = [
  'app_settings.description',
  'app_settings.key',
  'app_settings.updated_at',
  'app_settings.updated_by',
  'app_settings.value',
  'asset_assignments.asset_id',
  'asset_assignments.assigned_at',
  'asset_assignments.assigned_by',
  'asset_assignments.id',
  'asset_assignments.location_id',
  'asset_assignments.notes',
  'asset_assignments.returned_at',
  'asset_assignments.user_id',
  'asset_categories.code',
  'asset_categories.created_at',
  'asset_categories.description',
  'asset_categories.id',
  'asset_categories.is_active',
  'asset_categories.name',
  'asset_maintenance.asset_id',
  'asset_maintenance.completed_at',
  'asset_maintenance.cost',
  'asset_maintenance.created_at',
  'asset_maintenance.created_by',
  'asset_maintenance.description',
  'asset_maintenance.id',
  'asset_maintenance.maintenance_type',
  'asset_maintenance.performed_by',
  'asset_maintenance.scheduled_at',
  'asset_maintenance.started_at',
  'asset_maintenance.status',
  'asset_maintenance.title',
  'asset_maintenance.updated_at',
  'asset_maintenance.vendor_id',
  'asset_status_history.asset_id',
  'asset_status_history.changed_at',
  'asset_status_history.changed_by',
  'asset_status_history.id',
  'asset_status_history.new_status',
  'asset_status_history.previous_status',
  'asset_status_history.reason',
  'assets.asset_tag',
  'assets.category_id',
  'assets.condition',
  'assets.created_at',
  'assets.created_by',
  'assets.deleted_at',
  'assets.description',
  'assets.id',
  'assets.location_id',
  'assets.manufacturer',
  'assets.model',
  'assets.name',
  'assets.notes',
  'assets.purchase_cost',
  'assets.purchase_date',
  'assets.serial_number',
  'assets.status',
  'assets.updated_at',
  'assets.updated_by',
  'assets.vendor_id',
  'assets.warranty_end',
  'assets.warranty_start',
  'audit_logs.action',
  'audit_logs.actor_id',
  'audit_logs.created_at',
  'audit_logs.entity_id',
  'audit_logs.entity_type',
  'audit_logs.id',
  'audit_logs.ip_address',
  'audit_logs.new_values',
  'audit_logs.old_values',
  'audit_logs.request_id',
  'audit_logs.user_agent',
  'departments.code',
  'departments.created_at',
  'departments.description',
  'departments.id',
  'departments.is_active',
  'departments.name',
  'departments.updated_at',
  'inventory_audit_items.actual_location_id',
  'inventory_audit_items.actual_status',
  'inventory_audit_items.asset_id',
  'inventory_audit_items.created_at',
  'inventory_audit_items.expected_location_id',
  'inventory_audit_items.expected_status',
  'inventory_audit_items.id',
  'inventory_audit_items.inventory_audit_id',
  'inventory_audit_items.notes',
  'inventory_audit_items.physical_condition',
  'inventory_audit_items.verification_status',
  'inventory_audit_items.verified_at',
  'inventory_audit_items.verified_by',
  'inventory_audits.audit_number',
  'inventory_audits.completed_at',
  'inventory_audits.created_at',
  'inventory_audits.created_by',
  'inventory_audits.description',
  'inventory_audits.id',
  'inventory_audits.location_id',
  'inventory_audits.review_notes',
  'inventory_audits.reviewed_by',
  'inventory_audits.scheduled_at',
  'inventory_audits.started_at',
  'inventory_audits.status',
  'inventory_audits.title',
  'inventory_audits.updated_at',
  'locations.address',
  'locations.building',
  'locations.code',
  'locations.created_at',
  'locations.floor',
  'locations.id',
  'locations.is_active',
  'locations.name',
  'locations.room',
  'locations.updated_at',
  'notifications.created_at',
  'notifications.id',
  'notifications.message',
  'notifications.read_at',
  'notifications.resource_id',
  'notifications.resource_type',
  'notifications.title',
  'notifications.type',
  'notifications.user_id',
  'permissions.code',
  'permissions.created_at',
  'permissions.description',
  'permissions.id',
  'permissions.module',
  'refresh_tokens.created_at',
  'refresh_tokens.expires_at',
  'refresh_tokens.id',
  'refresh_tokens.ip_address',
  'refresh_tokens.revoked_at',
  'refresh_tokens.token_hash',
  'refresh_tokens.user_agent',
  'refresh_tokens.user_id',
  'role_permissions.permission_id',
  'role_permissions.role_id',
  'roles.code',
  'roles.created_at',
  'roles.description',
  'roles.id',
  'roles.name',
  'ticket_assignments.assigned_at',
  'ticket_assignments.assigned_by',
  'ticket_assignments.assignee_id',
  'ticket_assignments.id',
  'ticket_assignments.notes',
  'ticket_assignments.ticket_id',
  'ticket_assignments.unassigned_at',
  'ticket_attachments.checksum_sha256',
  'ticket_attachments.comment_id',
  'ticket_attachments.created_at',
  'ticket_attachments.file_size_bytes',
  'ticket_attachments.id',
  'ticket_attachments.mime_type',
  'ticket_attachments.original_filename',
  'ticket_attachments.storage_key',
  'ticket_attachments.ticket_id',
  'ticket_attachments.uploaded_by',
  'ticket_categories.code',
  'ticket_categories.created_at',
  'ticket_categories.description',
  'ticket_categories.id',
  'ticket_categories.is_active',
  'ticket_categories.name',
  'ticket_comments.author_id',
  'ticket_comments.body',
  'ticket_comments.created_at',
  'ticket_comments.deleted_at',
  'ticket_comments.id',
  'ticket_comments.is_internal',
  'ticket_comments.ticket_id',
  'ticket_comments.updated_at',
  'ticket_sla_policies.created_at',
  'ticket_sla_policies.id',
  'ticket_sla_policies.is_active',
  'ticket_sla_policies.name',
  'ticket_sla_policies.priority',
  'ticket_sla_policies.resolution_time_minutes',
  'ticket_sla_policies.response_time_minutes',
  'ticket_sla_policies.updated_at',
  'ticket_status_history.changed_at',
  'ticket_status_history.changed_by',
  'ticket_status_history.id',
  'ticket_status_history.new_status',
  'ticket_status_history.previous_status',
  'ticket_status_history.reason',
  'ticket_status_history.ticket_id',
  'tickets.asset_id',
  'tickets.assigned_to',
  'tickets.category_id',
  'tickets.channel',
  'tickets.closed_at',
  'tickets.created_at',
  'tickets.deleted_at',
  'tickets.description',
  'tickets.first_response_at',
  'tickets.id',
  'tickets.location_id',
  'tickets.priority',
  'tickets.requester_id',
  'tickets.resolution_due_at',
  'tickets.resolution_summary',
  'tickets.resolved_at',
  'tickets.response_due_at',
  'tickets.sla_policy_id',
  'tickets.status',
  'tickets.subject',
  'tickets.ticket_number',
  'tickets.updated_at',
  'user_roles.assigned_at',
  'user_roles.assigned_by',
  'user_roles.role_id',
  'user_roles.user_id',
  'users.created_at',
  'users.deleted_at',
  'users.department_id',
  'users.email',
  'users.email_verified_at',
  'users.employee_code',
  'users.failed_login_attempts',
  'users.full_name',
  'users.id',
  'users.is_active',
  'users.last_login_at',
  'users.locked_until',
  'users.password_hash',
  'users.phone',
  'users.updated_at',
  'vendors.address',
  'vendors.contact_person',
  'vendors.created_at',
  'vendors.email',
  'vendors.id',
  'vendors.name',
  'vendors.notes',
  'vendors.phone',
  'vendors.updated_at',
  'vendors.website',
]

const INITIAL_SCHEMA_SQL = `--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;




--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key character varying(120) NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    location_id uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    returned_at timestamp with time zone,
    notes text,
    CONSTRAINT asset_assignments_check CHECK (((returned_at IS NULL) OR (returned_at >= assigned_at)))
);


--
-- Name: asset_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    maintenance_type character varying(30) NOT NULL,
    status character varying(30) DEFAULT 'SCHEDULED'::character varying NOT NULL,
    title character varying(180) NOT NULL,
    description text,
    vendor_id uuid,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cost numeric(14,2),
    performed_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_maintenance_cost_check CHECK (((cost IS NULL) OR (cost >= (0)::numeric))),
    CONSTRAINT asset_maintenance_maintenance_type_check CHECK (((maintenance_type)::text = ANY ((ARRAY['PREVENTIVE'::character varying, 'CORRECTIVE'::character varying, 'INSPECTION'::character varying, 'UPGRADE'::character varying])::text[]))),
    CONSTRAINT asset_maintenance_status_check CHECK (((status)::text = ANY ((ARRAY['SCHEDULED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: asset_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    previous_status character varying(30),
    new_status character varying(30) NOT NULL,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_tag character varying(60) NOT NULL,
    name character varying(180) NOT NULL,
    category_id uuid NOT NULL,
    manufacturer character varying(120),
    model character varying(120),
    serial_number character varying(150),
    description text,
    status character varying(30) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    condition character varying(30) DEFAULT 'GOOD'::character varying NOT NULL,
    vendor_id uuid,
    purchase_date date,
    purchase_cost numeric(14,2),
    warranty_start date,
    warranty_end date,
    location_id uuid,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT assets_check CHECK (((warranty_start IS NULL) OR (warranty_end IS NULL) OR (warranty_end >= warranty_start))),
    CONSTRAINT assets_condition_check CHECK (((condition)::text = ANY ((ARRAY['NEW'::character varying, 'GOOD'::character varying, 'FAIR'::character varying, 'POOR'::character varying, 'DAMAGED'::character varying])::text[]))),
    CONSTRAINT assets_purchase_cost_check CHECK (((purchase_cost IS NULL) OR (purchase_cost >= (0)::numeric))),
    CONSTRAINT assets_status_check CHECK (((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'ASSIGNED'::character varying, 'IN_REPAIR'::character varying, 'DAMAGED'::character varying, 'LOST'::character varying, 'RETIRED'::character varying, 'DISPOSED'::character varying])::text[])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid,
    old_values jsonb,
    new_values jsonb,
    request_id character varying(100),
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_audit_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audit_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inventory_audit_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    expected_location_id uuid,
    actual_location_id uuid,
    expected_status character varying(30),
    actual_status character varying(30),
    physical_condition character varying(30),
    verification_status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    verified_by uuid,
    verified_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_audit_items_physical_condition_check CHECK (((physical_condition IS NULL) OR ((physical_condition)::text = ANY ((ARRAY['NEW'::character varying, 'GOOD'::character varying, 'FAIR'::character varying, 'POOR'::character varying, 'DAMAGED'::character varying])::text[])))),
    CONSTRAINT inventory_audit_items_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'MATCHED'::character varying, 'MISMATCHED'::character varying, 'NOT_FOUND'::character varying, 'UNREGISTERED'::character varying])::text[])))
);


--
-- Name: inventory_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    audit_number character varying(60) NOT NULL,
    title character varying(180) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'PLANNED'::character varying NOT NULL,
    location_id uuid,
    scheduled_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by uuid,
    reviewed_by uuid,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_audits_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    building character varying(100),
    floor character varying(30),
    room character varying(50),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(80) NOT NULL,
    title character varying(180) NOT NULL,
    message text NOT NULL,
    resource_type character varying(80),
    resource_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(100) NOT NULL,
    module character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address inet,
    user_agent text
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    assignee_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    unassigned_at timestamp with time zone,
    notes text,
    CONSTRAINT ticket_assignments_check CHECK (((unassigned_at IS NULL) OR (unassigned_at >= assigned_at)))
);


--
-- Name: ticket_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    comment_id uuid,
    uploaded_by uuid NOT NULL,
    original_filename character varying(255) NOT NULL,
    storage_key text NOT NULL,
    mime_type character varying(150) NOT NULL,
    file_size_bytes bigint NOT NULL,
    checksum_sha256 character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_attachments_file_size_bytes_check CHECK ((file_size_bytes > 0))
);


--
-- Name: ticket_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT ticket_comments_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: ticket_sla_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    priority character varying(20) NOT NULL,
    response_time_minutes integer NOT NULL,
    resolution_time_minutes integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_sla_policies_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT ticket_sla_policies_resolution_time_minutes_check CHECK ((resolution_time_minutes > 0)),
    CONSTRAINT ticket_sla_policies_response_time_minutes_check CHECK ((response_time_minutes > 0))
);


--
-- Name: ticket_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    previous_status character varying(30),
    new_status character varying(30) NOT NULL,
    changed_by uuid,
    reason text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number bigint NOT NULL,
    subject character varying(200) NOT NULL,
    description text NOT NULL,
    requester_id uuid NOT NULL,
    assigned_to uuid,
    category_id uuid,
    asset_id uuid,
    sla_policy_id uuid,
    priority character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
    status character varying(30) DEFAULT 'OPEN'::character varying NOT NULL,
    channel character varying(20) DEFAULT 'WEB'::character varying NOT NULL,
    response_due_at timestamp with time zone,
    resolution_due_at timestamp with time zone,
    first_response_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    location_id uuid,
    resolution_summary text,
    CONSTRAINT tickets_channel_check CHECK (((channel)::text = ANY ((ARRAY['WEB'::character varying, 'EMAIL'::character varying, 'PHONE'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT tickets_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying, 'PENDING'::character varying, 'RESOLVED'::character varying, 'CLOSED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: tickets_ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.tickets ALTER COLUMN ticket_number ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.tickets_ticket_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);




--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_code character varying(50),
    full_name character varying(150) NOT NULL,
    email character varying(254) NOT NULL,
    password_hash text NOT NULL,
    phone character varying(30),
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT users_failed_login_attempts_check CHECK ((failed_login_attempts >= 0))
);


--
-- Name: v_asset_inventory; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_asset_inventory AS
 SELECT a.id AS asset_id,
    a.asset_tag,
    a.name AS asset_name,
    c.name AS category_name,
    a.manufacturer,
    a.model,
    a.serial_number,
    a.status,
    a.condition,
    l.name AS location_name,
    u.id AS assigned_user_id,
    u.full_name AS assigned_user_name,
    a.warranty_end,
    a.created_at,
    a.updated_at
   FROM ((((public.assets a
     JOIN public.asset_categories c ON ((c.id = a.category_id)))
     LEFT JOIN public.locations l ON ((l.id = a.location_id)))
     LEFT JOIN public.asset_assignments aa ON (((aa.asset_id = a.id) AND (aa.returned_at IS NULL))))
     LEFT JOIN public.users u ON ((u.id = aa.user_id)))
  WHERE (a.deleted_at IS NULL);


--
-- Name: v_asset_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_asset_summary AS
 SELECT count(*) AS total_assets,
    count(*) FILTER (WHERE ((status)::text = 'AVAILABLE'::text)) AS available_assets,
    count(*) FILTER (WHERE ((status)::text = 'ASSIGNED'::text)) AS assigned_assets,
    count(*) FILTER (WHERE ((status)::text = 'IN_REPAIR'::text)) AS assets_in_repair,
    count(*) FILTER (WHERE ((status)::text = 'DAMAGED'::text)) AS damaged_assets,
    count(*) FILTER (WHERE ((status)::text = 'LOST'::text)) AS lost_assets,
    count(*) FILTER (WHERE ((status)::text = 'RETIRED'::text)) AS retired_assets
   FROM public.assets
  WHERE (deleted_at IS NULL);


--
-- Name: v_ticket_overview; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ticket_overview AS
 SELECT t.id,
    t.ticket_number,
    t.subject,
    t.priority,
    t.status,
    t.created_at,
    t.updated_at,
    requester.full_name AS requester_name,
    technician.full_name AS assigned_technician,
    tc.name AS category_name,
    a.asset_tag,
    a.name AS asset_name,
    t.response_due_at,
    t.resolution_due_at
   FROM ((((public.tickets t
     JOIN public.users requester ON ((requester.id = t.requester_id)))
     LEFT JOIN public.users technician ON ((technician.id = t.assigned_to)))
     LEFT JOIN public.ticket_categories tc ON ((tc.id = t.category_id)))
     LEFT JOIN public.assets a ON ((a.id = t.asset_id)))
  WHERE (t.deleted_at IS NULL);


--
-- Name: v_ticket_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_ticket_summary AS
 SELECT count(*) AS total_tickets,
    count(*) FILTER (WHERE ((status)::text = 'OPEN'::text)) AS open_tickets,
    count(*) FILTER (WHERE ((status)::text = 'IN_PROGRESS'::text)) AS in_progress_tickets,
    count(*) FILTER (WHERE ((status)::text = 'PENDING'::text)) AS pending_tickets,
    count(*) FILTER (WHERE ((status)::text = 'RESOLVED'::text)) AS resolved_tickets,
    count(*) FILTER (WHERE ((status)::text = 'CLOSED'::text)) AS closed_tickets,
    count(*) FILTER (WHERE ((response_due_at < now()) AND (first_response_at IS NULL) AND ((status)::text <> ALL ((ARRAY['RESOLVED'::character varying, 'CLOSED'::character varying, 'CANCELLED'::character varying])::text[])))) AS overdue_responses,
    count(*) FILTER (WHERE ((resolution_due_at < now()) AND (resolved_at IS NULL) AND ((status)::text <> ALL ((ARRAY['CLOSED'::character varying, 'CANCELLED'::character varying])::text[])))) AS overdue_resolutions
   FROM public.tickets
  WHERE (deleted_at IS NULL);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(180) NOT NULL,
    contact_person character varying(150),
    email character varying(254),
    phone character varying(30),
    address text,
    website text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: asset_assignments asset_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_pkey PRIMARY KEY (id);


--
-- Name: asset_categories asset_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_code_key UNIQUE (code);


--
-- Name: asset_categories asset_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_categories
    ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);


--
-- Name: asset_maintenance asset_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_pkey PRIMARY KEY (id);


--
-- Name: asset_status_history asset_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_history
    ADD CONSTRAINT asset_status_history_pkey PRIMARY KEY (id);


--
-- Name: assets assets_asset_tag_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_serial_number_key UNIQUE (serial_number);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: inventory_audit_items inventory_audit_items_inventory_audit_id_asset_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_inventory_audit_id_asset_id_key UNIQUE (inventory_audit_id, asset_id);


--
-- Name: inventory_audit_items inventory_audit_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_audits inventory_audits_audit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_audit_number_key UNIQUE (audit_number);


--
-- Name: inventory_audits inventory_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_pkey PRIMARY KEY (id);


--
-- Name: locations locations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_code_key UNIQUE (code);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: ticket_assignments ticket_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);


--
-- Name: ticket_attachments ticket_attachments_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_storage_key_key UNIQUE (storage_key);


--
-- Name: ticket_categories ticket_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_code_key UNIQUE (code);


--
-- Name: ticket_categories ticket_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_categories
    ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: ticket_sla_policies ticket_sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_sla_policies
    ADD CONSTRAINT ticket_sla_policies_pkey PRIMARY KEY (id);


--
-- Name: ticket_status_history ticket_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_code_key UNIQUE (employee_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: idx_asset_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_assignments_user ON public.asset_assignments USING btree (user_id, assigned_at DESC);


--
-- Name: idx_asset_maintenance_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_maintenance_asset ON public.asset_maintenance USING btree (asset_id, created_at DESC);


--
-- Name: idx_asset_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_maintenance_status ON public.asset_maintenance USING btree (status, scheduled_at);


--
-- Name: idx_asset_status_history_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_status_history_asset ON public.asset_status_history USING btree (asset_id, changed_at DESC);


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_category ON public.assets USING btree (category_id);


--
-- Name: idx_assets_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_location ON public.assets USING btree (location_id);


--
-- Name: idx_assets_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_name ON public.assets USING btree (name);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assets_warranty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_warranty ON public.assets USING btree (warranty_end) WHERE (deleted_at IS NULL);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);


--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id, created_at DESC);


--
-- Name: idx_inventory_audit_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_audit_items_status ON public.inventory_audit_items USING btree (inventory_audit_id, verification_status);


--
-- Name: idx_inventory_audits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_audits_status ON public.inventory_audits USING btree (status, scheduled_at);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: idx_refresh_tokens_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expiry ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_ticket_assignments_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_assignments_assignee ON public.ticket_assignments USING btree (assignee_id, assigned_at DESC);


--
-- Name: idx_ticket_attachments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_attachments_ticket ON public.ticket_attachments USING btree (ticket_id);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id, created_at);


--
-- Name: idx_ticket_status_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_status_history ON public.ticket_status_history USING btree (ticket_id, changed_at DESC);


--
-- Name: idx_tickets_asset; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_asset ON public.tickets USING btree (asset_id);


--
-- Name: idx_tickets_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_assignee ON public.tickets USING btree (assigned_to, status, created_at DESC);


--
-- Name: idx_tickets_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_category ON public.tickets USING btree (category_id);


--
-- Name: idx_tickets_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_location ON public.tickets USING btree (location_id);


--
-- Name: idx_tickets_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_requester ON public.tickets USING btree (requester_id, created_at DESC);


--
-- Name: idx_tickets_sla_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sla_resolution ON public.tickets USING btree (resolution_due_at) WHERE ((resolved_at IS NULL) AND ((status)::text <> ALL ((ARRAY['CLOSED'::character varying, 'CANCELLED'::character varying])::text[])));


--
-- Name: idx_tickets_sla_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_sla_response ON public.tickets USING btree (response_due_at) WHERE ((first_response_at IS NULL) AND ((status)::text <> ALL ((ARRAY['RESOLVED'::character varying, 'CLOSED'::character varying, 'CANCELLED'::character varying])::text[])));


--
-- Name: idx_tickets_status_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tickets_status_priority ON public.tickets USING btree (status, priority, created_at DESC);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role_id);


--
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_department ON public.users USING btree (department_id);


--
-- Name: uq_asset_current_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_asset_current_assignment ON public.asset_assignments USING btree (asset_id) WHERE (returned_at IS NULL);


--
-- Name: uq_assets_serial_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_assets_serial_active ON public.assets USING btree (serial_number) WHERE ((serial_number IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: uq_ticket_current_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ticket_current_assignment ON public.ticket_assignments USING btree (ticket_id) WHERE (unassigned_at IS NULL);


--
-- Name: uq_users_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_email_active ON public.users USING btree (lower((email)::text)) WHERE (deleted_at IS NULL);


--
-- Name: app_settings trg_app_settings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asset_maintenance trg_asset_maintenance_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_asset_maintenance_updated BEFORE UPDATE ON public.asset_maintenance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: assets trg_assets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: departments trg_departments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_audits trg_inventory_audits_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_audits_updated BEFORE UPDATE ON public.inventory_audits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: locations trg_locations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_locations_updated BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ticket_comments trg_ticket_comments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ticket_comments_updated BEFORE UPDATE ON public.ticket_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ticket_sla_policies trg_ticket_sla_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ticket_sla_updated BEFORE UPDATE ON public.ticket_sla_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tickets trg_tickets_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: vendors trg_vendors_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: asset_assignments asset_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: asset_assignments asset_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_assignments
    ADD CONSTRAINT asset_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: asset_maintenance asset_maintenance_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: asset_maintenance asset_maintenance_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_maintenance asset_maintenance_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asset_maintenance asset_maintenance_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: asset_status_history asset_status_history_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_history
    ADD CONSTRAINT asset_status_history_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: asset_status_history asset_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_history
    ADD CONSTRAINT asset_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assets assets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.asset_categories(id) ON DELETE RESTRICT;


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assets assets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: assets assets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assets assets_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_audit_items inventory_audit_items_actual_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_actual_location_id_fkey FOREIGN KEY (actual_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_audit_items inventory_audit_items_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: inventory_audit_items inventory_audit_items_expected_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_expected_location_id_fkey FOREIGN KEY (expected_location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_audit_items inventory_audit_items_inventory_audit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_inventory_audit_id_fkey FOREIGN KEY (inventory_audit_id) REFERENCES public.inventory_audits(id) ON DELETE RESTRICT;


--
-- Name: inventory_audit_items inventory_audit_items_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audit_items
    ADD CONSTRAINT inventory_audit_items_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_audits inventory_audits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_audits inventory_audits_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;


--
-- Name: inventory_audits inventory_audits_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_audits
    ADD CONSTRAINT inventory_audits_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: ticket_assignments ticket_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_assignments ticket_assignments_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_assignments ticket_assignments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;


--
-- Name: ticket_attachments ticket_attachments_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.ticket_comments(id) ON DELETE RESTRICT;


--
-- Name: ticket_attachments ticket_attachments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;


--
-- Name: ticket_attachments ticket_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_attachments
    ADD CONSTRAINT ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_comments ticket_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;


--
-- Name: ticket_status_history ticket_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ticket_status_history ticket_status_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_status_history
    ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id) ON DELETE SET NULL;


--
-- Name: tickets tickets_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: tickets tickets_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.ticket_sla_policies(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--`

export class InitialSchema1792392190000 implements MigrationInterface {
  name = 'InitialSchema1792392190000'

  async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [INITIAL_SCHEMA_TABLES],
    )) as Array<{ table_name: string }>

    if (rows.length === INITIAL_SCHEMA_TABLES.length) {
      const columns = (await queryRunner.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])
         ORDER BY table_name, column_name`,
        [INITIAL_SCHEMA_TABLES],
      )) as Array<{ table_name: string; column_name: string }>
      const existingColumns = columns.map(
        (column) => `${column.table_name}.${column.column_name}`,
      )

      const existingColumnSet = new Set(existingColumns)
      if (
        !INITIAL_SCHEMA_COLUMNS.every((column) => existingColumnSet.has(column))
      ) {
        throw new Error(
          'Initial schema migration found an existing schema that is missing columns from the reviewed baseline',
        )
      }

      return
    }
    if (rows.length > 0) {
      throw new Error(
        'Initial schema migration found a partially populated database; refusing to modify it',
      )
    }

    await queryRunner.query(INITIAL_SCHEMA_SQL)
  }

  async down(): Promise<void> {
    throw new Error(
      'The initial schema migration is intentionally non-reversible; restore only into a separately verified database',
    )
  }
}
