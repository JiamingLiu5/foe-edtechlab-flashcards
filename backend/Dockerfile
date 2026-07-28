FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN apk add --no-cache python3 make g++ && npm ci

COPY shared shared
COPY backend backend
RUN npm run build -w shared
RUN npm run prisma:generate -w backend
RUN npm run build -w backend

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN apk add --no-cache --virtual .native-build-deps python3 make g++ \
  && npm ci --omit=dev \
  && apk del .native-build-deps

COPY --from=build /repo/shared/dist shared/dist
COPY --from=build /repo/backend/dist backend/dist
COPY --from=build /repo/backend/generated backend/generated
COPY --from=build /repo/backend/prisma backend/prisma

WORKDIR /repo/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
