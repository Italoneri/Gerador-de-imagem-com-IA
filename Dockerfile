# syntax=docker/dockerfile:1

# node:24-alpine tem imagem arm64, e nenhuma dependência deste projeto compila
# código nativo (express, multer, zod, file-type e helmet são JS puro). Por isso
# a Ampere A1 da Oracle constrói igual a um x86, sem toolchain extra.
FROM node:24-alpine AS build
WORKDIR /app

# Manifests primeiro: enquanto as dependências não mudam, esta camada é cache.
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY . .

# O Vite assa as VITE_* no bundle em tempo de build. Este valor precisa ser o
# mesmo MAX_UPLOAD_MB do runtime — se divergirem, o browser aceita um arquivo
# que o servidor vai recusar. O compose passa os dois a partir da mesma variável.
ARG VITE_MAX_UPLOAD_MB=15
ENV VITE_MAX_UPLOAD_MB=$VITE_MAX_UPLOAD_MB

RUN npm run build

# ---------------------------------------------------------------------------

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev && npm cache clean --force

# O layout do repositório é preservado de propósito: o servidor resolve o front
# como "../../web/dist" a partir de server/dist/, então a mesma linha de código
# funciona no container e na máquina de quem desenvolve.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

USER node
EXPOSE 8787

# http.get + process.exitCode em vez de fetch + process.exit(): chamar exit()
# de dentro do callback do fetch derruba o processo com uma assertion do libuv
# antes de o socket fechar. Aqui o processo termina sozinho, com o código certo.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const r=require('http').get('http://127.0.0.1:'+process.env.PORT+'/health',s=>{s.resume();process.exitCode=s.statusCode===200?0:1});r.on('error',()=>{process.exitCode=1})"

CMD ["node", "server/dist/index.js"]
