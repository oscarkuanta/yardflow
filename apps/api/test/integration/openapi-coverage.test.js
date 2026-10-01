import { afterAll, describe, expect, test } from '@jest/globals';
import { createEventBus } from '../../src/lib/event-bus.js';
import { createAuditService } from '../../src/modules/audit/audit.service.js';
import { createPinLockout } from '../../src/modules/gate/pin-lockout.js';
import { createPreAdviceExpiry } from '../../src/modules/preadvices/preadvice-expiry.js';
import { loadOpenApiDocument } from '../../src/openapi/docs.js';
import { buildApiRouters } from '../../src/routes.js';
import { createTestContext } from '../helpers/test-app.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function toOpenApiPath(expressPath) {
  const withoutTrailingSlash =
    expressPath.length > 1 ? expressPath.replace(/\/$/, '') : expressPath;
  return withoutTrailingSlash.replace(/:(\w+)/g, '{$1}');
}

function expressOperations(routers) {
  return routers.flatMap(([mountPath, router]) =>
    router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map(
          (method) => `${method.toUpperCase()} ${toOpenApiPath(`${mountPath}${layer.route.path}`)}`,
        ),
      ),
  );
}

function documentedOperations(document) {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map(
      (method) => `${method.toUpperCase()} ${path}`,
    ),
  );
}

describe('OpenAPI route coverage (spec 9)', () => {
  const context = createTestContext();
  const eventBus = createEventBus();
  const auditService = createAuditService({ prisma: context.prisma });
  const routers = buildApiRouters({
    config: context.config,
    prisma: context.prisma,
    clock: () => new Date(),
    eventBus,
    auditService,
    pinLockout: createPinLockout(),
    preAdviceExpiry: createPreAdviceExpiry({
      prisma: context.prisma,
      auditService,
      eventBus,
      clock: () => new Date(),
      toleranceMin: context.config.gateSlotToleranceMin,
    }),
  });
  const routes = expressOperations(routers);
  const documented = documentedOperations(loadOpenApiDocument());

  afterAll(context.close);

  test('finds every route of every module', () => {
    expect(routes.length).toBeGreaterThanOrEqual(60);
    expect(new Set(routes).size).toBe(routes.length);
  });

  test('documents every Express route in the OpenAPI file', () => {
    expect(routes.filter((route) => !documented.includes(route))).toEqual([]);
  });

  test('documents no route that does not exist', () => {
    expect(documented.filter((operation) => !routes.includes(operation))).toEqual([]);
  });

  test('turns Express paths into OpenAPI paths', () => {
    expect(toOpenApiPath('/vessel-visits/:id/items/:itemId/load')).toBe(
      '/vessel-visits/{id}/items/{itemId}/load',
    );
    expect(toOpenApiPath('/users/')).toBe('/users');
    expect(toOpenApiPath('/')).toBe('/');
  });
});
