# Handoff: NotiLab — Redesenho "Bandeja" (/now + /now/explorar)

## Overview
Redesenho completo da experiência imersiva do NotiLab (Next.js, repo `notilab`):
1. **Agora (`/now`)** — feed vertical imersivo com **bandeja** de categorias em grelha 3D, onboarding de personalização, ritmo de leitura por geração, painel de contexto/fontes e visualizador **"Entrar na cena"** (com timeline slider).
2. **Explorar (`/now/explorar`)** — **mural editorial vivo** curado por IA que muda todos os dias às 05:00, com transição para o **universo do tema** (grafo de subtemas ligados).
3. Vista secundária de mapa e mockups mobile para referência.

Princípio do produto: **SEE FAST → UNDERSTAND DEEPLY → ENTER THE SCENE**, com personalização explícita ("quem quer cinema não vê basebol").

## About the Design Files
Os ficheiros em `designs/` são **referências de design criadas em HTML** (protótipos interativos que mostram o aspeto e comportamento pretendidos) — **não são código de produção**. A tarefa é **recriar estes designs no codebase Next.js existente** (App Router, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, lucide-react), seguindo os padrões já estabelecidos em `components/immersive/` e `app/globals.css`. Abre cada `.dc.html` num browser para ver o protótipo a funcionar; o código-fonte de cada um contém o markup (entre `<x-dc>`) e a lógica (classe `Component`) que documentam exatamente estados, transições e estilos.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos, animações e copy são finais. Recriar pixel-perfect usando os tokens já existentes em `app/globals.css` (o design usa exatamente essa paleta) e componentes shadcn/lucide existentes.

## Screens / Views

### 1. Agora — feed vertical (`designs/Agora - Bandeja.dc.html`)
- **Fundo**: `#050508`; cada história ocupa 100vh/100dvh.
- **Histórias com imagem**: imagem full-bleed (object-fit cover) + vinheta `linear-gradient(to top, rgba(0,0,0,.7) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,.05) 100%)` (intensidade tweakável 40–90%) + scrim topo `rgba(0,0,0,.5)→transparent 30%`.
- **Histórias sem imagem (modo texto)**: gradientes editoriais derivados da cor da categoria: `radial-gradient(130% 90% at 75% 15%, {cor}2e, transparent 60%) + radial-gradient(90% 70% at 15% 90%, {cor}1f, transparent 55%) + linear-gradient(165deg, #0B0B0F, #101018 55%, #0B0B0F)`, com glifo lucide da categoria a 420px, opacity .1, rotate(-8deg), à direita.
- **Pills topo** (top 76px, left 24px): pill da categoria `{cor}d9`, branco 12px/700, radius 999; **AO VIVO** `#E11D2E`, 11px/800, letter-spacing .08em, ponto branco 6px com `livePulse 1.4s`; **Em alta** verde `rgba(57,255,20,.12)` borda `.35`, texto `#39FF14`.
- **Bloco editorial** (bottom, padding 80px 88px 108px 24px, max-width 720px):
  - Meta: pin lucide 13px + local (branco .85, 500) · tempo · fonte — 13px, branco .6.
  - Título: Geist 800, `clamp(26–30px, 3.4–3.8vw, 44–48px)` conforme ritmo, line-height 1.08, letter-spacing -0.03em, text-wrap balance, text-shadow `0 2px 24px rgba(0,0,0,.5)`.
  - Resumo: `clamp(14–17px, 1.2–1.5vw, 17–20px)`, branco .82, lh 1.6, max-width 560px. No ritmo **Calmo** mostra o texto longo ("o que aconteceu") em vez do teaser.
  - Botões: **Ver contexto** primário `#0A7FFF`, h40, radius 12, glow `0 0 12px rgba(10,127,255,.45), 0 0 40px .2`; **Entrar na cena** (só quando a história tem cena) gradiente `rgba(57,255,20,.18)→rgba(10,127,255,.18)`, borda `rgba(57,255,20,.45)`, ícone box lucide; **Porque vejo isto?** glass `rgba(255,255,255,.05)` blur 20px.
