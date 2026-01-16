FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

COPY public/ ./
COPY src/ /src/
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
