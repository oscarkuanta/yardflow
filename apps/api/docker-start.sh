#!/bin/sh
set -e

npx prisma migrate deploy
node prisma/seed-on-start.js
exec node src/server.js
