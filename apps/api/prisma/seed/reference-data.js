export const RANDOM_SEED = 20260930;
export const DEMO_PASSWORD = 'demo1234';
export const TARGET_OCCUPANCY = 0.65;
export const YARD_DWELL_WINDOW_DAYS = 12;
export const GATE_HISTORY_DAYS = 14;

export const BLOCKS = [
  {
    code: 'A',
    type: 'STANDARD',
    sizeClass: 'SMALL',
    rows: 6,
    bays: 12,
    maxTier: 5,
    mapX: 60,
    mapY: 20,
    gateDistanceM: 60,
  },
  {
    code: 'D',
    type: 'STANDARD',
    sizeClass: 'SMALL',
    rows: 6,
    bays: 12,
    maxTier: 5,
    mapX: 60,
    mapY: 70,
    gateDistanceM: 70,
  },
  {
    code: 'B',
    type: 'STANDARD',
    sizeClass: 'LARGE',
    rows: 5,
    bays: 10,
    maxTier: 5,
    mapX: 180,
    mapY: 20,
    gateDistanceM: 180,
  },
  {
    code: 'C',
    type: 'STANDARD',
    sizeClass: 'LARGE',
    rows: 5,
    bays: 10,
    maxTier: 4,
    mapX: 180,
    mapY: 70,
    gateDistanceM: 190,
  },
  {
    code: 'E',
    type: 'EMPTY',
    sizeClass: 'LARGE',
    rows: 4,
    bays: 8,
    maxTier: 5,
    mapX: 340,
    mapY: 20,
    gateDistanceM: 340,
  },
  {
    code: 'X',
    type: 'DG',
    sizeClass: 'SMALL',
    rows: 3,
    bays: 6,
    maxTier: 3,
    mapX: 340,
    mapY: 70,
    gateDistanceM: 350,
  },
];

export const COMPANIES = [
  {
    code: 'HNF',
    name: 'Hanse North Freight',
    contactEmail: 'ops@hansenorth.example',
    shareWeight: 30,
  },
  {
    code: 'NRT',
    name: 'Nordtrans Logistics',
    contactEmail: 'ops@nordtrans.example',
    shareWeight: 25,
  },
  { code: 'BLX', name: 'Baltix Shipping', contactEmail: 'ops@baltix.example', shareWeight: 18 },
  {
    code: 'SEA',
    name: 'Seaway Forwarding',
    contactEmail: 'ops@seaway.example',
    shareWeight: 15,
  },
  {
    code: 'ERH',
    name: 'Elbe Road Haulage',
    contactEmail: 'ops@elberoad.example',
    shareWeight: 12,
  },
];

export const USERS = [
  { email: 'admin@yardflow.dev', name: 'Anna Keller', role: 'ADMIN', companyCode: null },
  { email: 'planner@yardflow.dev', name: 'Mira Pohl', role: 'PLANNER', companyCode: null },
  { email: 'gate@yardflow.dev', name: 'Jonas Reuter', role: 'GATE_OPERATOR', companyCode: null },
  { email: 'ops@hansenorth.example', name: 'Lea Hansen', role: 'CUSTOMER', companyCode: 'HNF' },
  { email: 'ops@nordtrans.example', name: 'Tomasz Nowak', role: 'CUSTOMER', companyCode: 'NRT' },
];

export const BASE_DAILY_RATE_CENTS = { FT20: 900, FT40: 1500, FT45: 1700 };
export const STANDARD_FREE_DAYS = 5;
export const DANGEROUS_FREE_DAYS = 3;
export const DANGEROUS_RATE_FACTOR = 2;

export const VESSEL_VISITS = [
  {
    vesselName: 'Nordic Tern',
    imoNumber: '9814272',
    voyage: '042N',
    status: 'WORKING',
    eta: { dayOffset: 0, hour: 6, minute: 0 },
    ata: { dayOffset: 0, hour: 6, minute: 40 },
    etd: { dayOffset: 0, hour: 21, minute: 0 },
    discharge: { total: 108, done: 62 },
    load: { total: 82, done: 35 },
  },
  {
    vesselName: 'Elbe Trader',
    imoNumber: '9362152',
    voyage: '117S',
    status: 'PLANNED',
    eta: { dayOffset: 0, hour: 18, minute: 0 },
    ata: null,
    etd: { dayOffset: 1, hour: 9, minute: 0 },
    discharge: { total: 64, done: 0 },
    load: { total: 52, done: 0 },
  },
  {
    vesselName: 'Baltic Wren',
    imoNumber: '9705380',
    voyage: '009E',
    status: 'PLANNED',
    eta: { dayOffset: 2, hour: 10, minute: 0 },
    ata: null,
    etd: { dayOffset: 2, hour: 22, minute: 0 },
    discharge: { total: 40, done: 0 },
    load: { total: 30, done: 0 },
  },
];

export const DEMO_PICKUP = {
  companyCode: 'HNF',
  containerNumber: 'HNFU2045711',
  blockCode: 'B',
  pin: '482913',
  truckPlate: 'HH-YF 482',
  driverName: 'Jan Becker',
};

export const DEMO_DELIVERY = {
  companyCode: 'HNF',
  pin: '175824',
  truckPlate: 'HH-YF 175',
  driverName: 'Mats Olsen',
};

export const RETIRED_PIN = '000000';

export const CUSTOMS_HOLD_REASONS = [
  'Import declaration under review',
  'X-ray inspection requested',
  'Missing certificate of origin',
  'Random customs inspection',
  'Phytosanitary check pending',
];

export const PLATE_CITY_CODES = ['HH', 'HB', 'KI', 'HL', 'PI', 'SE', 'OD', 'B', 'H', 'ROS'];
export const DRIVER_FIRST_NAMES = [
  'Lukas',
  'Anna',
  'Piotr',
  'Sven',
  'Marta',
  'Jens',
  'Olga',
  'Kai',
  'Nils',
  'Eva',
  'Tim',
  'Sara',
];
export const DRIVER_LAST_NAMES = [
  'Brandt',
  'Nowak',
  'Schulz',
  'Larsen',
  'Wolff',
  'Kowalski',
  'Petersen',
  'Meyer',
  'Jansen',
  'Richter',
];
export const IMO_CLASSES = ['2.1', '3', '4.1', '6.1', '8', '9'];
