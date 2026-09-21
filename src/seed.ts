import { db } from './db';
import {
  reimbursementItems,
  reimbursements,
  travelApprovals,
  travelFulfillments,
  travelRequests,
  users,
} from './db/schema';
import { hashPassword } from './lib/auth';

const userSeeds = [
  {
    name: 'Super Administrator',
    email: 'superadmin@travel.local',
    password: 'superadmin123',
    role: 'Super Admin',
    department: 'IT',
  },
  {
    name: 'Alicia Putri',
    email: 'alicia.putri@travel.local',
    password: 'Password123!',
    role: 'Karyawan',
    department: 'Sales',
  },
  {
    name: 'Budi Santoso',
    email: 'budi.santoso@travel.local',
    password: 'Password123!',
    role: 'Karyawan',
    department: 'Operations',
  },
  {
    name: 'Citra Dewi',
    email: 'citra.dewi@travel.local',
    password: 'Password123!',
    role: 'Atasan',
    department: 'Sales',
  },
  {
    name: 'Dimas Pratama',
    email: 'dimas.pratama@travel.local',
    password: 'Password123!',
    role: 'Admin Travel',
    department: 'Logistik',
  },
  {
    name: 'Eka Rahma',
    email: 'eka.rahma@travel.local',
    password: 'Password123!',
    role: 'Tim Keuangan',
    department: 'Finance',
  },
  {
    name: 'Faris Hidayat',
    email: 'faris.hidayat@travel.local',
    password: 'Password123!',
    role: 'Karyawan',
    department: 'Human Resources',
  },
] as const;

const travelRequestSeeds = [
  {
    userEmail: 'alicia.putri@travel.local',
    destination: 'Jakarta',
    start_date: new Date('2026-09-12T00:00:00Z'),
    end_date: new Date('2026-09-14T00:00:00Z'),
    purpose: 'Rapat strategis dengan tim sales nasional untuk membahas target quarter IV dan onboarding mitra baru.',
    document_url: 'https://example.com/docs/meeting-jakarta.pdf',
    status: 'COMPLETED',
  },
  {
    userEmail: 'budi.santoso@travel.local',
    destination: 'Singapore',
    start_date: new Date('2026-09-18T00:00:00Z'),
    end_date: new Date('2026-09-21T00:00:00Z'),
    purpose: 'Visit pelanggan untuk demo platform operasional dan evaluasi integrasi solusi ERP.',
    document_url: 'https://example.com/docs/singapore-client-visit.pdf',
    status: 'FULFILLED',
  },
  {
    userEmail: 'faris.hidayat@travel.local',
    destination: 'Bali',
    start_date: new Date('2026-10-02T00:00:00Z'),
    end_date: new Date('2026-10-05T00:00:00Z'),
    purpose: 'Pelatihan pengembangan SDM dan workshop manajemen talent untuk cabang regional.',
    document_url: 'https://example.com/docs/hr-training-bali.pdf',
    status: 'APPROVED',
  },
  {
    userEmail: 'alicia.putri@travel.local',
    destination: 'Surabaya',
    start_date: new Date('2026-10-10T00:00:00Z'),
    end_date: new Date('2026-10-12T00:00:00Z'),
    purpose: 'Audit operasional wilayah tim sales dan koordinasi implementasi program promo bulan depan.',
    document_url: 'https://example.com/docs/surabaya-audit.pdf',
    status: 'REJECTED',
  },
  {
    userEmail: 'budi.santoso@travel.local',
    destination: 'Bandung',
    start_date: new Date('2026-10-15T00:00:00Z'),
    end_date: new Date('2026-10-16T00:00:00Z'),
    purpose: 'Pertemuan internal dengan tim produk untuk review kebutuhan fitur dan prioritas roadmap.',
    document_url: 'https://example.com/docs/bandung-roadmap.pdf',
    status: 'PENDING',
  },
] as const;

