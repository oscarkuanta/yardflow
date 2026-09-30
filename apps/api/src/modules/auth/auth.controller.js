import { destroySession, regenerateSession, saveSession } from '../../lib/session.js';
import { SESSION_COOKIE_NAME } from '../../middleware/session.js';
import { toPublicUser } from '../users/users.presenter.js';

export function createAuthController({ authService }) {
  async function login(request, response) {
    const { email, password } = request.validated.body;
    const user = await authService.verifyCredentials({ email, password, ip: request.ip });
    await regenerateSession(request);
    request.session.userId = user.id;
    await saveSession(request);
    const loggedInUser = await authService.recordLogin(user, request.ip);
    response.json({ data: toPublicUser(loggedInUser) });
  }

  async function logout(request, response) {
    await authService.recordLogout(request.user, request.ip);
    await destroySession(request);
    response.clearCookie(SESSION_COOKIE_NAME);
    response.status(204).end();
  }

  function me(request, response) {
    response.json({ data: toPublicUser(request.user) });
  }

  return { login, logout, me };
}
