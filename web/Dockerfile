# Stage 1: Build Frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Recebe a URL de releases do GitHub injetada pelo docker-compose
ARG VITE_GITHUB_RELEASE_URL
ENV VITE_GITHUB_RELEASE_URL=$VITE_GITHUB_RELEASE_URL

COPY . .
RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
