FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server/ ./server/
COPY tsconfig.server.json ./

EXPOSE 4000

ENV FLUIDDIFIED_PORT=4000
ENV MOONRAKER_HOST=127.0.0.1
ENV MOONRAKER_PORT=7125
ENV CAMERA_HOST=127.0.0.1
ENV CAMERA_PORT=8080

CMD ["node", "--import", "tsx", "server/index.ts"]
