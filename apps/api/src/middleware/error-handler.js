import { AppError, malformedRequest } from '../lib/errors.js';

const INTERNAL_ERROR = new AppError(
  500,
  'INTERNAL_ERROR',
  'Something went wrong on our side, please try again',
);

function isJsonParseError(error) {
  return error?.type === 'entity.parse.failed';
}

function isClientHttpError(error) {
  return (
    Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 && error.expose
  );
}

function toAppError(error) {
  if (error instanceof AppError) {
    return error;
  }
  if (isJsonParseError(error)) {
    return malformedRequest();
  }
  if (isClientHttpError(error)) {
    return new AppError(error.status, 'BAD_REQUEST', error.message);
  }
  return INTERNAL_ERROR;
}

export function errorHandler(error, request, response, _next) {
  const appError = toAppError(error);
  if (appError === INTERNAL_ERROR) {
    request.log?.error({ err: error }, 'Unhandled error');
  }
  response.status(appError.status).json({
    error: { code: appError.code, message: appError.message, details: appError.details },
  });
}

export function routeNotFound(request, response) {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No route for ${request.method} ${request.path}`,
      details: [],
    },
  });
}
