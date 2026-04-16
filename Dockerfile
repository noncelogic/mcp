FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ src/
COPY tsconfig.json ./

RUN npx tsc
RUN npm prune --production

ENTRYPOINT ["node", "dist/index.js"]
