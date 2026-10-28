FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-alpine AS api
WORKDIR /app
COPY server ./server
ENV AGROFUEL_API_HOST=0.0.0.0
EXPOSE 8787
CMD ["node", "server/api.mjs"]
FROM nginx:stable-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
