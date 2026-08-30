# ── Etapa 1: dependencias completas (incluye las de desarrollo) ──
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ── Etapa 2: dependencias de producción ──────────────────────────
# Se instalan por separado para que la imagen final no arrastre las
# herramientas de desarrollo. Incluye la CLI de Prisma y el cliente
# generado, porque el contenedor aplica sus propias migraciones.
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ── Etapa 3: compilación ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next incrusta las variables NEXT_PUBLIC_* en el bundle del cliente,
# así que deben estar presentes en tiempo de compilación. Si cambian,
# hay que reconstruir la imagen, no basta con reiniciar el contenedor.
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ARG NEXT_PUBLIC_MP_PUBLIC_KEY=""
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_MP_PUBLIC_KEY=$NEXT_PUBLIC_MP_PUBLIC_KEY
ENV NEXT_TELEMETRY_DISABLED=1

# La compilación no consulta la base de datos: todas las páginas que leen
# datos se renderizan en cada solicitud.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

RUN npx prisma generate && npm run build

# ── Etapa 4: ejecución ───────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat curl fontconfig font-dejavu
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/public/uploads

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Dependencias de producción y esquema, para migrar y poblar al arrancar.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Salida standalone de Next: servidor y assets.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh \
 && mkdir -p /app/public/uploads \
 && chown -R nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
