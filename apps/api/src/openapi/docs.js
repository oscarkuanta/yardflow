import { readFileSync } from 'node:fs';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

const OPENAPI_FILE = new URL('./openapi.yaml', import.meta.url);

export function loadOpenApiDocument() {
  return parse(readFileSync(OPENAPI_FILE, 'utf8'));
}

export function createDocsRouter(document) {
  const router = Router();
  router.get('/openapi.json', (_request, response) => response.json(document));
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'YardFlow API',
      swaggerOptions: { withCredentials: true, persistAuthorization: true },
    }),
  );
  return router;
}
