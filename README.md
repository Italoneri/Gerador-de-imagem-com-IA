# Fosco — editor de imagem com IA

Você sobe uma foto, escreve em português o que quer mudar ("troca o fundo pra Paris",
"tira o poste", "deixa preto e branco") e recebe a imagem editada de volta no chat. A
próxima instrução aplica em cima do resultado anterior, então dá pra ir refinando sem
reanexar nada.

A interface veio de um handoff do Claude Design e foi preservada como estava — mesma
paleta, mesma tipografia, mesmos espaçamentos. O original está em
[`design/`](./design) para conferência.

---

## Rodando local

Precisa de **Node 20.19+** (testado no 24).

```bash
npm install
cp .env.example .env     # depois preencha BFL_API_KEY
npm run dev
```

- Front: <http://localhost:5173>
- API: <http://localhost:8787> (`/health` responde `{"ok":true,"provider":"bfl"}`)

O Vite faz proxy de `/api` para o Express, então em desenvolvimento não existe CORS e o
browser nunca fala direto com o provedor de IA.

Se a chave estiver faltando, o servidor **não sobe** e diz exatamente o que falta:

```
Configuração inválida:
  · BFL_API_KEY: IMAGE_PROVIDER="bfl" exige BFL_API_KEY. Preencha no .env (veja .env.example).
```

Isso é de propósito: melhor falhar no boot do que só quebrar depois que o usuário já
esperou o upload.

---

## Onde conseguir a chave

| Provedor | `IMAGE_PROVIDER` | Onde pegar | Observação |
|---|---|---|---|
| **Black Forest Labs** (FLUX.1 Kontext) | `bfl` | <https://dashboard.bfl.ai> → *API Keys* | Padrão. Créditos pré-pagos, sem free tier. |
| **Google Gemini** ("Nano Banana") | `gemini` | <https://aistudio.google.com/apikey> → *Create API key* | Tem free tier, bom pra testar. |
| **NVIDIA NIM** | `nim` | <https://build.nvidia.com> → escolha o modelo → *Get API Key* | Créditos gratuitos ao criar conta. |

Só a chave do provedor selecionado é obrigatória — quem usa BFL não precisa ter conta
no Google.

### Trocando de provedor

Edite duas linhas do `.env` e reinicie:

```env
IMAGE_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```

Nenhum código muda. O provedor é resolvido por um mapa em
[`server/src/providers/registry.ts`](./server/src/providers/registry.ts), e todos
implementam a mesma interface `ImageEditProvider`. Para acrescentar um quarto, escreva o
adaptador, registre no mapa e adicione o id em `PROVIDER_IDS`.

O modelo também é configurável dentro de cada provedor — `BFL_MODEL` aceita
`flux-kontext-pro` (padrão), `flux-kontext-max` e a família `flux-2-*`; o adaptador já
cuida da diferença de contrato entre elas (`input_image` no Kontext, `input_images[]` na
FLUX.2).

---

## A chave nunca vai para o browser

É o ponto que estrutura o projeto inteiro:

```
browser  ──POST multipart──▶  Express (:8787)  ──x-key──▶  api.bfl.ai
   ▲                              │                            │
   └────── PNG (bytes) ───────────┘◀────── polling + download ──┘
```

- O `.env` é lido só pelo processo do servidor. Nada de `VITE_` em cima de segredo —
  qualquer coisa com esse prefixo entra no bundle público.
- A BFL é assíncrona: `POST` devolve um `polling_url`, e o resultado final é uma URL
  assinada que **expira em 10 minutos**. O servidor faz o polling e **baixa a imagem
  ele mesmo**, devolvendo bytes. Assim o browser nunca vê uma URL do provedor nem um
  link que morre.
- Upload limitado por `MAX_UPLOAD_MB` no próprio multer, antes de bufferizar o arquivo
  inteiro.
- O tipo do arquivo é decidido pelos **magic bytes** (`file-type`), não pelo MIME que o
  cliente declarou — renomear `.txt` para `.jpg` não passa.
- `helmet` + rate limit por IP (`RATE_LIMIT_MAX` a cada 5 minutos) + CORS travado em
  `CORS_ORIGIN`.
- Nenhum log inclui a chave. O log é JSON com `operation`, `code`, `status` e um
  `detail` técnico que fica só no servidor.

---

## Erros

O servidor responde `{"error":{"code":"..."}}` e o front traduz o código para uma frase.
A tabela de texto vive num lugar só,
[`web/src/errors/editErrors.ts`](./web/src/errors/editErrors.ts), então não há duas
cópias da mesma mensagem pra sair de sincronia.

