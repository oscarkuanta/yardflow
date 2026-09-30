export function isCustomer(user) {
  return user.role === 'CUSTOMER';
}

export function ownedContainersScope(user) {
  return isCustomer(user) ? { ownerCompanyId: user.companyId } : {};
}
