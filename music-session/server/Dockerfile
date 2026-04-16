FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 py3-pip

RUN python3 -m pip install --break-system-packages yt-dlp

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

RUN mkdir -p /app/uploads /app/temp

EXPOSE 4000

CMD ["node", "dist/index.js"]
