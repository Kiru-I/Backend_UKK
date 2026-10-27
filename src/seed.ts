import { asc, eq } from 'drizzle-orm';
import { db } from './db';
import {
  cashAdvances,
  companies,
  financeSettings,
  reimbursementItems,
  reimbursements,
  travelApprovals,
  travelBookings,
  travelFulfillments,
  travelRequests,
  users,
} from './db/schema';
import { hashPassword } from './lib/auth';

const companySeeds = [
  {
    name: 'PT Nuvix Sentosa',
    company_code: 'NUVIX-ALPHA-2026',
    is_active: true,
  },
  {
    name: 'PT Nuvix Global',
    company_code: 'NUVIX-BETA-2026',
    is_active: true,
  },
];

const departments = ['Engineering', 'Finance', 'HR', 'Sales', 'Operations', 'Logistik', 'Marketing', 'Product', 'IT', 'Legal'];
const destinations = ['Jakarta', 'Bandung', 'Yogyakarta', 'Surabaya', 'Bali', 'Singapore', 'Bangkok', 'Medan', 'Makassar', 'Balikpapan', 'Semarang', 'Palembang'];
const travelStatuses = ['FULFILLED', 'COMPLETED'] as const;
const reimbursementStatuses = ['SUBMITTED', 'NEEDS_DOCUMENTS', 'VERIFIED', 'PAID', 'REJECTED'] as const;
const cashAdvanceStatuses = ['WAITING_PAYMENT', 'DISBURSED'] as const;
type UserRoleSeed = 'Karyawan' | 'Atasan' | 'Admin Travel' | 'Tim Keuangan' | 'Super Admin';
type TransportationModeSeed = 'Pesawat' | 'Kereta Api' | 'Travel' | 'Mobil Kantor';

