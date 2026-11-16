# Implantação de uma nova loja

Guia para colocar a loja no ar para um cliente novo: hospedagem, banco, variáveis, configurações do painel, integrações, rotinas automáticas e os testes antes de liberar.

**Modelo:** cada cliente tem o **próprio deploy e o próprio banco**. O código é o mesmo para todos. O que muda por loja são as variáveis de ambiente e as configurações feitas no painel (`/admin/configuracoes`).

---

## 1. O que a loja entrega

| Área | Inclui |
|---|---|
| Loja | Catálogo com variações (cor/tamanho), busca, favoritos, carrinho, checkout em 3 etapas, conta do cliente, login com Google, recuperação de senha, chat com IA (opcional) |
| Pagamentos | Mercado Pago (no site ou redirecionado), NuPay, InfinityPay, pedido pelo WhatsApp, desconto no Pix |
| Pós-venda | Cancelamento com estorno automático, devoluções parciais/totais com estorno proporcional, cashback, avisos por e-mail |
| Logística | Frete local, fixo, Correios, Melhor Envio (cotação + etiqueta automática + rastreio) |
| Fiscal | Bling: pedido automático + NF-e automática enviada ao cliente |
| Marketing | Cupons, promoções relâmpago, carrinhos abandonados, interesse por produto, lista de espera, Meta Pixel + API de Conversões |
| Gestão | Dashboard, BI/DRE (GMV, CMV, ticket médio), funis, esteira de pedidos, alertas de ocorrências |

---

## 2. Antes de começar (pedir ao cliente)

- [ ] **Domínio** (ex.: `www.lojadocliente.com.br`) com acesso ao DNS
- [ ] **E-mail da loja** (ex.: `contato@lojadocliente.com.br`) e a senha. É o remetente de todos os e-mails
- [ ] **Logo** (PNG com fundo transparente), cores da marca, textos (sobre, políticas de troca/envio)
- [ ] **Gateway(s) de pagamento** escolhido(s) e acesso à conta (Mercado Pago, NuPay e/ou InfinityPay)
- [ ] **Melhor Envio:** conta criada e com saldo, se for usar etiquetas
- [ ] **Bling:** conta com certificado digital, natureza de operação e NCMs configurados, se for emitir nota
- [ ] **WhatsApp** de atendimento
- [ ] **Endereço de retirada/origem** dos envios (CEP)

---

## 3. Hospedagem e banco (Hostinger)

1. **Banco MySQL:** no hPanel, em *Bancos de dados → MySQL*, crie um banco e um usuário exclusivos para a loja. Anote host, porta, nome, usuário e senha.
2. **App Node.js:** crie o site como aplicação **Node.js 22** ligada a este repositório (branch `main`).
   - Comando de build: `npm run build`
   - Comando de início: `npm start`
3. **Pasta de imagens:** crie uma pasta **fora** da pasta do app (ex.: `/home/usuario/uploads-lojadocliente`). Ela vai no `PERSISTENT_UPLOAD_DIR`. Sem isso, as fotos enviadas somem a cada deploy.
4. **Domínio + SSL:** aponte o domínio para o app e ative o SSL. Tudo depende de `https` (webhooks e login).

> **Erro `uv_thread_create` ou "node process exited" sem erro de build:** é problema do ambiente da Hostinger (processos presos). **Não reinicie o app pelo painel**, porque isso piora. Abra um chamado no suporte da Hostinger.

---

## 4. Variáveis de ambiente

Modelo completo: [`.env.example`](../.env.example). No hPanel, cadastre em *Variáveis de ambiente* do app.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | Sim | `mysql://usuario:senha@host:3306/banco` |
| `NEXTAUTH_URL` e `NEXT_PUBLIC_SITE_URL` | Sim | Endereço público da loja, com `https` e **sem barra no final**. É usado nos links dos e-mails, nos webhooks e no SEO |
| `NEXTAUTH_SECRET` | Sim | Assina sessões e links (recuperação de senha, descadastro). Gere com `openssl rand -hex 32`. **Diferente em cada loja** |
| `CRON_SECRET` | Sim | Senha das rotinas automáticas. `openssl rand -hex 32`. **Diferente em cada loja** |
| `ADMIN_EMAIL`, `ADMIN_PASS`, `ADMIN_NAME` | Sim | Admin criado no build. A senha precisa ter 8 ou mais caracteres (ver item 5) |
| `PERSISTENT_UPLOAD_DIR` | Sim | Pasta das imagens fora do app (item 3) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Sim | E-mail da loja. Hostinger: `smtp.hostinger.com`, porta `465`. Gmail: `smtp.gmail.com`, `587` e **senha de app** |
| `GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Não | Login com Google (item 7.6) |
| `BLING_WEBHOOK_TOKEN` | Não | Senha do webhook de vendas do Bling |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` e `_SAFARI_ID` | Não | Notificações push |

> **Nunca reaproveite** `NEXTAUTH_SECRET` ou `CRON_SECRET` entre lojas. Se um vazar, só uma loja fica exposta.

