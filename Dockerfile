FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY . .
CMD ["pnpm", "dev"]
