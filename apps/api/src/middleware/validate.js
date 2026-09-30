import { validationFailed } from '../lib/errors.js';

const REQUEST_PARTS = ['body', 'query', 'params'];

function describeIssues(part, issues) {
  return issues.map((issue) => ({
    field: [part, ...issue.path].join('.'),
    message: issue.message,
  }));
}

export function validate(schemas) {
  return function validateRequest(request, _response, next) {
    const validated = {};
    const problems = [];
    for (const part of REQUEST_PARTS.filter((name) => schemas[name])) {
      const result = schemas[part].safeParse(request[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        problems.push(...describeIssues(part, result.error.issues));
      }
    }
    if (problems.length > 0) {
      next(validationFailed(problems));
      return;
    }
    request.validated = validated;
    next();
  };
}
