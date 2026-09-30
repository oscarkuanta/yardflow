function enumOf(...values) {
  return Object.freeze(Object.fromEntries(values.map((value) => [value, value])));
}

export const Role = enumOf('ADMIN', 'PLANNER', 'GATE_OPERATOR', 'CUSTOMER');
export const ContainerSize = enumOf('FT20', 'FT40', 'FT45');
export const LoadStatus = enumOf('FULL', 'EMPTY');
export const ContainerState = enumOf('EXPECTED', 'IN_YARD', 'DEPARTED');
export const BlockType = enumOf('STANDARD', 'EMPTY', 'DG');
export const BlockSizeClass = enumOf('SMALL', 'LARGE');
export const MovementType = enumOf(
  'GATE_IN',
  'GATE_OUT',
  'DISCHARGE',
  'LOAD',
  'YARD_MOVE',
  'RELOCATION',
);
export const WorkOrderStatus = enumOf('OPEN', 'DONE', 'CANCELLED');
export const VesselVisitStatus = enumOf('PLANNED', 'ARRIVED', 'WORKING', 'DEPARTED');
export const VisitDirection = enumOf('DISCHARGE', 'LOAD');
export const VisitItemStatus = enumOf('PENDING', 'DONE');
export const PreAdviceType = enumOf('DELIVERY', 'PICKUP');
export const PreAdviceStatus = enumOf('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED');
export const GateDirection = enumOf('IN', 'OUT');
export const DamageSide = enumOf('FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'FLOOR');
export const DamageCode = enumOf('DENT', 'HOLE', 'RUST', 'BROKEN', 'MISSING');
export const InvoiceStatus = enumOf('UNPAID', 'PAID', 'VOID');
export const NotificationType = enumOf(
  'CONTAINER_IN_YARD',
  'READY_FOR_PICKUP',
  'CUSTOMS_HOLD_PLACED',
  'CUSTOMS_HOLD_RELEASED',
  'INVOICE_ISSUED',
  'INVOICE_PAID',
  'GATE_OUT_DONE',
  'PRE_ADVICE_EXPIRED',
);

export const TEU_BY_SIZE = Object.freeze({ FT20: 1, FT40: 2, FT45: 2 });
export const SIZE_CLASS_BY_SIZE = Object.freeze({ FT20: 'SMALL', FT40: 'LARGE', FT45: 'LARGE' });
export const STAFF_ROLES = Object.freeze([Role.ADMIN, Role.PLANNER, Role.GATE_OPERATOR]);
