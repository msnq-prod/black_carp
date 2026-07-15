FROM node:22.18.0-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=$VCS_REF

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN mkdir -p data uploads/booking \
    && printf '%s\n' "$VCS_REF" > /app/REVISION \
    && chown -R node:node data uploads \
    && chmod 700 data uploads uploads/booking \
    && chmod 444 /app/REVISION

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||'3001')+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