- **Action rail** (right 20px, bottom 108px, coluna gap 14): 4 botões círculo 46px glass `rgba(255,255,255,.05)` blur 24, borda `rgba(255,255,255,.08)`: like (ativo: verde `#39FF14`, fill), guardar (ativo: azul `#4da3ff`), partilhar, **menos disto** (eye-off, hover vermelho `#ff6b6b`).
- **Top bar**: logo (assets/logo.png, 26px) + contador "n / total"; à direita: botão de **ritmo** (Dinâmico/Equilibrado/Calmo), **chip de filtro** (ponto na cor da categoria + nome, borda `{cor}66`, glow `{cor}33`) e botão **Bandeja** (grid icon + kbd "G").
- **Progress dots** (right 8px, centro vertical): ativo 6×22px na cor do filtro com glow; inativos 4×4 `rgba(255,255,255,.25)`; transição `.35s cubic-bezier(.22,1,.36,1)`.
- **Nav inferior** (pílula central, bottom 16): glass `rgba(10,10,14,.72)` blur 28 sat 160%, radius 999; item ativo gradiente azul `rgba(10,127,255,.9)→.6` + glow. Itens: Agora ⚡, Perto 📍, Explorar 🧭 (→ /now/explorar), Seguir 👥, Perfil 👤 (lucide: zap, map-pin, compass, users, user).

### 2. Onboarding (primeira visita)
- Fundo `radial-gradient(120% 100% at 50% 0%, #0b1224, #050508 55%)`. Logo + "NEWS YOU CAN ENTER." (13px, caps, .12em).
- H1 "Monta a tua bandeja" `clamp(30px, 4.4vw, 48px)` 900. Sub: "Escolhe pelo menos 3 temas…".
- **Chips de temas** (wrap, gap 10): pill 12×18px padding, 14px/600, borda 1.5px; selecionado: `{cor}33` bg, borda `{cor}`, glow `{cor}40`.
- **Ritmo de leitura**: 3 cartões (Dinâmico ⚡ / Equilibrado ✦ / Calmo 👥) — selecionado: borda `rgba(57,255,20,.55)`, bg `.08`.
- CTA h52 radius 16: desativado até 3 seleções ("Escolhe mais N temas"); ativo `linear-gradient(135deg, #0A7FFF, #0663c9)` + glow. Link "Ver tudo primeiro".
- Persistir em localStorage/BD: `{ followed: string[], pace: 'dinamico'|'equilibrado'|'calmo' }`.

### 3. Bandeja (overlay, botão ou tecla G)
- Overlay `rgba(5,5,8,.78)` blur 32px sat 140%; container max-width 980px, `perspective: 1400px`.
- Kicker verde "A TUA BANDEJA" + H2 "O que queres ver agora?" `clamp(28px, 3.6vw, 42px)` 900.
- **Grelha**: `repeat(auto-fill, minmax(210px, 1fr))`, gap 14. Cartão: min-height 148, padding 18, radius 20, bg `radial-gradient(130% 110% at 80% 0%, {cor}52, transparent 55%) + linear-gradient(160deg, #14141a, #0B0B0F)`; ícone lucide 26px branco; badge "A SEGUIR" `rgba(255,255,255,.14)`; nome 19px/800 + contagem 12px. Ativo: borda na cor + glow `{cor}55`. **Para si** primeiro: gradiente azul→verde.
- Entrada: `trayCardIn .55s cubic-bezier(.22,1,.36,1)` — translateY(40px) rotateX(14°) scale(.92) → 0, stagger 45ms/cartão. Hover: translateY(-8px) scale(1.03).
- Secção "Silenciados — menos disto": chips dashed com "· repor".
- Clicar num tema fecha a bandeja, filtra o feed (index 0) e mostra toast "Bandeja: {tema}".

