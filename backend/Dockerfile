# Todo API: zero dependencies, so the image is just Node plus a few files.
#   docker build -t auto-playwright-backend backend
#   docker run --rm -p 3000:3000 auto-playwright-backend
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app
COPY package.json server.mjs openapi.yaml ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=10 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
