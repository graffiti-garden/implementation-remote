FROM node:current-alpine

COPY common/ /common/

WORKDIR /server/
COPY server/package*.json .

RUN npm install
