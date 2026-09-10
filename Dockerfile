FROM node:20-bookworm-slim

# Install OpenSSL for Prisma and required shared libraries for Playwright Chromium
RUN apt-get update && apt-get install -y \
    openssl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    ca-certificates \
    fonts-liberation \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and Playwright Chromium
RUN npm install
RUN npx playwright install chromium
RUN npx prisma generate

# Copy project source code
COPY . .

# Push SQLite database schema
RUN npx prisma db push

# Build Next.js application
RUN npm run build

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]