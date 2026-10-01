export function createReportsController({ reportsService }) {
  async function kpis(_request, response) {
    response.json({ data: await reportsService.kpis() });
  }

  async function occupancy(_request, response) {
    response.json({ data: await reportsService.occupancyByBlock() });
  }

  async function gateMoves(request, response) {
    response.json({ data: await reportsService.gateMoves(request.validated.query.days) });
  }

  async function dwell(_request, response) {
    response.json({ data: await reportsService.dwell() });
  }

  return { kpis, occupancy, gateMoves, dwell };
}
