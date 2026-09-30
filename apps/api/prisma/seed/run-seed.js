import { TEU_BY_SIZE, formatContainerNumber } from '@yardflow/shared';
import { TERMINAL_NAME } from '../../src/config/terminal.js';
import { buildDataset } from './build-dataset.js';
import { formatTable, formatTerminalTime } from './format.js';
import { DEMO_PASSWORD, USERS } from './reference-data.js';
import { writeDataset } from './write-dataset.js';
import { blockSlotCount } from './yard-layout.js';

const LARGE_SLOT_TEU = 2;
const SMALL_SLOT_TEU = 1;

export function summarizeDataset(dataset) {
  const { tables } = dataset;
  const containersInYard = tables.containers.filter((container) => container.state === 'IN_YARD');
  const usedTeu = containersInYard.reduce((sum, container) => sum + TEU_BY_SIZE[container.size], 0);
  const totalTeu = tables.blocks.reduce(
    (sum, block) =>
      sum + blockSlotCount(block) * (block.sizeClass === 'LARGE' ? LARGE_SLOT_TEU : SMALL_SLOT_TEU),
    0,
  );
  return {
    containersInYard: containersInYard.length,
    usedTeu,
    totalTeu,
    occupancyPercent: Math.round((usedTeu / totalTeu) * 100),
    rowCounts: Object.fromEntries(
      Object.entries(tables).map(([tableName, rows]) => [tableName, rows.length]),
    ),
  };
}

export async function runSeed(prisma, { now = new Date(), bcryptRounds } = {}) {
  const dataset = buildDataset({ now });
  await writeDataset(prisma, dataset, { bcryptRounds });
  return { summary: summarizeDataset(dataset), demo: dataset.demo };
}

function formatBookingRow(label, booking) {
  return [
    label,
    booking.reference,
    booking.pin,
    booking.truckPlate,
    booking.driverName,
    formatContainerNumber(booking.containerNumber),
    booking.positionCode ?? 'at the gate',
  ];
}

export function formatSeedReport({ summary, demo }) {
  const logins = formatTable(
    ['Role', 'Name', 'Email', 'Password'],
    USERS.map((user) => [user.role, user.name, user.email, DEMO_PASSWORD]),
  );
  const bookings = formatTable(
    ['Demo', 'Reference', 'PIN', 'Truck plate', 'Driver', 'Container', 'Position'],
    [
      formatBookingRow('Pickup, 2 containers on top', demo.pickup),
      formatBookingRow('Delivery', demo.delivery),
    ],
  );
  return [
    `${TERMINAL_NAME} seeded.`,
    `Yard: ${summary.containersInYard} containers, ${summary.usedTeu} of ${summary.totalTeu} TEU (${summary.occupancyPercent}%).`,
    `Rows: ${Object.entries(summary.rowCounts)
      .map(([tableName, count]) => `${tableName} ${count}`)
      .join(', ')}.`,
    '',
    'Demo logins',
    logins,
    '',
    `Active gate bookings in the slot ${formatTerminalTime(demo.slotStart)} to ${formatTerminalTime(demo.slotEnd)} (Europe/Berlin)`,
    bookings,
  ].join('\n');
}
