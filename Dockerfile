# Build stage
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npx tsc prisma/seed.ts --module commonjs --target ES2022 --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck --outDir prisma

# Runtime stage
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY prisma ./prisma
COPY --from=build /app/prisma/seed.js ./prisma/seed.js
RUN npx prisma generate
COPY --from=build /app/dist ./dist
COPY views ./views
RUN mkdir -p uploads/absen uploads/face uploads/cuti
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
