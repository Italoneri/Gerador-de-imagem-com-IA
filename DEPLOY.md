# Deploy — Oracle Cloud com HTTPS

Roteiro para subir o Fosco numa instância Always Free da Oracle Cloud, atrás do Caddy,
com certificado Let's Encrypt de verdade.

**Não há banco de dados.** Histórico, imagens e favoritos vivem no IndexedDB do browser de
cada usuário. O servidor é um proxy sem estado — dá para destruir e recriar a instância sem
perder nada do lado do servidor. O único estado que importa preservar é o volume de
certificados do Caddy.

---

## 0. Antes de tocar na Oracle: valide a chave

```bash
cp .env.example .env      # preencha IMAGE_PROVIDER e a chave
npm install
npm run check:provider
```

Saída esperada:

```
provedor : bfl
modelo   : flux-kontext-pro
timeout  : 120000 ms

mandando uma edição de teste…

✅ funcionou.
   voltou 48213 bytes de image/png em 6.4s
```

Se falhar aqui, vai falhar na Oracle também — só que lá com muito mais passos no meio para
confundir. O comando diz o código, o detalhe técnico e o que fazer.

## 0.1. Ensaio local do stack de produção

Antes de provisionar qualquer coisa, rode o mesmo Compose na sua máquina:

```bash
SITE_DOMAIN=localhost docker compose up --build
```

Abra `https://localhost`. O Caddy usa a CA interna dele, então o browser vai reclamar do
certificado — normal, é só no ensaio. O que importa validar aqui é o resto: o app carrega,
as fotos aparecem, e uma edição completa funciona. Se isso passa, o deploy é só rede.

---

## 1. Instância

No console da OCI: **Compute → Instances → Create**.

- **Shape**: `VM.Standard.A1.Flex` (Ampere, ARM) — está no Always Free e tem folga de sobra.
  Dê 2 OCPU / 12 GB. A `E2.1.Micro` (AMD, 1 GB) também é gratuita, mas dois containers e um
  build de Vite não cabem confortavelmente em 1 GB.
- **Imagem**: Ubuntu 24.04.
- **Rede**: aceite a VCN criada automaticamente e marque **Assign a public IPv4 address**.
- Guarde a chave SSH e anote o **IP público**.

## 2. Abrir 80 e 443 — nos *dois* lugares

Este é o passo em que a maioria das pessoas perde uma tarde. Na Oracle a porta precisa ser
liberada na nuvem **e** no sistema operacional.

### 2a. Security List da VCN

**Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default Security List →
Add Ingress Rules**, duas regras:

| Source CIDR | Protocolo | Porta destino |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

### 2b. iptables no host

As imagens Ubuntu da OCI vêm com regras de iptables que rejeitam tudo menos SSH, e com o
**UFW desativado de propósito** — mexer no UFW aqui não resolve e ainda pode te trancar
para fora. Via SSH:

```bash
sudo iptables -I INPUT 4 -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 4 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

⚠️ `-I INPUT 4` **insere** a regra na posição 4, antes da regra REJECT que já está lá.
Se você usar `-A` (anexar no fim), a REJECT vem primeiro e a sua regra é ignorada — a porta
continua fechada e nada indica o motivo.

Confira: `sudo iptables -L INPUT -n --line-numbers` deve mostrar os ACCEPT acima do REJECT.

## 3. Domínio

Sem domínio não existe certificado público. Como você não tem um próprio, use o
[DuckDNS](https://www.duckdns.org):

1. Entre com qualquer login social e crie um subdomínio, ex.: `fosco`.
2. No campo **current ip**, cole o IP público da instância e clique em *update ip*.
3. Confirme a propagação antes de seguir:

```bash
dig +short fosco.duckdns.org
```

Tem que devolver exatamente o IP da instância. **O Let's Encrypt só emite depois que isso
resolve** — subir o Caddy antes só gasta tentativa.

## 4. Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

## 5. Código e segredo

```bash
git clone <seu-repo> fosco && cd fosco
cp .env.example .env
nano .env
chmod 600 .env
```

No `.env` da instância, o mínimo:

```env
IMAGE_PROVIDER=bfl
BFL_API_KEY=sua-chave-real
NODE_ENV=production
SITE_DOMAIN=fosco.duckdns.org
MAX_UPLOAD_MB=15
```

`SITE_DOMAIN` é o que o Caddy vai atender e para o qual pedirá o certificado.
`MAX_UPLOAD_MB` alimenta o servidor **e** o build do front, pelo mesmo build arg — não
edite um sem o outro.

## 6. Subir

```bash
docker compose up -d --build
docker compose logs -f caddy
```

Espere a linha de `certificate obtained successfully`. Aí:

```bash
curl -I https://fosco.duckdns.org
```

Se der certificado válido e HTTP 200, acabou. Abra no browser e faça uma edição real.

---

## Operação

**Atualizar:**

```bash
git pull && docker compose up -d --build
```

**Logs** (JSON estruturado, sem chave e sem PII):

```bash
docker compose logs -f app
```

**Diagnosticar o provedor de dentro do container** — útil quando funciona local e não
funciona na Oracle:

```bash
docker compose exec app node server/dist/scripts/checkProvider.js
```

**Trocar a chave sem downtime perceptível:**

```bash
nano .env && docker compose up -d app
```

Só o container `app` reinicia; o Caddy e os certificados nem são tocados.

---

## Quando der errado

| Sintoma | Causa quase sempre |
|---|---|
| `curl` da sua máquina trava sem resposta | Porta fechada. Reveja **2a e 2b** — na dúvida, é o iptables. |
| Caddy repete "could not get certificate" | DNS ainda não resolve para o IP, ou a porta 80 está fechada (a validação usa a 80, não a 443). |
| HTTPS funciona mas as fotos não aparecem | CSP. O `img-src` precisa de `blob:`; isso já está em `server/src/index.ts`, então suspeite de proxy ou extensão do browser injetando política. |
| Todo mundo toma `LIMITE_EXCEDIDO` junto | `trust proxy` desligado — confirme que `NODE_ENV=production` chegou no container (`docker compose exec app env \| grep NODE_ENV`). |
| Browser aceita o arquivo e o servidor recusa por tamanho | `MAX_UPLOAD_MB` do runtime diferente do que foi assado no bundle. Rebuild com `--build`. |
| Certificado sumiu depois de um redeploy | O volume `caddy_data` foi removido (`docker compose down -v`). Cuidado com o `-v`: o Let's Encrypt tem rate limit semanal. |