const approvalSeeds = [
  {
    travelIndex: 0,
    approverEmail: 'citra.dewi@travel.local',
    status: 'APPROVED',
    notes: 'Persetujuan diberikan setelah review tujuan bisnis dan anggaran perjalanan sesuai prioritas departemen.',
  },
  {
    travelIndex: 1,
    approverEmail: 'citra.dewi@travel.local',
    status: 'APPROVED',
    notes: 'Disetujui untuk kunjungan pelanggan penting dan kebutuhan komunikasi langsung dengan stakeholder.',
  },
  {
    travelIndex: 2,
    approverEmail: 'citra.dewi@travel.local',
    status: 'APPROVED',
    notes: 'Program pelatihan dinilai strategis untuk pengembangan tim HR dan kompetensi cabang.',
  },
  {
    travelIndex: 3,
    approverEmail: 'citra.dewi@travel.local',
    status: 'REJECTED',
    notes: 'Perjalanan ditolak karena jadwal audit tidak sesuai prioritas dan kapasitas internal saat ini.',
  },
] as const;

const fulfillmentSeeds = [
  {
    travelIndex: 1,
    adminEmail: 'dimas.pratama@travel.local',
    transport_details: 'Garuda Indonesia GA-248, penerbangan Jakarta-Singapore, seat 2A. Boarding dari Terminal 2B, check-in pada 2026-09-17 pukul 14:30 WIB.',
    accommodation_details: 'Hotel Marina Bay Sands, kamar superior dengan 2 malam menginap, breakfast included, check-in 2026-09-18.',
  },
  {
    travelIndex: 0,
    adminEmail: 'dimas.pratama@travel.local',
    transport_details: 'Lion Air JT-310, penerbangan Bandung-Jakarta pulang pergi, ekonomi class, bagasi kabin 15 kg.',
    accommodation_details: 'Hotel Grand Indonesia, 2 malam, room type deluxe, meeting room tersedia untuk 2 sesi internal.',
  },
] as const;

const reimbursementSeeds = [
  {
    travelIndex: 0,
    userEmail: 'alicia.putri@travel.local',
    total_amount: '7250000.00',
    status: 'PAID',
  },
  {
    travelIndex: 1,
    userEmail: 'budi.santoso@travel.local',
    total_amount: '11850000.00',
    status: 'VERIFIED',
  },
  {
    travelIndex: 2,
    userEmail: 'faris.hidayat@travel.local',
    total_amount: '6400000.00',
    status: 'SUBMITTED',
  },
] as const;

const reimbursementItemSeeds = [
  {
    reimbursementIndex: 0,
    category: 'Transportasi',
    amount: '2400000.00',
    receipt_url: 'https://example.com/receipts/flight-jakarta.pdf',
    description: 'Tiket pesawat pulang pergi dan biaya bagasi tambahan.',
  },
  {
    reimbursementIndex: 0,
    category: 'Akomodasi',
    amount: '3100000.00',
    receipt_url: 'https://example.com/receipts/hotel-jakarta.pdf',
    description: 'Menginap 2 malam di hotel dekat lokasi rapat dengan layanan breakfast.',
  },
  {
    reimbursementIndex: 0,
    category: 'Makan & Kebutuhan Rapat',
    amount: '1750000.00',
    receipt_url: 'https://example.com/receipts/meeting-jakarta.pdf',
    description: 'Biaya makan dan kebutuhan operasional selama sesi rapat.',
  },
  {
    reimbursementIndex: 1,
    category: 'Transportasi',
    amount: '4300000.00',
    receipt_url: 'https://example.com/receipts/flight-singapore.pdf',
    description: 'Tiket pesawat dan biaya transfer bandara ke hotel.',
  },
  {
    reimbursementIndex: 1,
    category: 'Akomodasi',
    amount: '5600000.00',
    receipt_url: 'https://example.com/receipts/hotel-singapore.pdf',
    description: 'Biaya kamar hotel untuk 3 malam selama kunjungan pelanggan.',
  },
  {
    reimbursementIndex: 1,
    category: 'Perjalanan Lokal',
    amount: '1950000.00',
    receipt_url: 'https://example.com/receipts/local-transport-singapore.pdf',
    description: 'Taxi dan transportasi lokal untuk meeting dengan klien dan kantor cabang.',
  },
  {
    reimbursementIndex: 2,
    category: 'Transportasi',
    amount: '2100000.00',
    receipt_url: 'https://example.com/receipts/flight-bali.pdf',
    description: 'Tiket pesawat pulang pergi untuk mengikuti pelatihan HR.',
  },
  {
    reimbursementIndex: 2,
    category: 'Akomodasi',
    amount: '2800000.00',
    receipt_url: 'https://example.com/receipts/hotel-bali.pdf',
    description: 'Kamar deluxe untuk 3 malam selama program pelatihan.',
  },
  {
    reimbursementIndex: 2,
    category: 'Perlengkapan Workshop',
    amount: '1500000.00',
    receipt_url: 'https://example.com/receipts/workshop-bali.pdf',
    description: 'Biaya workshop, materi training, dan kebutuhan operasional peserta.',
  },
] as const;

