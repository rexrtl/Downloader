FROM node:20-bullseye

# Install ffmpeg + yt-dlp
RUN apt update && apt install -y ffmpeg python3-pip
RUN pip3 install -U yt-dlp

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
