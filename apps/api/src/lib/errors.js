export class AppError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function malformedRequest(message = 'The request body is not valid JSON') {
  return new AppError(400, 'MALFORMED_REQUEST', message);
}

export function notAuthenticated(message = 'Please log in first') {
  return new AppError(401, 'NOT_AUTHENTICATED', message);
}

export function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
}

export function forbidden(message = 'You do not have permission for this action') {
  return new AppError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Not found') {
  return new AppError(404, 'NOT_FOUND', message);
}

export function conflict(code, message, details = []) {
  return new AppError(409, code, message, details);
}

export function validationFailed(details, message = 'Validation failed') {
  return new AppError(422, 'VALIDATION_FAILED', message, details);
}

export function tooManyRequests(message = 'Too many attempts, please try again later') {
  return new AppError(429, 'RATE_LIMITED', message);
}
