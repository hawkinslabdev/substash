#!/bin/sh
cd /app
npx drizzle-kit migrate
exec node server.mjs
