export async function containerChange(client, container) {
  const activeHolds = await client.customsHold.count({
    where: { containerId: container.id, releasedAt: null },
  });
  return {
    companyId: container.ownerCompanyId,
    containerNumber: container.number,
    state: container.state,
    hasHold: activeHolds > 0,
  };
}
