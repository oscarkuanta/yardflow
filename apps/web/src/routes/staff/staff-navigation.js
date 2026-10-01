import { BarChart3, Boxes, ClipboardCheck, Settings, Shield, Ship, Truck } from 'lucide-react';

export const STAFF_NAVIGATION = [
  {
    path: '/app',
    label: 'Yard',
    icon: Boxes,
    roles: ['ADMIN', 'PLANNER', 'GATE_OPERATOR'],
    end: true,
  },
  { path: '/app/gate', label: 'Gate', icon: Truck, roles: ['ADMIN', 'GATE_OPERATOR'] },
  { path: '/app/vessels', label: 'Vessels', icon: Ship, roles: ['ADMIN', 'PLANNER'] },
  {
    path: '/app/work-orders',
    label: 'Work orders',
    icon: ClipboardCheck,
    roles: ['ADMIN', 'PLANNER'],
  },
  { path: '/app/customs', label: 'Customs', icon: Shield, roles: ['ADMIN'] },
  { path: '/app/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'PLANNER'] },
  { path: '/app/admin', label: 'Admin', icon: Settings, roles: ['ADMIN'] },
];

export function navigationFor(role) {
  return STAFF_NAVIGATION.filter((item) => item.roles.includes(role));
}
