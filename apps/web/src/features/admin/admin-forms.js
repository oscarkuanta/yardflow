export const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PLANNER', label: 'Planner' },
  { value: 'GATE_OPERATOR', label: 'Gate operator' },
  { value: 'CUSTOMER', label: 'Customer' },
];

export function changedFields(original, form) {
  return Object.fromEntries(
    Object.entries(form).filter(([field, value]) => value !== original[field]),
  );
}

export function userBody(form, original) {
  const body = {
    email: form.email,
    name: form.name,
    role: form.role,
    companyId: form.role === 'CUSTOMER' && form.companyId ? Number(form.companyId) : null,
    ...(original ? { isActive: form.isActive } : {}),
    ...(form.password ? { password: form.password } : {}),
  };
  if (!original) {
    return body;
  }
  return changedFields({ ...original, companyId: original.companyId ?? null }, body);
}

export function numberFields(form, fields) {
  return Object.fromEntries(
    Object.entries(form).map(([field, value]) => [
      field,
      fields.includes(field) && value !== '' ? Number(value) : value,
    ]),
  );
}

export function euroToCents(value) {
  return Math.round(Number(String(value).replace(',', '.')) * 100);
}

export function weekDates(mondayDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${mondayDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function mondayOf(calendarDate) {
  const date = new Date(`${calendarDate}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function slotHours(slotsByDay) {
  const hours = new Set(slotsByDay.flatMap((slots) => slots.map((slot) => slot.startHour)));
  return [...hours].sort((first, second) => first - second);
}
