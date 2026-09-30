function promisify(session, methodName) {
  return new Promise((resolve, reject) => {
    session[methodName]((error) => (error ? reject(error) : resolve()));
  });
}

export function regenerateSession(request) {
  return promisify(request.session, 'regenerate');
}

export function saveSession(request) {
  return promisify(request.session, 'save');
}

export function destroySession(request) {
  return promisify(request.session, 'destroy');
}
