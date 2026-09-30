export const USER_COMPANY_INCLUDE = {
  company: { select: { id: true, code: true, name: true, isActive: true } },
};

export function isAccountActive(user) {
  return user.isActive && (user.company?.isActive ?? true);
}

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    company: user.company ?? null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
