FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Explicitly generate Nuxt types before building
RUN npm run postinstall
RUN npm run build

CMD ["node", ".output/server/index.mjs"]
