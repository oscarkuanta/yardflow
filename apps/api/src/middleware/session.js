import session from 'express-session';
import createMySqlStore from 'express-mysql-session';

export const SESSION_COOKIE_NAME = 'yardflow.sid';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const EXPIRED_SESSION_CHECK_MS = 15 * 60 * 1000;

const MySqlStore = createMySqlStore(session);

function connectionOptionsFrom(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

export function createSessionStore({ databaseUrl }) {
  return new MySqlStore({
    ...connectionOptionsFrom(databaseUrl),
    createDatabaseTable: false,
    clearExpired: true,
    checkExpirationInterval: EXPIRED_SESSION_CHECK_MS,
    expiration: SESSION_MAX_AGE_MS,
  });
}

export function createSessionMiddleware({ sessionSecret, isProduction, store }) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
  });
}