---

## 5. Primeiro deploy

O `npm run build` faz tudo sozinho:
1. aplica as **migrações** do banco (`prisma migrate deploy`), criando as tabelas;
2. cria o **admin** e a linha de configurações da loja (`scripts/setup-admin.mjs`);
3. compila a loja.

**Senha do admin:**
- **Com `ADMIN_PASS` preenchido (8 ou mais caracteres):** essa é a senha.
- **Sem `ADMIN_PASS`:** o build gera uma senha aleatória e mostra **uma única vez** no log do build (`✓ Admin criado: email / senha`). Anote na hora.
- **Para trocar a senha depois:** altere `ADMIN_PASS` e faça um novo deploy. Sem `ADMIN_PASS`, a senha existente nunca é alterada.
- Não existe senha padrão. `admin123` e senhas com menos de 8 caracteres são recusadas.

Depois do deploy, entre em `https://DOMINIO/admin`.

---

## 6. Configurações no painel (`/admin/configuracoes`)

Siga as abas na ordem:

1. **Loja:** nome, logo, descrição, WhatsApp, Instagram, endereço, CNPJ.
2. **Aparência:** cores da marca (menu, botões, destaques). O contraste do texto é ajustado sozinho. Banners da home.
3. **Checkout e pagamentos:** o que pedir no checkout (e-mail e endereço), pagamentos (item 7), desconto no Pix, cashback e avisos de promoção.
4. **Frete e entregas:** tipo de frete (Entrega local, Fixo, Correios, Melhor Envio ou Híbrido), CEP de origem, embalagens padrão, prazo de separação.
5. **Integrações:** Melhor Envio, Bling e Meta Ads (item 7).
6. **Atendimento com IA (opcional):** chave da API e instruções do assistente.

Depois, cadastre as **categorias**, os **produtos** (com peso e medidas, se usar Melhor Envio) e as **variações**.

---

## 7. Integrações

### 7.1 Mercado Pago
- *mercadopago.com.br → Seu negócio → Configurações → Credenciais de produção*: copie a **Public Key** e o **Access Token**.
- **"Pagamento no site":** o cliente paga com cartão ou Pix sem sair da loja. Exige uma chave Pix cadastrada na conta do Mercado Pago.
- **Webhook:** não precisa configurar. O endereço é enviado a cada pagamento.

### 7.2 NuPay
- Peça ao Nubank as credenciais da API de checkout (*Client ID* e *Client Secret*).
- **Webhook:** automático, enviado em cada pagamento. Só funciona com `https`.

### 7.3 InfinityPay
- Basta o **Handle (InfiniteTag)**, que é o usuário do app **sem o `$`**. A API Key não é necessária.
- **Webhook:** automático. **A InfinityPay não tem estorno por API.** Cancelamentos e devoluções geram um alerta para o dono estornar pelo app.

### 7.4 Melhor Envio
- *melhorenvio.com.br → Integrações → Tokens*:
  - **Token de cotação:** calcula o frete.
  - **Token de etiquetas:** com permissão de envios. Com ele, a etiqueta é gerada sozinha quando o pagamento é aprovado.
  - **Secret do aplicativo:** valida os avisos de rastreio. Sem ele, o rastreio só atualiza pela rotina horária.
- Mantenha **saldo** na conta. Sem saldo, a etiqueta fica pendente e a rotina tenta de novo.
- Webhook de rastreio no app do Melhor Envio: `https://DOMINIO/api/webhooks/melhorenvio`

### 7.5 Bling (pedidos e NF-e)
1. *Bling → Integrações → Minhas Aplicações → Criar aplicativo*.
2. **URL de callback:** `https://DOMINIO/api/settings/bling/callback`
3. Copie o **Client ID** e o **Client Secret** para o painel e clique em **Autorizar com o Bling**.
4. **NF-e automática:** ative no painel e cadastre no app do Bling o webhook `https://DOMINIO/api/webhooks/bling/nfe`.
5. **Opcional:** o webhook de vendas `https://DOMINIO/api/webhooks/bling/vendas?token=BLING_WEBHOOK_TOKEN`.
- Pré-requisitos no Bling: certificado digital, natureza de operação e **NCM nos produtos**.