async function resetTables() {
  await db.delete(reimbursementItems);
  await db.delete(reimbursements);
  await db.delete(travelFulfillments);
  await db.delete(travelApprovals);
  await db.delete(travelRequests);
  await db.delete(users);
}

async function seed() {
  await resetTables();

  const userRecords = await Promise.all(
    userSeeds.map(async (user) => ({
      ...user,
      password_hash: await hashPassword(user.password),
    }))
  );

  await db.insert(users).values(userRecords);

  const createdUsers = await db.select().from(users);
  const userMap = new Map(createdUsers.map((user) => [user.email, user.id]));

  const travelRecords = travelRequestSeeds.map((travel) => ({
    user_id: userMap.get(travel.userEmail)!,
    destination: travel.destination,
    start_date: travel.start_date,
    end_date: travel.end_date,
    purpose: travel.purpose,
    document_url: travel.document_url,
    status: travel.status,
  }));

  await db.insert(travelRequests).values(travelRecords);

  const createdTravelRequests = await db.select().from(travelRequests);
  const travelMap = new Map(createdTravelRequests.map((travel) => [
    `${travel.destination}-${travel.user_id}-${travel.start_date}`,
    travel.id,
  ]));

  const approvalRecords = approvalSeeds.map((approval) => ({
    travel_request_id: createdTravelRequests[approval.travelIndex].id,
    approver_id: userMap.get(approval.approverEmail)!,
    status: approval.status,
    notes: approval.notes,
  }));

  if (approvalRecords.length > 0) {
    await db.insert(travelApprovals).values(approvalRecords);
  }

  const fulfillmentRecords = fulfillmentSeeds.map((fulfillment) => {
    const travelRequest = createdTravelRequests[fulfillment.travelIndex];

    return {
      travel_request_id: travelRequest.id,
      transport_details: fulfillment.transport_details,
      accommodation_details: fulfillment.accommodation_details,
      admin_id: userMap.get(fulfillment.adminEmail)!,
    };
  });

  if (fulfillmentRecords.length > 0) {
    await db.insert(travelFulfillments).values(fulfillmentRecords);
  }

  const reimbursementRecords = reimbursementSeeds.map((reimbursement) => {
    const travelRequest = createdTravelRequests[reimbursement.travelIndex];

    return {
      travel_request_id: travelRequest.id,
      user_id: userMap.get(reimbursement.userEmail)!,
      total_amount: reimbursement.total_amount,
      status: reimbursement.status,
    };
  });

  if (reimbursementRecords.length > 0) {
    await db.insert(reimbursements).values(reimbursementRecords);
  }

  const createdReimbursements = await db.select().from(reimbursements);

  const reimbursementItemRecords = reimbursementItemSeeds.map((item) => {
    const reimbursement = createdReimbursements[item.reimbursementIndex];

    return {
      reimbursement_id: reimbursement.id,
      category: item.category,
      amount: item.amount,
      receipt_url: item.receipt_url,
      description: item.description,
    };
  });

  if (reimbursementItemRecords.length > 0) {
    await db.insert(reimbursementItems).values(reimbursementItemRecords);
  }

  console.log('Seeded users, travel requests, approvals, fulfillments, reimbursements, and reimbursement items.');
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
