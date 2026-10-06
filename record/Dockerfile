FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ffmpeg fonts-dejavu-core fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /rec
COPY record/package.json record/package-lock.json ./
RUN npm ci --omit=dev
ENV CHROME=/usr/bin/chromium
