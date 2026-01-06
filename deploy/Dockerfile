# Build stage
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/env.sh /docker-entrypoint.d/env.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["/bin/sh", "-c", "/docker-entrypoint.d/env.sh && nginx -g 'daemon off;'"]
