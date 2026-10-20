import { asc } from 'drizzle-orm';
import { db } from './db';
import {
  cashAdvances,
  companies,
  reimbursementItems,
  reimbursements,
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
const travelStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'COMPLETED'] as const;
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
  purpose: string;
  transportation_mode: TransportationModeSeed;
  document_url: string;
  status: (typeof travelStatuses)[number];
  lpj_completed_at: Date | null;
} {
  const destination = destinations[(companyIndex * 2 + userIndex + requestIndex) % destinations.length];
  const status = travelStatuses[(userIndex + requestIndex + companyIndex) % travelStatuses.length];
  const startDate = status === 'COMPLETED'
    ? new Date(Date.UTC(2026, 1, 5 + userIndex, 0, 0, 0))
    : new Date(Date.UTC(2026, 7 + companyIndex + requestIndex, 5 + userIndex, 0, 0, 0));
  const endDate = status === 'COMPLETED'
    ? new Date(Date.UTC(2026, 1, 7 + userIndex, 0, 0, 0))
    : new Date(Date.UTC(2026, 7 + companyIndex + requestIndex, 8 + userIndex + requestIndex, 0, 0, 0));
  const transportationModes: TransportationModeSeed[] = ['Pesawat', 'Kereta Api', 'Travel', 'Mobil Kantor'];

  return {
    user_id: userId,
    destination,
    start_date: startDate,
    end_date: endDate,
    purpose: `Kegiatan ${requestIndex + 1} untuk ${destination} dengan kebutuhan operasional dan koordinasi internal perusahaan.`,
    transportation_mode: transportationModes[(userIndex + requestIndex + companyIndex) % transportationModes.length],
    document_url: `https://example.com/docs/${companySeeds[companyIndex].company_code.toLowerCase()}-${userIndex + 1}-${requestIndex + 1}.pdf`,
    status,
    lpj_completed_at: status === 'COMPLETED' || requestIndex % 2 === 0
      ? new Date(Date.UTC(2026, status === 'COMPLETED' ? 2 : 8 + companyIndex + requestIndex, 10 + userIndex, 0, 0, 0))
      : null,
  };
}

async function resetTables() {
  await db.delete(reimbursementItems);
  await db.delete(reimbursements);
  await db.delete(cashAdvances);
  await db.delete(travelRequests);
  await db.delete(users);
  await db.delete(companies);
}

async function seed() {
  await resetTables();

  await db.insert(companies).values(companySeeds);
  const companyRows = await db.select().from(companies);
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

  const createdUsers = await db.select().from(users).orderBy(asc(users.id));
  const travelRecords = [] as Array<{
    user_id: number;
    destination: string;
    start_date: Date;
    end_date: Date;
    purpose: string;
    transportation_mode: TransportationModeSeed;
    document_url: string;
    status: (typeof travelStatuses)[number];
    lpj_completed_at: Date | null;
  }>;

  for (const user of createdUsers) {
    const companyIndex = companyRows.findIndex((company) => company.id === user.company_id);
    for (let requestIndex = 0; requestIndex < 3; requestIndex += 1) {
      const travelSeed = buildTravelSeed(user.id, companyIndex, createdUsers.findIndex((currentUser) => currentUser.id === user.id) % 10, requestIndex);
      travelRecords.push({
        user_id: travelSeed.user_id,
        destination: travelSeed.destination,
        start_date: travelSeed.start_date,
        end_date: travelSeed.end_date,
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
  const cashAdvanceRecords = [] as Array<{
    travel_request_id: number;
    user_id: number;
    estimated_cost: string;
    requested_amount: string;
    returned_amount: string;
    status: (typeof cashAdvanceStatuses)[number];
  }>;
  const reimbursementRecords = [] as Array<{
    travel_request_id: number;
    user_id: number;
    total_amount: string;
    status: (typeof reimbursementStatuses)[number];
  }>;

  for (let index = 0; index < createdTravelRequests.length; index += 1) {
    const travelRequest = createdTravelRequests[index];
    const user = createdUsers.find((item) => item.id === travelRequest.user_id)!;
    const baseAmount = (index + 1) * 1500000;

    cashAdvanceRecords.push({
      travel_request_id: travelRequest.id,
      user_id: user.id,
      estimated_cost: String(baseAmount + 2000000),
      requested_amount: String(baseAmount + 1500000),
      returned_amount: String(index % 2 === 0 ? 300000 : 0),
      status: travelRequest.status === 'COMPLETED'
        ? 'DISBURSED'
        : cashAdvanceStatuses[index % cashAdvanceStatuses.length],
    });

    reimbursementRecords.push({
      travel_request_id: travelRequest.id,
      user_id: user.id,
      total_amount: String(baseAmount + 3200000),
      status: reimbursementStatuses[index % reimbursementStatuses.length],
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

    itemCategories.forEach((category, itemIndex) => {
      reimbursementItemRecords.push({
        reimbursement_id: reimbursement.id,
        category,
        amount: String((index + 1) * 1200000 + (itemIndex + 1) * 350000),
        receipt_url: `https://example.com/receipts/${reimbursement.id}-${category.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        description: `Pembiayaan ${category.toLowerCase()} untuk perjalanan kerja nomor ${index + 1}.`,
      });
    });
  }

  if (reimbursementItemRecords.length > 0) {
    await db.insert(reimbursementItems).values(reimbursementItemRecords);
  }

  console.log('Seeded 2 companies, 20 users, and 60 travel requests with cash advances and reimbursements.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
