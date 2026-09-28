export type AppRole = "admin" | "staff";
export type Skill = "cleaning" | "gardening" | "both";
export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type Recurrence = "none" | "weekly" | "fortnightly" | "monthly";
export type CareProvider = "AYS" | "GIHC" | "Aurora Home Care";

export type Profile = {
  user_id: string;
  role: AppRole;
  staff_id: string | null;
  org_id: string;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
  created_at: string;
};

export type JobRole = "Owner" | "Admin" | "Manager" | "Crew Leader" | "Staff";

export type Staff = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string;
  skill: Skill;
  color_hue: number;
  active: boolean;
  crew_id: string | null;
  job_role: JobRole;
  availability: boolean[];
  usual_hours: string;
  org_id: string;
  created_at: string;
};

export type Job = {
  id: string;
  num: string;
  client_name: string;
  address: string;
  job_type: Skill;
  job_date: string | null; // YYYY-MM-DD, null = unscheduled
  start_time: string | null; // HH:MM:SS, null = unscheduled
  duration_minutes: number;
  assigned_staff_id: string | null;
  status: JobStatus;
  price: number | null;
  notes: string;
  recurrence: Recurrence;
  series_id: string | null;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  property_id: string | null;
  crew_id: string | null;
  service_id: string | null;
  title: string;
  quote_id: string | null;
  checklist: { t: string; done: boolean }[];
  org_id: string;
};

export type ClientStatus = "Lead" | "Active" | "Inactive" | "Archived";

export type Client = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  job_type: Skill;
  care_provider: CareProvider | null;
  case_manager: string | null;
  hours_allocated: number | null;
  company: string | null;
  status: ClientStatus;
  tags: string[];
  lead_source: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  client_id: string;
  street: string;
  line2: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  org_id: string;
  created_at: string;
};

export type ClientContact = {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  org_id: string;
  created_at: string;
};

export type ClientNote = {
  id: string;
  client_id: string;
  text: string;
  staff_id: string | null;
  org_id: string;
  created_at: string;
};

export type Crew = {
  id: string;
  name: string;
  color_hex: string;
  tint_hex: string;
  lead_staff_id: string | null;
  org_id: string;
  created_at: string;
};

export type PricingType = "Fixed" | "Hourly" | "Per m2" | "Per load";
export type ServiceCategory = "Gardening" | "Cleaning" | "Other";

export type RequestStatus = "New" | "Contacted" | "Quoted" | "Converted" | "Closed";

export type GstMode = "inclusive" | "exclusive";
export type QuoteStatus = "Draft" | "Sent" | "Approved" | "Declined" | "Expired";

export type QuoteItem = {
  id: string;
  quote_id: string;
  service_id: string | null;
  service_name: string;
  description: string;
  qty: number;
  unit_price: number;
  sort_order: number;
  org_id: string;
};

export type Quote = {
  id: string;
  num: string;
  client_id: string;
  property_id: string | null;
  quote_date: string;
  expiry_date: string;
  mode: GstMode;
  status: QuoteStatus;
  message: string;
  request_id: string | null;
  job_id: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceStatus = "Draft" | "Sent" | "Partially Paid" | "Paid" | "Overdue" | "Voided";

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  service_id: string | null;
  service_name: string;
  description: string;
  qty: number;
  unit_price: number;
  sort_order: number;
  org_id: string;
};

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  paid_date: string;
  method: string;
  reference: string;
  org_id: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  num: string;
  client_id: string;
  property_id: string | null;
  job_id: string | null;
  issue_date: string;
  due_date: string;
  mode: GstMode;
  status: InvoiceStatus;
  notes: string;
  org_id: string;
  created_at: string;
  updated_at: string;
};

export type ServiceRequest = {
  id: string;
  num: string;
  client_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service_id: string | null;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  status: RequestStatus;
  preferred_date: string | null;
  description: string;
  source: string;
  org_id: string;
  received_at: string;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  pricing_type: PricingType;
  duration_minutes: number;
  default_crew_id: string | null;
  category: ServiceCategory | null;
  active: boolean;
  org_id: string;
  created_at: string;
};

export type EquipmentStatus = "In service" | "Needs service" | "Out of service";

export type Equipment = {
  id: string;
  name: string;
  model: string;
  serial: string;
  crew_id: string | null;
  status: EquipmentStatus;
  next_service_date: string | null;
  org_id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Partial<Organization> & Pick<Organization, "name">;
        Update: Partial<Organization>;
        Relationships: [];
      };
      staff: {
        Row: Staff;
        Insert: Partial<Staff> & Pick<Staff, "name" | "email" | "org_id">;
        Update: Partial<Staff>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "user_id" | "org_id">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      jobs: {
        Row: Job;
        Insert: Partial<Job> & Pick<Job, "client_name" | "address" | "job_date" | "start_time" | "org_id">;
        Update: Partial<Job>;
        Relationships: [];
      };
      clients: {
        Row: Client;
        Insert: Partial<Client> & Pick<Client, "name" | "org_id">;
        Update: Partial<Client>;
        Relationships: [];
      };
      properties: {
        Row: Property;
        Insert: Partial<Property> & Pick<Property, "client_id" | "org_id">;
        Update: Partial<Property>;
        Relationships: [];
      };
      client_contacts: {
        Row: ClientContact;
        Insert: Partial<ClientContact> & Pick<ClientContact, "client_id" | "name" | "org_id">;
        Update: Partial<ClientContact>;
        Relationships: [];
      };
      client_notes: {
        Row: ClientNote;
        Insert: Partial<ClientNote> & Pick<ClientNote, "client_id" | "text" | "org_id">;
        Update: Partial<ClientNote>;
        Relationships: [];
      };
      crews: {
        Row: Crew;
        Insert: Partial<Crew> & Pick<Crew, "name" | "org_id">;
        Update: Partial<Crew>;
        Relationships: [];
      };
      services: {
        Row: Service;
        Insert: Partial<Service> & Pick<Service, "name" | "org_id">;
        Update: Partial<Service>;
        Relationships: [];
      };
      requests: {
        Row: ServiceRequest;
        Insert: Partial<ServiceRequest> & Pick<ServiceRequest, "num" | "name" | "org_id">;
        Update: Partial<ServiceRequest>;
        Relationships: [];
      };
      quotes: {
        Row: Quote;
        Insert: Partial<Quote> & Pick<Quote, "num" | "client_id" | "org_id">;
        Update: Partial<Quote>;
        Relationships: [];
      };
      quote_items: {
        Row: QuoteItem;
        Insert: Partial<QuoteItem> & Pick<QuoteItem, "quote_id" | "org_id">;
        Update: Partial<QuoteItem>;
        Relationships: [];
      };
      invoices: {
        Row: Invoice;
        Insert: Partial<Invoice> & Pick<Invoice, "num" | "client_id" | "org_id">;
        Update: Partial<Invoice>;
        Relationships: [];
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Partial<InvoiceItem> & Pick<InvoiceItem, "invoice_id" | "org_id">;
        Update: Partial<InvoiceItem>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & Pick<Payment, "invoice_id" | "amount" | "org_id">;
        Update: Partial<Payment>;
        Relationships: [];
      };
      equipment: {
        Row: Equipment;
        Insert: Partial<Equipment> & Pick<Equipment, "name" | "org_id">;
        Update: Partial<Equipment>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
