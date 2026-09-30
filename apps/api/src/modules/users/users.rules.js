export function companyRuleProblem(role, companyId) {
  if (role === 'CUSTOMER' && companyId === null) {
    return 'A customer user must belong to a company';
  }
  if (role !== 'CUSTOMER' && companyId !== null) {
    return 'Staff users cannot belong to a company';
  }
  return null;
}

export function ownAccessProblem({ actorId, userId, changes }) {
  if (actorId !== userId) {
    return null;
  }
  if (changes.isActive === false) {
    return 'You cannot deactivate your own account';
  }
  if (changes.role !== undefined && changes.role !== 'ADMIN') {
    return 'You cannot remove your own admin role';
  }
  return null;
}
