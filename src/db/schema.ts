import { relations } from 'drizzle-orm';
import {
  AnyMySqlColumn,
  boolean,
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

export const userRoles = ['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin'] as const;
export const userStatuses = ['PENDING_VERIFICATION', 'ACTIVE', 'REJECTED'] as const;
export const travelStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'COMPLETED'] as const;
export const approvalStatuses = ['APPROVED', 'REJECTED'] as const;
export const reimbursementStatuses = ['SUBMITTED', 'NEEDS_DOCUMENTS', 'VERIFIED', 'PAID', 'REJECTED'] as const;
export const transportationModes = ['Pesawat', 'Kereta Api', 'Travel', 'Mobil Kantor'] as const;
export const cashAdvanceStatuses = ['WAITING_PAYMENT', 'DISBURSED'] as const;

export const roleEnum = mysqlEnum('role', userRoles);
export const userStatusEnum = mysqlEnum('status', userStatuses);
export const travelStatusEnum = mysqlEnum('status', travelStatuses);
export const approvalStatusEnum = mysqlEnum('status', approvalStatuses);
export const reimbursementStatusEnum = mysqlEnum('status', reimbursementStatuses);
export const transportationModeEnum = mysqlEnum('transportation_mode', transportationModes);
export const cashAdvanceStatusEnum = mysqlEnum('status', cashAdvanceStatuses);

export type UserRole = (typeof userRoles)[number];
export type UserStatus = (typeof userStatuses)[number];
export type TravelStatus = (typeof travelStatuses)[number];
export type ApprovalStatus = (typeof approvalStatuses)[number];
export type ReimbursementStatus = (typeof reimbursementStatuses)[number];
export type TransportationMode = (typeof transportationModes)[number];
export type CashAdvanceStatus = (typeof cashAdvanceStatuses)[number];

export const companies = mysqlTable('companies', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  company_code: varchar('company_code', { length: 100 }).notNull().unique(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  company_id: int('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  supervisor_id: int('supervisor_id').references((): AnyMySqlColumn => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nik: varchar('nik', { length: 50 }),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum.notNull(),
  department: varchar('department', { length: 255 }).notNull(),
  status: userStatusEnum.notNull().default('PENDING_VERIFICATION'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const travelRequests = mysqlTable('travel_requests', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  destination: varchar('destination', { length: 255 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  estimated_cost: decimal('estimated_cost', { precision: 12, scale: 2 }),
  purpose: text('purpose').notNull(),
  transportation_mode: transportationModeEnum,
  document_url: text('document_url'),
  status: travelStatusEnum.notNull().default('PENDING'),
  lpj_completed_at: timestamp('lpj_completed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const cashAdvances = mysqlTable('cash_advances', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  estimated_cost: decimal('estimated_cost', { precision: 10, scale: 2 }).notNull(),
  requested_amount: decimal('requested_amount', { precision: 10, scale: 2 }).notNull(),
  returned_amount: decimal('returned_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  status: cashAdvanceStatusEnum.notNull().default('WAITING_PAYMENT'),
  payment_date: timestamp('payment_date'),
  payment_reference: varchar('payment_reference', { length: 100 }),
  payment_method: varchar('payment_method', { length: 100 }),
  processed_by: int('processed_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const travelApprovals = mysqlTable('travel_approvals', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  approver_id: int('approver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: approvalStatusEnum.notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const travelFulfillments = mysqlTable('travel_fulfillments', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  transport_details: text('transport_details').notNull(),
  accommodation_details: text('accommodation_details').notNull(),
  admin_id: int('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const travelBookings = mysqlTable('travel_bookings', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  booking_code: varchar('booking_code', { length: 100 }).notNull().unique(),
  transportation_mode: transportationModeEnum.notNull(),
  operator: varchar('operator', { length: 255 }),
  departure_at: timestamp('departure_at'),
  arrival_at: timestamp('arrival_at'),
  hotel_name: varchar('hotel_name', { length: 255 }),
  room_type: varchar('room_type', { length: 255 }),
  check_in_date: date('check_in_date'),
  check_out_date: date('check_out_date'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  travelRequestUnique: uniqueIndex('travel_bookings_travel_request_id_unique').on(table.travel_request_id),
}));

export const reimbursements = mysqlTable('reimbursements', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  total_amount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  status: reimbursementStatusEnum.notNull().default('SUBMITTED'),
  payment_date: timestamp('payment_date'),
  payment_reference: varchar('payment_reference', { length: 100 }),
  payment_method: varchar('payment_method', { length: 100 }),
  processed_by: int('processed_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const financeSettings = mysqlTable('finance_settings', {
  id: int('id').autoincrement().primaryKey(),
  annual_budget: decimal('annual_budget', { precision: 14, scale: 2 }).notNull(),
  payment_methods: text('payment_methods').notNull(),
  updated_by: int('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const reimbursementItems = mysqlTable('reimbursement_items', {
  id: int('id').autoincrement().primaryKey(),
  reimbursement_id: int('reimbursement_id').notNull().references(() => reimbursements.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  receipt_url: text('receipt_url'),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.company_id],
    references: [companies.id],
  }),
  travelRequests: many(travelRequests),
  cashAdvances: many(cashAdvances),
  approvals: many(travelApprovals),
  fulfillments: many(travelFulfillments),
  bookings: many(travelBookings),
  reimbursements: many(reimbursements),
}));

export const travelRequestsRelations = relations(travelRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [travelRequests.user_id],
    references: [users.id],
  }),
  approvals: many(travelApprovals),
  fulfillment: many(travelFulfillments),
  booking: one(travelBookings),
  reimbursement: many(reimbursements),
  cashAdvances: many(cashAdvances),
}));

export const cashAdvancesRelations = relations(cashAdvances, ({ one }) => ({
  travelRequest: one(travelRequests, {
    fields: [cashAdvances.travel_request_id],
    references: [travelRequests.id],
  }),
  user: one(users, {
    fields: [cashAdvances.user_id],
    references: [users.id],
  }),
}));

export const travelApprovalsRelations = relations(travelApprovals, ({ one }) => ({
  travelRequest: one(travelRequests, {
    fields: [travelApprovals.travel_request_id],
    references: [travelRequests.id],
  }),
  approver: one(users, {
    fields: [travelApprovals.approver_id],
    references: [users.id],
  }),
}));

export const travelFulfillmentsRelations = relations(travelFulfillments, ({ one }) => ({
  travelRequest: one(travelRequests, {
    fields: [travelFulfillments.travel_request_id],
    references: [travelRequests.id],
  }),
  admin: one(users, {
    fields: [travelFulfillments.admin_id],
    references: [users.id],
  }),
}));

export const travelBookingsRelations = relations(travelBookings, ({ one }) => ({
  travelRequest: one(travelRequests, {
    fields: [travelBookings.travel_request_id],
    references: [travelRequests.id],
  }),
  user: one(users, {
    fields: [travelBookings.user_id],
    references: [users.id],
  }),
}));

export const reimbursementsRelations = relations(reimbursements, ({ one, many }) => ({
  travelRequest: one(travelRequests, {
    fields: [reimbursements.travel_request_id],
    references: [travelRequests.id],
  }),
  user: one(users, {
    fields: [reimbursements.user_id],
    references: [users.id],
  }),
  items: many(reimbursementItems),
}));

export const reimbursementItemsRelations = relations(reimbursementItems, ({ one }) => ({
  reimbursement: one(reimbursements, {
    fields: [reimbursementItems.reimbursement_id],
    references: [reimbursements.id],
  }),
}));
