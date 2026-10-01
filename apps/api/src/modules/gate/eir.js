import { formatContainerNumber } from '@yardflow/shared';
import { TERMINAL_NAME } from '../../config/terminal.js';
import { formatKilograms, formatTerminalDateTime } from '../../lib/format.js';
import { PDF_COLORS as COLORS, drawFields, drawTitle, renderPdf } from '../../lib/pdf.js';
import { sizeLabel } from '../yard/stacking-rules.js';

const SIDE_LABELS = {
  FRONT: 'Front',
  BACK: 'Back',
  LEFT: 'Left',
  RIGHT: 'Right',
  TOP: 'Top',
  FLOOR: 'Floor',
};
const CODE_LABELS = {
  DENT: 'Dent',
  HOLE: 'Hole',
  RUST: 'Rust',
  BROKEN: 'Broken',
  MISSING: 'Missing',
};
const NET_LAYOUT = [
  ['TOP', 1, 0],
  ['LEFT', 0, 1],
  ['FRONT', 1, 1],
  ['RIGHT', 2, 1],
  ['BACK', 3, 1],
  ['FLOOR', 1, 2],
];
function containerType(container) {
  return `${sizeLabel(container.size)}${container.isHighCube ? ' high cube' : ''}`;
}

export function buildEirModel({ transaction, container, operator, damages, positionCode }) {
  return {
    title: 'Equipment Interchange Receipt',
    terminalName: TERMINAL_NAME,
    fields: [
      ['Transaction', `#${transaction.id}`],
      ['Date and time', `${formatTerminalDateTime(transaction.createdAt)} (Europe/Berlin)`],
      ['Direction', transaction.direction === 'IN' ? 'Gate-in' : 'Gate-out'],
      ['Lane', String(transaction.lane)],
      ['Container', formatContainerNumber(container.number)],
      ['Size and type', containerType(container)],
      ['Load status', container.loadStatus === 'FULL' ? 'Full' : 'Empty'],
      [
        'Gross weight',
        container.grossWeightKg ? formatKilograms(container.grossWeightKg) : 'Not given',
      ],
      ['Dangerous goods', container.isDangerous ? `IMO class ${container.imoClass}` : 'No'],
      ['Truck plate', transaction.truckPlate],
      ['Driver', transaction.driverName],
      ['Operator', operator.name],
      ['Position', positionCode ?? 'Not recorded'],
    ],
    damages: damages.map((damage) => ({
      side: SIDE_LABELS[damage.side],
      code: CODE_LABELS[damage.code],
      note: damage.note ?? '',
    })),
    damagedSides: [...new Set(damages.map((damage) => damage.side))],
    noDamage: damages.length === 0,
  };
}

function drawDamageTable(document, model) {
  document.fillColor(COLORS.text).fontSize(13).text('Damage inspection', 50);
  document.moveDown(0.4);
  if (model.noDamage) {
    document.fontSize(11).text('No damage', 50);
    document.moveDown(0.8);
    return;
  }
  for (const damage of model.damages) {
    const y = document.y;
    document.fontSize(11).text(damage.side, 50, y, { width: 100 });
    document.text(damage.code, 160, y, { width: 100 });
    document.fillColor(COLORS.muted).text(damage.note, 270, y, { width: 270 });
    document.fillColor(COLORS.text);
    document.moveDown(0.3);
  }
  document.moveDown(0.8);
}

function drawContainerNet(document, damagedSides) {
  const cellWidth = 90;
  const cellHeight = 40;
  const left = 50;
  const top = document.y;
  for (const [side, column, row] of NET_LAYOUT) {
    const x = left + column * cellWidth;
    const y = top + row * cellHeight;
    const isDamaged = damagedSides.includes(side);
    document
      .rect(x, y, cellWidth, cellHeight)
      .fillAndStroke(isDamaged ? COLORS.damage : '#FFFFFF', COLORS.line);
    document
      .fillColor(COLORS.text)
      .fontSize(10)
      .text(SIDE_LABELS[side], x, y + 15, { width: cellWidth, align: 'center' });
  }
}

export function renderEirPdf(model) {
  return renderPdf(model.title, (document) => {
    drawTitle(document, model);
    drawFields(document, model.fields);
    drawDamageTable(document, model);
    drawContainerNet(document, model.damagedSides);
  });
}