function buildUserSeed(companyId: number, companyIndex: number, userIndex: number): {
  company_id: number;
  name: string;
  email: string;
  nik: string;
  password: string;
  role: UserRoleSeed;
  department: string;
  status: 'ACTIVE';
} {
  const firstNames = ['Ayu', 'Budi', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gita', 'Hendra', 'Indra', 'Jasmine'];
  const lastNames = ['Santoso', 'Wijaya', 'Rahmadani', 'Pratama', 'Nugraha', 'Lestari', 'Hidayat', 'Permata', 'Ramadhan', 'Gunawan'];
  const companyCode = companySeeds[companyIndex].company_code.toLowerCase().replace(/[^a-z0-9]/g, '');
  const role = userIndex === 0 ? 'Super Admin' : userIndex <= 2 ? 'Atasan' : userIndex <= 4 ? 'Admin Travel' : userIndex <= 6 ? 'Tim Keuangan' : 'Karyawan';

  return {
    company_id: companyId,
    name: `${firstNames[userIndex]} ${lastNames[(userIndex + companyIndex) % lastNames.length]}`,
    email: `user${String(userIndex + 1).padStart(2, '0')}${companyIndex + 1}@${companyCode}.local`,
    nik: `320${String(companyIndex + 1).padStart(2, '0')}${String(userIndex + 1).padStart(3, '0')}${String((companyIndex + 1) * (userIndex + 3)).padStart(3, '0')}`,
    password: `Password${companyIndex + 1}!${userIndex + 1}`,
    role,
    department: departments[(companyIndex + userIndex) % departments.length],
    status: 'ACTIVE' as const,
  };
}

function buildTravelSeed(userId: number, companyIndex: number, userIndex: number, requestIndex: number): {
  user_id: number;
  destination: string;
  start_date: Date;
  end_date: Date;
  estimated_cost: string;
  purpose: string;
  transportation_mode: TransportationModeSeed;
  document_url: string;
  status: (typeof travelStatuses)[number];
  lpj_completed_at: Date | null;
} {
  const destination = destinations[(companyIndex * 2 + userIndex + requestIndex) % destinations.length];
  const status = requestIndex === 4 ? 'COMPLETED' : 'FULFILLED';
  const startDate = new Date(Date.UTC(2026, 1 + requestIndex, 5 + userIndex, 0, 0, 0));
  const endDate = new Date(Date.UTC(2026, 1 + requestIndex, 7 + userIndex + requestIndex, 0, 0, 0));
  const transportationModes: TransportationModeSeed[] = ['Pesawat', 'Kereta Api', 'Travel', 'Mobil Kantor'];

  return {
    user_id: userId,
    destination,
    start_date: startDate,
    end_date: endDate,
    estimated_cost: String(7000000 + requestIndex * 750000 + userIndex * 100000),
    purpose: `Kegiatan ${requestIndex + 1} untuk ${destination} dengan kebutuhan operasional dan koordinasi internal perusahaan.`,
    transportation_mode: transportationModes[(userIndex + requestIndex + companyIndex) % transportationModes.length],
    document_url: `https://example.com/docs/${companySeeds[companyIndex].company_code.toLowerCase()}-${userIndex + 1}-${requestIndex + 1}.pdf`,
    status,
    lpj_completed_at: status === 'COMPLETED'
      ? new Date(Date.UTC(2026, 6, 10 + userIndex, 0, 0, 0))
      : null,
  };
}

async function resetTables() {
  await db.delete(financeSettings);
  await db.delete(reimbursementItems);
  await db.delete(reimbursements);
  await db.delete(cashAdvances);
  await db.delete(travelFulfillments);
  await db.delete(travelApprovals);
  await db.delete(travelBookings);
  await db.delete(travelRequests);
  await db.delete(users);
  await db.delete(companies);
}

async function seed() {
  await resetTables();

  await db.insert(companies).values(companySeeds);
  const companyRows = await db.select().from(companies).orderBy(asc(companies.id));
  const companyMap = new Map(companyRows.map((company) => [company.company_code, company.id]));

  const generatedUsers: Array<{
    company_id: number;
    name: string;
    email: string;
    nik: string;
    password: string;
    role: UserRoleSeed;
    department: string;
    status: 'ACTIVE';
  }> = [];

  for (let companyIndex = 0; companyIndex < companySeeds.length; companyIndex += 1) {
    const companyId = companyMap.get(companySeeds[companyIndex].company_code);
    if (companyId === undefined) {
      throw new Error(`Company ${companySeeds[companyIndex].company_code} not found after insertion.`);
    }

    for (let userIndex = 0; userIndex < 10; userIndex += 1) {
      generatedUsers.push(buildUserSeed(companyId, companyIndex, userIndex));
    }
  }

  const userRecords = await Promise.all(
    generatedUsers.map(async (user) => ({
      ...user,
      password_hash: await hashPassword(user.password),
    }))
  );

  await db.insert(users).values(userRecords);

  const insertedUsers = await db.select().from(users).orderBy(asc(users.id));
  for (const company of companyRows) {
    const companyUsers = insertedUsers.filter((item) => item.company_id === company.id);
    const managers = companyUsers.filter((item) => item.role === 'Atasan');
    const employees = companyUsers.filter((item) => item.role === 'Karyawan');
    if (managers.length < 2) {
      throw new Error(`Company ${company.id} needs at least two Atasan users.`);
    }
    for (let index = 0; index < employees.length; index += 1) {
      await db.update(users)
        .set({ supervisor_id: managers[index % managers.length].id })
        .where(eq(users.id, employees[index].id));
    }
  }

  const createdUsers = await db.select().from(users).orderBy(asc(users.id));
  const firstFinanceUser = createdUsers.find((item) => item.role === 'Tim Keuangan');
  if (!firstFinanceUser) {
    throw new Error('A Finance user is required to seed finance settings.');
  }
  await db.insert(financeSettings).values({
    annual_budget: '250000000.00',
    payment_methods: JSON.stringify([
      { code: 'BANK_TRANSFER', label: 'Transfer Bank', description: 'Pembayaran melalui transfer bank.' },
      { code: 'CASH', label: 'Tunai', description: 'Pembayaran tunai dengan bukti transaksi.' },
    ]),
    updated_by: firstFinanceUser.id,
  });
  const nextUserIndexByCompany = new Map<number, number>();
  const userIndexById = new Map<number, number>();
  const travelRecords = [] as Array<{
    user_id: number;
    destination: string;
    start_date: Date;
    end_date: Date;
    estimated_cost: string;
    purpose: string;
    transportation_mode: TransportationModeSeed;
    document_url: string;
    status: (typeof travelStatuses)[number];
    lpj_completed_at: Date | null;
  }>;

  for (const user of createdUsers) {
    const companyIndex = companyRows.findIndex((company) => company.id === user.company_id);
    if (companyIndex < 0) {
      throw new Error(`Company for user ${user.id} not found after insertion.`);
    }

    const userIndex = nextUserIndexByCompany.get(companyIndex) ?? 0;
    nextUserIndexByCompany.set(companyIndex, userIndex + 1);
    userIndexById.set(user.id, userIndex);

    for (let requestIndex = 0; requestIndex < 5; requestIndex += 1) {
      const travelSeed = buildTravelSeed(user.id, companyIndex, userIndex, requestIndex);
      travelRecords.push({
        user_id: travelSeed.user_id,
        destination: travelSeed.destination,
        start_date: travelSeed.start_date,
        end_date: travelSeed.end_date,
        estimated_cost: travelSeed.estimated_cost,
        purpose: travelSeed.purpose,
        transportation_mode: travelSeed.transportation_mode,
        document_url: travelSeed.document_url,
        status: travelSeed.status,
        lpj_completed_at: travelSeed.lpj_completed_at,
      });
    }
  }

  await db.insert(travelRequests).values(travelRecords);

  const createdTravelRequests = await db.select().from(travelRequests).orderBy(asc(travelRequests.id));
  const operatorByTransportationMode: Record<TransportationModeSeed, string> = {
    Pesawat: 'Garuda Indonesia',
    'Kereta Api': 'Kereta Api Indonesia',
    Travel: 'Nuvix Travel',
    'Mobil Kantor': 'Kendaraan operasional perusahaan',
  };
  const bookingRecords = createdTravelRequests
    .filter((travelRequest) => travelRequest.status === 'FULFILLED')
    .slice(0, 12)
    .map((travelRequest, index) => {
      if (!travelRequest.transportation_mode) {
        throw new Error(`Transportation mode for travel request ${travelRequest.id} is required to seed a booking.`);
      }

      const departureAt = new Date(travelRequest.start_date);
      departureAt.setUTCHours(6, 0, 0, 0);
      const arrivalAt = new Date(departureAt.getTime() + (2 + (index % 4)) * 60 * 60 * 1000);

      return {
        travel_request_id: travelRequest.id,
        user_id: travelRequest.user_id,
        booking_code: `SEED-BKG-${String(travelRequest.id).padStart(4, '0')}`,
        transportation_mode: travelRequest.transportation_mode,
        operator: operatorByTransportationMode[travelRequest.transportation_mode],
        departure_at: departureAt,
        arrival_at: arrivalAt,
        hotel_name: `${travelRequest.destination} Business Hotel`,
        room_type: index % 2 === 0 ? 'Deluxe' : 'Standard',
        check_in_date: travelRequest.start_date,
        check_out_date: travelRequest.end_date,
      };
    });

  if (bookingRecords.length > 0) {
    await db.insert(travelBookings).values(bookingRecords);
  }

  const travelApprovalRecords = [];
  const travelFulfillmentRecords = [];
  const nextTravelIndexByUser = new Map<number, number>();

  for (const travelRequest of createdTravelRequests) {
    const user = createdUsers.find((item) => item.id === travelRequest.user_id);
    if (!user || user.company_id === null) {
      throw new Error(`User for travel request ${travelRequest.id} not found.`);
    }

    const approver = user.supervisor_id
      ? createdUsers.find((item) => item.id === user.supervisor_id)
      : createdUsers.find((item) =>
        item.company_id === user.company_id && item.role === 'Atasan' && item.id !== user.id
      );
    const admin = createdUsers.find((item) =>
      item.company_id === user.company_id && item.role === 'Admin Travel'
    );
    if (!approver || !admin) {
      throw new Error(`Approver or travel admin for company ${user.company_id} not found.`);
    }

    const travelIndex = nextTravelIndexByUser.get(user.id) ?? 0;
    nextTravelIndexByUser.set(user.id, travelIndex + 1);

    travelApprovalRecords.push({
      travel_request_id: travelRequest.id,
      approver_id: approver.id,
      status: 'APPROVED' as const,
      notes: 'Disetujui untuk kebutuhan operasional perusahaan.',
    });
    travelFulfillmentRecords.push({
      travel_request_id: travelRequest.id,
      admin_id: admin.id,
      transport_details: `Transportasi perjalanan ${travelIndex + 1} telah dikonfirmasi.`,
      accommodation_details: `Akomodasi perjalanan ${travelIndex + 1} telah dikonfirmasi.`,
    });
  }

  await db.insert(travelApprovals).values(travelApprovalRecords);
  await db.insert(travelFulfillments).values(travelFulfillmentRecords);

  const cashAdvanceRecords = [] as Array<{
    travel_request_id: number;
    user_id: number;
    estimated_cost: string;
    requested_amount: string;
    returned_amount: string;
    status: (typeof cashAdvanceStatuses)[number];
    payment_date: Date | null;
    payment_reference: string | null;
    payment_method: string | null;
    processed_by: number | null;
  }>;
  const reimbursementRecords = [] as Array<{
    travel_request_id: number;
    user_id: number;
    total_amount: string;
    status: (typeof reimbursementStatuses)[number];
    payment_date: Date | null;
    payment_reference: string | null;
    payment_method: string | null;
    processed_by: number | null;
  }>;
  const nextRequestIndexByUser = new Map<number, number>();
  const travelRequestIndexes = new Map<number, number>();

  for (let index = 0; index < createdTravelRequests.length; index += 1) {
    const travelRequest = createdTravelRequests[index];
    const user = createdUsers.find((item) => item.id === travelRequest.user_id)!;
    const requestIndex = nextRequestIndexByUser.get(user.id) ?? 0;
    nextRequestIndexByUser.set(user.id, requestIndex + 1);
    travelRequestIndexes.set(travelRequest.id, requestIndex);
    const userIndex = userIndexById.get(user.id);
    if (userIndex === undefined) {
      throw new Error(`Seed index for user ${user.id} not found.`);
    }
    const estimatedCost = 6000000 + requestIndex * 750000 + userIndex * 100000;
    const requestedAmount = estimatedCost - 1000000;
    const advanceDisbursed = requestIndex === 1 || requestIndex === 3 || requestIndex === 4;
    const paymentDate = new Date(Date.UTC(2026, 8, 1 + userIndex, 10, 0, 0));
    const financeUser = createdUsers.find((item) =>
      item.company_id === user.company_id && item.role === 'Tim Keuangan'
    );
    if (!financeUser) {
      throw new Error(`Finance user for company ${user.company_id} not found.`);
    }

    cashAdvanceRecords.push({
      travel_request_id: travelRequest.id,
      user_id: user.id,
      estimated_cost: estimatedCost.toFixed(2),
      requested_amount: requestedAmount.toFixed(2),
      returned_amount: '0.00',
      status: advanceDisbursed ? 'DISBURSED' : cashAdvanceStatuses[0],
      payment_date: advanceDisbursed ? paymentDate : null,
      payment_reference: advanceDisbursed ? `SEED-ADV-${travelRequest.id}` : null,
      payment_method: advanceDisbursed ? 'BANK_TRANSFER' : null,
      processed_by: advanceDisbursed ? financeUser.id : null,
    });

    const reimbursementTotal = 1800000 + (userIndex * 5 + requestIndex) * 100000;
    const reimbursementStatus = [
      'SUBMITTED',
      'VERIFIED',
      'PAID',
      'NEEDS_DOCUMENTS',
      'PAID',
    ][requestIndex] as (typeof reimbursementStatuses)[number];
    reimbursementRecords.push({
      travel_request_id: travelRequest.id,
      user_id: user.id,
      total_amount: reimbursementTotal.toFixed(2),
      status: reimbursementStatus,
      payment_date: reimbursementStatus === 'PAID' ? paymentDate : null,
      payment_reference: reimbursementStatus === 'PAID' ? `SEED-REB-${travelRequest.id}` : null,
      payment_method: reimbursementStatus === 'PAID' ? 'BANK_TRANSFER' : null,
      processed_by: reimbursementStatus === 'PAID' ? financeUser.id : null,
    });
  }

  await db.insert(cashAdvances).values(cashAdvanceRecords);
  await db.insert(reimbursements).values(reimbursementRecords);

  const createdReimbursements = await db.select().from(reimbursements).orderBy(asc(reimbursements.id));
  const reimbursementItemRecords = [] as Array<{
    reimbursement_id: number;
    category: string;
    amount: string;
    receipt_url: string;
    description: string;
  }>;

  for (let index = 0; index < createdReimbursements.length; index += 1) {
    const reimbursement = createdReimbursements[index];
    const itemCategories = ['Transportasi', 'Akomodasi', 'Makan'];
    const travelRequest = createdTravelRequests.find((item) => item.id === reimbursement.travel_request_id);
    const requestIndex = travelRequestIndexes.get(reimbursement.travel_request_id);
    const user = travelRequest && createdUsers.find((item) => item.id === travelRequest.user_id);
    if (!travelRequest || requestIndex === undefined || !user) {
      throw new Error(`Travel request for reimbursement ${reimbursement.id} not found.`);
    }
    const userIndex = userIndexById.get(user.id);
    if (userIndex === undefined) {
      throw new Error(`Seed index for user ${user.id} not found.`);
    }
    const total = 1800000 + (userIndex * 5 + requestIndex) * 100000;
    const transportAmount = Math.round(total * 0.5);
    const accommodationAmount = Math.round(total * 0.3);
    const mealAmount = total - transportAmount - accommodationAmount;
    const itemAmounts = [transportAmount, accommodationAmount, mealAmount];

    itemCategories.forEach((category, itemIndex) => {
      reimbursementItemRecords.push({
        reimbursement_id: reimbursement.id,
        category,
        amount: itemAmounts[itemIndex].toFixed(2),
        receipt_url: `https://example.com/receipts/${reimbursement.id}-${category.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        description: `Pembiayaan ${category.toLowerCase()} untuk perjalanan kerja nomor ${requestIndex + 1}.`,
      });
    });
  }

  if (reimbursementItemRecords.length > 0) {
    await db.insert(reimbursementItems).values(reimbursementItemRecords);
  }

  const pendingApprovalRecords = createdUsers
    .filter((item) => item.role === 'Karyawan')
    .map((employee) => {
      const userIndex = userIndexById.get(employee.id);
      if (userIndex === undefined) {
        throw new Error(`Seed index for user ${employee.id} not found.`);
      }
      const destination = destinations[(userIndex + 1) % destinations.length];
      return {
        user_id: employee.id,
        destination,
        start_date: new Date(Date.UTC(2026, 10, 10 + userIndex, 0, 0, 0)),
        end_date: new Date(Date.UTC(2026, 10, 12 + userIndex, 0, 0, 0)),
        estimated_cost: String(5000000 + userIndex * 250000),
        purpose: `Pengajuan perjalanan menunggu persetujuan ke ${destination}.`,
        transportation_mode: 'Pesawat' as const,
        document_url: `https://example.com/docs/pending-${employee.id}.pdf`,
        status: 'PENDING' as const,
      };
    });
  await db.insert(travelRequests).values(pendingApprovalRecords);

  const rejectedEmployee = createdUsers.find((item) =>
    item.role === 'Karyawan' && item.company_id === companyRows[0].id
  );
  if (!rejectedEmployee || rejectedEmployee.supervisor_id === null) {
    throw new Error('An employee with an assigned Atasan is required to seed approval history.');
  }
  const [rejectedTravel] = await db.insert(travelRequests).values({
    user_id: rejectedEmployee.id,
    destination: 'Jakarta',
    start_date: new Date(Date.UTC(2026, 11, 15, 0, 0, 0)),
    end_date: new Date(Date.UTC(2026, 11, 17, 0, 0, 0)),
    estimated_cost: '3200000.00',
    purpose: 'Contoh perjalanan yang ditolak untuk pengujian riwayat persetujuan.',
    transportation_mode: 'Kereta Api',
    document_url: `https://example.com/docs/rejected-${rejectedEmployee.id}.pdf`,
    status: 'REJECTED',
  });
  await db.insert(travelApprovals).values({
    travel_request_id: rejectedTravel.insertId,
    approver_id: rejectedEmployee.supervisor_id,
    status: 'REJECTED',
    notes: 'Contoh penolakan untuk menguji riwayat persetujuan.',
  });

  console.log(`Seeded 2 companies, 20 users, 100 finance-linked travel requests, ${bookingRecords.length} bookings, 12 pending approvals, 1 rejected request, 100 cash advances, 100 reimbursements, and 300 reimbursement items.`);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