### 4. Painel de contexto (swipe ← ou "Ver contexto")
- Sheet direito `min(440px, 100vw)`, bg `rgba(16,16,20,.97)` blur 30, borda esq `.09`, shadow `-24px 0 80px rgba(0,0,0,.55)`; entrada `translateX(105%)→0` `.55s cubic-bezier(.22,1,.36,1)`; backdrop `rgba(0,0,0,.45)`.
- Header 180px: imagem ou gradiente da categoria + fade para `#101014`.
- Conteúdo: pill categoria + fonte·tempo; título 22px/800; secção "O QUE ACONTECEU" (label 11px caps .1em branco .45); caixa **"PORQUE É QUE IMPORTA"** borda `rgba(10,127,255,.25)` bg `.06` radius 14, label `#4da3ff`; grelha 2×2 de **factos** (valor 20px/800 + label 12px, cartões `rgba(255,255,255,.04)`); lista de **fontes** com check verde + hora.

### 5. "Porque vejo isto?" (popover)
Cartão 320px, `rgba(16,16,20,.92)` blur 28, radius 16; bullets azuis 5px com razões do ranking (ex.: "Segues o tema Moçambique", "Confirmada por 5 fontes, incluindo uma fonte oficial"); link "Ajustar a minha bandeja →".

### 6. Entrar na cena (visualizador imersivo)
- **Loading**: só após ação explícita; ícone box a flutuar, "A carregar a cena · N%", nota "Reconstrução comprimida · 24 MB · só carrega quando pedes", barra 4px gradiente azul→verde; cancelar.
- **Palco**: fundo `radial-gradient(120% 100% at 50% 100%, #0a1220, #030306 60%)`; plano `min(78vw, 900px) × min(60vh, 560px)`, radius 18, `perspective: 1300px`, shadow `0 60px 120px rgba(0,0,0,.7)`.
  - Cena **mapa** (Chido): grelha 56px `rgba(255,255,255,.05)` + manchas de inundação azuis (ver timeline) sobre `linear-gradient(130deg, #0e1a13, #10181f 60%, #0b1118)`; rotateX ~45°.
  - Cena **foto** (Benfica): imagem cover com parallax leve.
- **Hotspots**: círculos 34px numerados, borda `rgba(57,255,20,.7)`, glow verde, `livePulse 2.2s`; ativo: fundo `#39FF14`, texto escuro. Clique abre anotação (cartão 340px, borda verde .3, bottom 208px).
- **Modo guiado**: presets de câmara (rotateX/rotateY/scale) com transição `.9s cubic-bezier(.22,1,.36,1)`, controlos ‹ label n/total ›. **Exploração livre**: pointer-move orbita (±10° X, ±16° Y, transição .12s linear).
- **Timeline slider** (só cenas mapa): painel bottom 84px, `min(460px, 100vw-48px)`; label dinâmico ("14 Dez, 18:00 — Ciclone formado no canal" → "15 Dez, 12:00 — Inundações em vários bairros"), input range 0–100 `accent-color #39FF14`, marcas nas 4 horas-chave. O valor t escala as manchas de inundação: raio `14%+0.41t% × 11%+0.34t%` e opacidade `0.28+0.0022t`.
- Sair: botão "Sair da cena" ou Esc.

