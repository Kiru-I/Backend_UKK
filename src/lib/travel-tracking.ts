type DateValue = string | Date;

function dateOnly(value: DateValue) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getTravelTracking(
  endDate: DateValue,
  lpjCompletedAt: Date | null,
  remainingAdvanceAmount: number,
  now = new Date(),
) {
  const end = dateOnly(endDate);
  const due = new Date(end);
  due.setUTCDate(due.getUTCDate() + 7);
  const today = dateOnly(now);
  const tripEnded = end <= today;
  const lpjStatus = lpjCompletedAt
    ? 'Selesai'
    : today > due
      ? 'Terlambat'
      : 'Belum Selesai';
  const lpjReminder = tripEnded && !lpjCompletedAt
    ? lpjStatus === 'Terlambat'
      ? 'LPJ terlambat. Segera selesaikan laporan perjalanan.'
      : `Selesaikan LPJ sebelum ${formatDate(due)}.`
    : null;
  const cashAdvanceReminder = tripEnded && remainingAdvanceAmount > 0
    ? 'Kembalikan sisa uang muka perjalanan.'
    : null;

  return {
    lpj_status: lpjStatus,
    lpj_due_date: formatDate(due),
    lpj_reminder: lpjReminder,
    cash_advance_reminder: cashAdvanceReminder,
    remaining_advance_amount: remainingAdvanceAmount,
    reminder: [lpjReminder, cashAdvanceReminder].filter(Boolean).join(' ') || null,
  };
}