| Código | HTTP | Quando |
|---|---|---|
| `TIPO_NAO_SUPORTADO` | 415 | Bytes são de um formato fora de PNG/JPG/WebP |
| `ARQUIVO_GRANDE` | 413 | Acima de `MAX_UPLOAD_MB` ou de 20 megapixels |
| `IMAGEM_INVALIDA` | 400 | Arquivo ausente, vazio, ou que não decodifica |
| `PROMPT_INVALIDO` | 400 | Instrução vazia ou acima de 2000 caracteres |
| `SEM_REDE` | 502 | Conexão com o provedor falhou (DNS, TLS, rede fora) |
| `TIMEOUT` | 504 | Estourou `REQUEST_TIMEOUT_MS`, ou o polling nunca ficou pronto |
| `RESPOSTA_INVALIDA` | 502 | Provedor respondeu fora do schema, ou recusou um parâmetro nosso |
| `CONTEUDO_BLOQUEADO` | 422 | Filtro de conteúdo do provedor barrou o pedido |
| `SEM_CREDITO` | 402 | Créditos da API acabaram |
| `LIMITE_EXCEDIDO` | 429 | Rate limit — nosso ou do provedor |
| `PROVEDOR_FORA` | 502 | 5xx do provedor |
| `CONFIG_INVALIDA` | 500 | Chave ausente ou recusada |

No chat, a falha aparece como um balão da IA com a mensagem, o código e um botão
**Tentar de novo** que refaz a mesma edição.

> Detalhe que custa caro se ignorado: a BFL usa **422 para qualquer falha de validação**,
> não só para moderação — uma chave malformada volta como
> `{"detail":"Invalid API key format"}` com status 422. Por isso o 422 é classificado
> pelo corpo da resposta, e não pelo status sozinho. Moderação real chega pelo status do
> polling (`Content Moderated` / `Request Moderated`).

---

## Estrutura

```
web/src/
  chat/       conversa, balões, comparador antes/depois, composer
  gallery/    grid de edições salvas, filtros, favoritos
  editor/     painel de edição (visual, ver nota abaixo)
  upload/     validação e drag-and-drop
  api/        única porta de saída — fala com /api/edit
  storage/    IndexedDB e ciclo de vida das object URLs
  styles/     tokens do handoff

server/src/
  routes/     POST /api/edit — multer, validação, orquestração
  providers/  bfl (padrão) | gemini | nim, atrás de uma interface só
  config/     env com zod, fail-fast no boot
  errors/     códigos tipados e mapeamento de status
```

O código é organizado por funcionalidade, não por camada técnica: teste, tipo e lógica
de uma feature ficam juntos.

### Sobre a aba Editor

As três abas do handoff existem. Chat e Galeria são funcionais de ponta a ponta. Na aba
**Editor**, a imagem real é carregada no canvas e o botão **"Pedir pra IA ajustar"**
devolve ela ao chat como base da próxima edição — esse é o caminho que funciona.
Ferramentas de máscara, pincel e camadas continuam sendo superfície de design: uma
engine de canvas com seleção e camadas reais é um segundo produto, não um detalhe deste.
Aplicar/Desfazer operam sobre os próprios sliders (fixa / volta ao último fixado).

---

## Conferindo o design

O handoff renderiza localmente para comparação lado a lado:

```bash
npx --yes serve design -l 5174    # ou qualquer servidor estático
```

Abra `http://localhost:5174` (o `preview.html` injeta o React que o runtime do Claude
Design espera) e compare com `http://localhost:5173` nas quatro combinações de
tema × dispositivo, usando os toggles do próprio header.

Regra que guiou a conversão: **todo número vem do handoff**. `14.5px` virou
`text-[14.5px]`, não `text-sm`. A única correção global foi neutralizar o
`line-height: 1.5` que o preflight do Tailwind impõe — o handoff não tem reset e usa o
`normal` do browser, e sem isso cada chip, input e legenda ficava ~10% mais alto.

---

## Scripts

```bash
npm run dev              # front + API juntos
npm run check:provider   # faz uma edição de teste e diz se a chave funciona
npm run build            # compila os dois
npm test                 # vitest nos dois workspaces
npm run typecheck        # tsc --noEmit nos dois
```

Rode `npm run check:provider` assim que preencher a chave. Ele manda um PNG mínimo para o
provedor configurado e responde com ✅ e o tamanho do resultado, ou com o código do erro,
o detalhe técnico e o que fazer a respeito.

---

## Produção

Em `NODE_ENV=production` o Express passa a servir `web/dist` na mesma origem da API — sem
CORS, sem segunda hospedagem, sem configurar URL de API no bundle. Junto vêm `trust proxy`
(para o rate limit contar por visitante e não por proxy), CSP liberando `blob:` (é como
todas as imagens do app são exibidas) e encerramento gracioso no SIGTERM.

O deploy é `docker compose up -d --build`: um container com o app e outro com o Caddy, que
cuida do certificado HTTPS sozinho. O roteiro completo para Oracle Cloud — incluindo o
iptables que a OCI mantém fechado mesmo depois de você liberar a porta na Security List —
está em **[DEPLOY.md](./DEPLOY.md)**.
