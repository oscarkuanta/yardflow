import { pinoHttp } from 'pino-http';

export function createRequestLogger({ logger, ignoredPathPrefix }) {
  return pinoHttp({
    logger,
    autoLogging: { ignore: (request) => request.originalUrl.startsWith(ignoredPathPrefix) },
    serializers: {
      req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      res: (response) => ({ statusCode: response.statusCode }),
    },
    customSuccessMessage: (request, response, responseTime) =>
      `${request.method} ${request.originalUrl} ${response.statusCode} ${responseTime}ms`,
    customErrorMessage: (request, response) =>
      `${request.method} ${request.originalUrl} ${response.statusCode} failed`,
  });
}
