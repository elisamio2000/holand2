FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config-tailwind/package.json packages/config-tailwind/
COPY packages/config-typescript/package.json packages/config-typescript/
COPY packages/holand-core/package.json packages/holand-core/
COPY apps/holand-web-app/package.json apps/holand-web-app/

# Install deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

EXPOSE 3000

WORKDIR /app/apps/holand-web-app
CMD ["pnpm", "dev", "-H", "0.0.0.0"]
