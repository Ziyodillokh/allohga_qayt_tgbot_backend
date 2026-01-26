# Bilimdon Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with npm ci for faster and reliable builds
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# Copy all source files
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies with npm ci
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/avatars uploads/attachments uploads/temp

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start command
CMD ["node", "dist/src/main.js"]
