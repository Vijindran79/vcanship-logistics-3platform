# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; \
    elif [ -f yarn.lock ]; then yarn install; \
    else npm install; fi

# Copy all source files
COPY . .

# Build the app (adjust if you use a different build command)
RUN npm run build

# Expose port (change if your app uses a different port)
EXPOSE 3000

# Start the app (adjust if you use a different start command)
CMD ["npm", "start"]
