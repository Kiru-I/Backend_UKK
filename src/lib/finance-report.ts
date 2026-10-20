import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { cashAdvances, reimbursements, travelRequests, users } from '../db/schema';

export async function getFinanceTransactions() {
  const [reimbursementRows, advanceRows] = await Promise.all([
    db.select({
      id: reimbursements.id,
      applicant_id: users.id,
      applicant_name: users.name,
      applicant_role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: reimbursements.total_amount,
      requested_at: reimbursements.created_at,
      status: reimbursements.status,
      payment_date: reimbursements.payment_date,
      payment_reference: reimbursements.payment_reference,
      payment_method: reimbursements.payment_method,
      processed_by: reimbursements.processed_by,
    })
      .from(reimbursements)
      .innerJoin(users, eq(reimbursements.user_id, users.id))
      .innerJoin(travelRequests, eq(reimbursements.travel_request_id, travelRequests.id))
      .orderBy(asc(reimbursements.created_at)),
    db.select({
      id: cashAdvances.id,
      applicant_id: users.id,
      applicant_name: users.name,
      applicant_role: users.role,
      department: users.department,
      destination: travelRequests.destination,
      amount: cashAdvances.requested_amount,
      requested_at: cashAdvances.created_at,
      status: cashAdvances.status,
      payment_date: cashAdvances.payment_date,
      payment_reference: cashAdvances.payment_reference,
      payment_method: cashAdvances.payment_method,
      processed_by: cashAdvances.processed_by,
    })
      .from(cashAdvances)
      .innerJoin(users, eq(cashAdvances.user_id, users.id))
      .innerJoin(travelRequests, eq(cashAdvances.travel_request_id, travelRequests.id))
      .orderBy(asc(cashAdvances.created_at)),
  ]);

  const transactions = [
    ...reimbursementRows.map((row) => ({
      transaction_id: `REIMBURSEMENT-${row.id}`,
      id: row.id,
      transaction_type: 'REIMBURSEMENT' as const,
      applicant_id: row.applicant_id,
      applicant_name: row.applicant_name,
      role: row.applicant_role,
      department: row.department,
      destination: row.destination,
      amount: row.amount,
      requested_at: row.requested_at,
      approval_status: row.status === 'SUBMITTED'
        ? 'PENDING_VERIFICATION'
        : row.status === 'NEEDS_DOCUMENTS'
          ? 'NEEDS_DOCUMENTS'
          : row.status === 'REJECTED'
            ? 'REJECTED'
            : 'VERIFIED',
      payment_status: row.status === 'PAID'
        ? 'PAID'
        : row.status === 'VERIFIED'
          ? 'WAITING_PAYMENT'
          : 'NOT_READY',
      status: row.status,
      payment_date: row.payment_date,
      payment_reference: row.payment_reference,
      payment_method: row.payment_method,
      processed_by: row.processed_by,
      actual_expense: row.status === 'PAID' ? row.amount : '0.00',
    })),
    ...advanceRows.map((row) => ({
      transaction_id: `CASH_ADVANCE-${row.id}`,
      id: row.id,
      transaction_type: 'CASH_ADVANCE' as const,
      applicant_id: row.applicant_id,
      applicant_name: row.applicant_name,
      role: row.applicant_role,
      department: row.department,
      destination: row.destination,
      amount: row.amount,
      requested_at: row.requested_at,
      approval_status: 'NOT_REQUIRED',
      payment_status: row.status,
      status: row.status,
      payment_date: row.payment_date,
      payment_reference: row.payment_reference,
      payment_method: row.payment_method,
      processed_by: row.processed_by,
      actual_expense: row.status === 'DISBURSED' ? row.amount : '0.00',
    })),
  ];

  transactions.sort((left, right) =>
    new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime()
  );
  return transactions;
}
