export function createAuditLogsController({ auditLogsService }) {
  async function list(request, response) {
    response.json(await auditLogsService.list(request.validated.query));
  }

  function exportCsv(request, response) {
    return auditLogsService.exportCsv(response, request.validated.query);
  }

  return { list, exportCsv };
}