### 7. Explorar — Mural (`designs/Explorar - Mural.dc.html`)
- **Header**: logo + "Explorar / O mural de hoje · {data}"; à direita "Edição #142 · curada por IA às 05:00" e "Mood de hoje: **Mundo em fúria** (`#FF6B35`) · amanhã: desconhecida"; dropdown **"Vista de hoje: Mural ▾"** (Mural hoje / Constelação espreitar / Globo espreitar / Linha do tempo, Mosaico, Heatmap, Arquivo #1–141 em breve).
- **Frase do editor invisível** (itálico, branco .62) + pipeline "12 843 notícias → 91 histórias → **1 edição**" (verde).
- **Entrada**: overlay "✦ A IA está a montar a edição #142…" (1.4s) enquanto os blocos "caem na mesa": keyframe `placeBlock` (.8s `cubic-bezier(.3,1.2,.35,1)`, stagger 75ms) de offsets/rotações aleatórias determinísticas para a posição final (offset ±5px + rotação ±1.3°).
- **Grelha**: 12 colunas × 6 filas desiguais (`1.08fr .92fr 1.12fr .88fr .98fr 1.02fr`), gap 11, radius 11, bordas `{cor}2b`. Blocos (11):
  - **Hero** (5×4): "BENFICA CAMPEÃO" `clamp(34px, 4.4vw, 64px)` 900 sobre foto escurecida; chips de factos.
  - **AO VIVO** (4×2): vermelho `#FF3B4A`, ponto pulsante, contador "30.412 afectados" **live** (incrementa aleatoriamente ~2.4s).
  - **Cripto** (3×2): "$150.214" tabular-nums **live** (random walk) + chip verde "▲ +2,3% · últimos 20 min" calculado do preço.
  - **3D** (2×2): wireframe verde; **hover = preview holograma** — grelha em perspetiva (rotateX 38°) com `gridPan 1.4s` durante 3s; **clique = zoom-para-o-feed** (restantes dispersam, o bloco escala 1.6, navega após 680ms). O hero tem o mesmo zoom.
  - **ANTES ⟶ DEPOIS** (3×2): fundo dividido; hover anima a linha (`baSweep 1.8s` alternate, background-size 220%).
  - Restantes: foto Cannes, Tech, Política, Ciência, Streaming, Ponte.
  - Todos: glow que respira (`glowBreathe` 5.5–13s dessincronizado, cor da categoria) e hover scale(1.035)+brightness(1.16).
  - **Responsivo**: viewport <820px de altura esconde chips; <640px esconde subs; kicker+título têm `flex-shrink: 0` e nunca são cortados.
- **Ticker cinético** (bottom, 38px): manchetes com emojis em marquee (42s, tweakável), inclui os números live.
- **Partículas**: 6 pontos 2–3px azul/verde, `floatDust` 9–15s, opacity ≤.18.

### 8. Universo do tema (clicar num bloco não-hero/3D)
- Transição: blocos dispersam (translate ±60px, rotate ×6, scale .8, opacity 0, stagger 30ms, .5s) → universo fade-in.
- **Orbe central** `clamp(160px, 18vw, 230px)`: radial da cor do tema, `orbPulse 3.2s`; "UNIVERSO / {tema} / n histórias hoje".
- **Nós**: pills glass `rgba(12,14,20,.85)` borda `{cor}55`, ponto 8px com glow; entrada `nodeIn .5s` stagger 90ms; ativo: bg `{cor}30` + glow.
- **Ligações**: SVG lines `stroke rgba(255,255,255,.18)` dasharray 1.2/1 com `dashFlow 1.6s`; ativas na cor do tema. Cadeias narrativas, ex. **Bitcoin → ETFs → BlackRock → SEC → EUA**.
- Clicar num nó → cartão da história → "Mergulhar no feed" (→ /now filtrado).
- "Voltar ao mural" (top-left).

### 9. Mobile (`designs/NotiLab - Mobile.dc.html`)
Três ecrãs (390×844) em moldura iOS: Agora, Bandeja, Explorar. **Safe area: conteúdo começa a 62px do topo**. Nav em pílula flutuante (bottom 34px acima do home indicator). Hit targets ≥44px.

## Interactions & Behavior
- **Feed**: wheel (threshold 60, cooldown 550ms), drag vertical (threshold 70px), setas ↑↓; swipe horizontal ← abre contexto, → fecha; tecla **G** = bandeja; **Esc** fecha overlays (cena tem prioridade). Spring: `transform .75s cubic-bezier(.22,1,.36,1)` (ritmo Calmo/subtil: `.35s ease-out`).
- **Menos disto**: remove a categoria do feed (volta ao index 0), toast "Vais ver menos de {cat}. Podes repor na bandeja."; repor na secção "Silenciados".
- **Ranking "Para si"**: histórias das categorias seguidas primeiro, resto como descoberta; razões expostas no popover.
- **Toasts**: pílula central bottom 78px, `rgba(16,16,20,.94)` blur 24, 2.4s. ⚠️ envolver num wrapper posicionado (`left:50%; translateX(-50%)`) separado do elemento animado — a animação de entrada sobrepõe o transform.
- **URL**: manter `?story={slug}` em sync (já existe em `story-feed.tsx`).

## State Management
- Cliente: `index, filter, trayOpen, ctxOpen, whyOpen, sceneOpen/Story/Loading/Progress/Mode/Step/Hotspot/Time, pace, followed[], hidden[], liked{}, saved{}` — Zustand ou estado local como no `StoryFeed` atual.
- Persistência: `followed`, `pace`, `hidden` (localStorage → BD com auth).
- Mural: `view ('mural'|tema), node, assembling, peek, baHover, zoomTo, btc/aff live` — os valores live vêm de SSE/polling na implementação real.
- Dados: alimentado por `GET /api/news/feed` (tipos em `components/immersive/types.ts`); a cena/timeline/factos exigem campos novos (ver `SpatialAsset`, `TimelineEvent`, `Claim` no plano de dados do PRD).

## Design Tokens
(iguais a `app/globals.css` — usar os tokens existentes)
- **Cores**: fundo `#050508`/`#0B0B0F`; primário Electric Blue `#0A7FFF`; secundário Neon Green `#39FF14`; live `#E11D2E`/`#FF3B4A`; texto `#F7F7F7` com opacidades .85/.75/.6/.45; categorias: Moçambique `#E60000`, Desporto `#39FF14`, Cinema `#7c3aed`, Tecnologia `#00D4FF`, Economia `#FFD23F`, Cultura `#FF6B35`, Política `#007BFF`, Leis `#9B59B6`, Ciência `#2ECC71`.
- **Tipografia**: Geist (400–900); títulos 800–900 com letter-spacing -0.02/-0.03em; labels caps 10–12px .1–.14em; números `font-variant-numeric: tabular-nums`.
- **Glass**: `rgba(255,255,255,.04–.07)` + `backdrop-filter: blur(24–32px) saturate(140–160%)` + borda `rgba(255,255,255,.07–.14)`.
- **Glows**: azul `0 0 12px rgba(10,127,255,.45), 0 0 40px .2`; verde `0 0 8px rgba(57,255,20,.4), 0 0 20px .14`.
- **Radius**: pills 999; botões 10–12; cartões 14–20; blocos do mural 11.
- **Easing**: assinatura `cubic-bezier(.22,1,.36,1)`; entrada com overshoot `cubic-bezier(.3,1.2,.35,1)`; saída `cubic-bezier(.5,0,.75,0)`.

## Assets
`assets/` (vieram de `notilab/public/`): `logo.png`, `benfica.png` (benfica-football-stadium-celebration), `cinema.png` (lisbon-cinema-festival-red-carpet), `eu-ai.png` (european-parliament-ai-law). Ícones: **lucide-react** (zap, map-pin, compass, users, user, flame, heart, bookmark, share-2, eye-off, info, box, layout-grid, landmark, trophy, clapperboard, cpu, trending-up, palette, scale, flask-conical, sparkles, chevrons, x).

## Screenshots
`screenshots/`: 01-agora (feed), 02-agora (bandeja), 03-agora (contexto), 04-agora (cena 3D com timeline), 01/02-explorar (mural + universo), mobile (3 iPhones).

## Prompts de implementação
`IMPLEMENTATION_PROMPTS.md` — 8 prompts sequenciais prontos a colar no Claude Code, fase a fase.

## Files
- `designs/Agora - Bandeja.dc.html` — feed + onboarding + bandeja + contexto + porquê + cena com timeline (protótipo principal)
- `designs/Explorar - Mural.dc.html` — mural vivo + universo do tema
- `designs/Explorar - Mapa.dc.html` — vista secundária de mapa (clusters + zoom)
- `designs/NotiLab - Mobile.dc.html` — mockups mobile em moldura iOS
- `designs/Agora - Atual (recriação).dc.html` — estado atual do /now (baseline de comparação)
- `assets/` — imagens e logo
