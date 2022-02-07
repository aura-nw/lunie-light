FROM node:14 as build

RUN apt-get update && apt-get install -y libusb-1.0-0 libusb-1.0-0-dev libudev-dev

WORKDIR /app

COPY package.json ./

COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn run build && yarn run generate

# EXPOSE 3000

# CMD ["yarn", "start"]

FROM nginx:stable-alpine

COPY --from=build /app/dist /app

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]