### 7.6 Login com Google
- *console.cloud.google.com → APIs e serviços → Credenciais → ID do cliente OAuth* (tipo Web).
- **Origem autorizada:** `https://DOMINIO`
- Coloque o Client ID nas duas variáveis `GOOGLE_CLIENT_ID` e `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, e faça um novo deploy.

### 7.7 Meta Ads
- *Gerenciador de Eventos*: copie o **ID do Pixel** e gere o **token da API de Conversões**.
- Valide em "Testar eventos" com o código de teste e **apague o código depois**.

---

## 8. Rotinas automáticas (cron)

Cadastre no hPanel (*Avançado → Cron Jobs*), trocando `DOMINIO` e `CRON_SECRET`:

| Rotina | Frequência | O que faz |
|---|---|---|
| `update-tracking` | a cada 1 hora | Atualiza o rastreio, destrava etiquetas, avisos de cashback e de promoção, e **expira pedidos não pagos há mais de 24h** (conferindo antes no gateway) |
| `nfe` | a cada 10 min | Confere as notas na SEFAZ e refaz as que falharam (só com Bling) |
| `abandoned-carts` | a cada 1 hora | E-mail de carrinho abandonado |

```
curl -sS "https://DOMINIO/api/cron/update-tracking" -H "x-cron-secret: CRON_SECRET"
curl -sS "https://DOMINIO/api/cron/nfe" -H "x-cron-secret: CRON_SECRET"
curl -sS "https://DOMINIO/api/cron/abandoned-carts" -H "x-cron-secret: CRON_SECRET"
```

- Uma resposta JSON (`{"ok":true,...}` ou `{"success":true,...}`) indica que está funcionando. O `update-tracking` mostra o resultado de cada parte no bloco `routines`.
- `{"error":"Unauthorized"}` indica um `CRON_SECRET` errado.
- Saída vazia no painel indica que a rotina ainda não executou desde que foi salva. Se continuar vazia, use `echo "rodou em $(date)"; curl ... 2>&1` para diagnosticar.

---

## 9. Testes antes de liberar para o cliente

Faça com valores baixos (ex.: um produto de teste de R$ 5).

- [ ] **Compra em cada gateway ativo:** o pedido vai para "Pago", o estoque baixa, chega o e-mail ao cliente e ao dono, e o sininho de novo pedido aparece no admin
- [ ] **Bling:** o pedido aparece no Bling e a NF-e é autorizada e enviada por e-mail
- [ ] **Melhor Envio:** a etiqueta é gerada e o rastreio aparece no pedido
- [ ] **Cancelamento de pedido pago:** o estorno chega no gateway, o estoque volta e o cliente recebe e-mail. Na InfinityPay, aparece o alerta de estorno manual
- [ ] **Devolução parcial com cupom:** o valor estornado é proporcional ao que foi pago, e não o preço cheio
- [ ] **Pedido abandonado:** crie um pedido sem pagar. Depois de 24h (ou voltando a data no banco) e rodando o `update-tracking`, ele deve aparecer como cancelado
- [ ] **Estoque:** tentar comprar mais unidades do que existem é bloqueado no checkout
- [ ] **Conta do cliente:** cadastro, login, Google, "Esqueci minha senha" (o e-mail chega e o link funciona uma única vez)
- [ ] **E-mails:** confira se não estão caindo no spam. Se estiverem, configure SPF e DKIM do domínio no DNS
- [ ] **Celular:** navegue pela loja e pelo checkout no celular

Depois de testar, **apague os pedidos e produtos de teste** e zere o estoque do produto de teste.

---

## 10. Operação do dia a dia (passar ao cliente)

- **Painel:** o topo mostra as pendências (pedidos pagos sem etiqueta, notas rejeitadas, estornos pendentes, ocorrências).
- **Pedidos → aba "Ocorrências":** situações que precisam de ação (estorno manual, pagamento depois do cancelamento, estoque insuficiente). Resolva e clique em **Resolvido**.
- **Devoluções:** aprovar já estorna o valor proporcional. Na InfinityPay ou no WhatsApp, faça o estorno e clique em **"Já estornei"**.
- **Cancelar** só vale antes do envio. Depois de enviado, o caminho é a devolução.
- **Confirmar pagamento à mão** é só para WhatsApp ou pagamento por fora. Nos gateways, o sistema confere antes.

---

## 11. Problemas comuns

| Sintoma | Causa / solução |
|---|---|
| Checkout mostra "Nenhuma forma de pagamento" | Nenhum gateway ativo com credenciais completas. Confira em Configurações → Checkout e pagamentos |
| Fotos somem depois do deploy | `PERSISTENT_UPLOAD_DIR` não configurado (item 3) |
| E-mails não chegam | `SMTP_*` errado, ou caindo no spam (configure SPF e DKIM) |
| Links dos e-mails apontam para `localhost` | `NEXTAUTH_URL` ou `NEXT_PUBLIC_SITE_URL` não configurados |
| Pedidos pagos sem etiqueta | Sem saldo ou sem token de etiquetas no Melhor Envio. A rotina tenta de novo sozinha |
| NF-e rejeitada | O motivo aparece no pedido. Corrija no Bling (normalmente NCM ou dados do cliente) e reenvie |
| Admin não entra depois do deploy | A senha é a do `ADMIN_PASS`. Sem ele, é a que apareceu no log do primeiro build |
| `uv_thread_create` / 503 | Ambiente da Hostinger: chame o suporte. **Não** reinicie pelo painel |

---

## 12. Atualizações

Todas as lojas usam o mesmo código. Um `git push` na `main` dispara o deploy de **cada** loja ligada ao repositório. Se a atualização tiver migração de banco, ela é aplicada sozinha no build de cada loja.
