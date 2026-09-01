import { relations } from 'drizzle-orm';
import {
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const userRoles = ['Karyawan', 'Atasan', 'Admin Travel', 'Tim Keuangan', 'Super Admin'] as const;
export const travelStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'COMPLETED'] as const;
export const approvalStatuses = ['APPROVED', 'REJECTED'] as const;
export const reimbursementStatuses = ['SUBMITTED', 'VERIFIED', 'PAID', 'REJECTED'] as const;

export const roleEnum = mysqlEnum('role', userRoles);
export const travelStatusEnum = mysqlEnum('status', travelStatuses);
export const approvalStatusEnum = mysqlEnum('status', approvalStatuses);
export const reimbursementStatusEnum = mysqlEnum('status', reimbursementStatuses);

export type UserRole = (typeof userRoles)[number];
export type TravelStatus = (typeof travelStatuses)[number];
export type ApprovalStatus = (typeof approvalStatuses)[number];
export type ReimbursementStatus = (typeof reimbursementStatuses)[number];

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum.notNull(),
  department: varchar('department', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const travelRequests = mysqlTable('travel_requests', {
  id: int('id').autoincrement().primaryKey(),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  destination: varchar('destination', { length: 255 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  purpose: text('purpose').notNull(),
  document_url: text('document_url'),
  status: travelStatusEnum.notNull().default('PENDING'),
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

export const reimbursements = mysqlTable('reimbursements', {
  id: int('id').autoincrement().primaryKey(),
  travel_request_id: int('travel_request_id').notNull().references(() => travelRequests.id, { onDelete: 'cascade' }),
  user_id: int('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  total_amount: decimal('total_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  status: reimbursementStatusEnum.notNull().default('SUBMITTED'),
  created_at: timestamp('created_at').defaultNow().notNull(),
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

export const usersRelations = relations(users, ({ many }) => ({
  travelRequests: many(travelRequests),
  approvals: many(travelApprovals),
  fulfillments: many(travelFulfillments),
  reimbursements: many(reimbursements),
}));

export const travelRequestsRelations = relations(travelRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [travelRequests.user_id],
    references: [users.id],
  }),
  approvals: many(travelApprovals),
  fulfillment: many(travelFulfillments),
  reimbursement: many(reimbursements),
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
