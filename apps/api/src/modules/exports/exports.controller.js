export function createExportsController({ exportsService }) {
  function containers(request, response) {
    return exportsService.containers(response, request.validated.query, request.user);
  }

  function movements(request, response) {
    return exportsService.movements(response, request.validated.query);
  }

  function invoices(request, response) {
    return exportsService.invoices(response, request.validated.query, request.user);
  }

  return { containers, movements, invoices };
}
