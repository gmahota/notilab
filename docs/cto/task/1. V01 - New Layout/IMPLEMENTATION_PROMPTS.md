# Prompts de implementação — Claude Code

Prompts sequenciais para implementar o redesenho no repo `notilab` (Next.js App Router, TypeScript, Tailwind 4, shadcn/ui, Framer Motion, lucide-react). Cola um de cada vez no Claude Code, **na ordem**. Cada prompt assume que o pacote `design_handoff_notilab_redesign/` está na raiz do repo (ou anexa o README.md + screenshots relevantes).

---

## Fase 1 — Fundações (personalização + ritmo)

```
Lê design_handoff_notilab_redesign/README.md (secções 2, Design Tokens e State Management).

No repo notilab, cria a camada de personalização do feed /now:
1. Um store (Zustand ou context) `useBandejaStore` com: followed: string[] (slugs de categoria), hidden: string[], pace: 'dinamico'|'equilibrado'|'calmo', persistidos em localStorage na chave 'notilab:bandeja:v1'.
2. Um componente OnboardingBandeja (client) que aparece na primeira visita a /now: escolha de ≥3 categorias (chips com a cor de cada categoria vinda da BD) + escolha de ritmo (3 cartões: Dinâmico/Equilibrado/Calmo). Segue o visual da secção "Onboarding" do README (fundo radial #0b1224→#050508, CTA com glow azul, link "Ver tudo primeiro").
3. O ritmo controla: escala tipográfica do StoryCard (título/resumo), duração das transições do feed (.75s cubic-bezier(.22,1,.36,1) vs .35s ease-out) e se o resumo mostra tldr (curto) ou summary (longo, no Calmo).
Não alteres ainda o StoryFeed além de ler o store. Usa os tokens de app/globals.css; screenshot de referência: screenshots/01-agora.png.
```

## Fase 2 — Feed Agora redesenhado

```
Lê design_handoff_notilab_redesign/README.md (secção 1 "Agora — feed vertical" e "Interactions & Behavior") e screenshots/01-agora.png.

Redesenha components/immersive/story-card.tsx e story-feed.tsx para o novo visual:
- top bar com logo, contador "n/total", botão de ritmo, chip do filtro ativo (cor da categoria) e botão Bandeja (ícone layout-grid + kbd G);
- bloco editorial inferior (local com map-pin, título clamp 800–900, teaser, botões "Ver contexto" e "Porque vejo isto?");
- action rail com 4 botões glass de 46px (like/guardar/partilhar/menos-disto com eye-off);
- progress dots verticais à direita na cor do filtro;
- nav inferior em pílula central flutuante (substitui a barra atual em mobile e o rail em desktop);
- histórias sem imagem usam o modo texto: gradientes da cor da categoria + glifo lucide gigante (opacity .1);
- filtro por categoria: o feed mostra só a categoria ativa; "Para si" ordena categorias seguidas primeiro; "menos disto" adiciona a hidden[] com toast.
Mantém o sync do URL ?story= e a paginação existente. Cuidado com o toast: wrapper posicionado separado do elemento animado (ver README).
```

## Fase 3 — Bandeja (grelha 3D)

```
Lê o README (secção 3 "Bandeja") e screenshots/02-agora.png.

Cria components/immersive/bandeja-overlay.tsx: overlay full-screen (blur 32px) aberto pelo botão Bandeja ou tecla G, com grelha auto-fill minmax(210px,1fr) de cartões de categoria: gradiente radial da cor, ícone lucide, badge "A SEGUIR", contagem de histórias de hoje, cartão "Para si" primeiro (gradiente azul→verde). Entrada com Framer Motion: stagger 45ms, y 40px + rotateX 14° + scale .92 → identidade, cubic-bezier(.22,1,.36,1). Hover: y-8 scale 1.03. Secção "Silenciados" com chips de repor. Clicar num tema fecha, filtra o feed e faz toast.
```

## Fase 4 — Contexto + "Porque vejo isto?"

```
Lê o README (secções 4 e 5) e screenshots/03-agora.png.

Evolui components/immersive/story-context-panel.tsx para o novo layout: header de 180px com media, pill da categoria, "O QUE ACONTECEU", caixa azul "PORQUE É QUE IMPORTA", grelha 2×2 de factos-chave e lista de fontes com check verde + hora. Abre também com swipe horizontal ← no feed. Acrescenta o popover "Porque vejo isto?" com as razões do ranking (segues X, em alta, fonte oficial, perto de ti) — os dados vêm de um novo campo `reasons: string[]` no payload do feed (adiciona ao endpoint e ao tipo FeedArticle).
```

## Fase 5 — Entrar na cena (+ timeline)

```
Lê o README (secção 6) e screenshots/04-agora.png.

Cria components/immersive/spatial-story-viewer.tsx (client, lazy): só monta após clique em "Entrar na cena"; loading com % e nota de tamanho comprimido; palco em perspetiva (React Three Fiber se disponível, senão CSS 3D como no protótipo); hotspots numerados com anotações; modo guiado (presets de câmara com transição .9s) vs exploração livre (orbit por pointer); timeline slider 0–100 para cenas de mapa que escala a mancha de inundação e muda o label temporal (4 marcos do Chido). Botão "Entrar na cena" no StoryCard só quando a história tem spatialAsset. Prepara a interface para assets .splat/.ply futuros (props: assetUrl, fallback, hotspots[], cameraPresets[], timeline[]).
```

## Fase 6 — Explorar: mural vivo

```
Lê o README (secções 7 e 8) e screenshots/01-explorar.png + 02-explorar.png.

Substitui app/now/explorar/page.tsx pelo mural editorial: header com "Edição #N · curada por IA às 05:00", mood do dia, frase do editor (gerada pela pipeline de IA — por agora campo na BD), pipeline "X notícias → Y histórias → 1 edição", dropdown "Vista de hoje"; grelha 12×6 com filas desiguais e 11 blocos tipados (hero, live com contador real-time, stat cripto live, foto, 3D com preview hover, antes/depois com sweep, plain) — tamanhos por importância; entrada "placeBlock" (blocos caem na mesa, overlay "A IA está a montar a edição…"); glow que respira; ticker marquee; partículas subtis. Clique num bloco → transição de dispersão → universo do tema: orbe central pulsante + nós ligados por linhas SVG animadas (cadeias narrativas, ex. Bitcoin→ETFs→BlackRock→SEC→EUA), nó → cartão → feed filtrado. Hero e bloco 3D fazem zoom-para-o-feed em vez de universo. Respeita as regras responsivas (kicker+título nunca cortados; chips/subs cedem primeiro; flex-shrink:0).
```

## Fase 7 — Dados e edição diária

```
Lê o README (State Management) e o PRD do projeto.

Estende o schema Prisma e a pipeline: DailyEdition ganha layoutType ('mural'|'constelacao'|...), moodLabel, editorSentence, pipelineStats {raw, stories}; Story ganha reasons[], facts[], sources[] (com hora), spatialAsset?, timelineEvents[]. O cron das 05:00 (já existente em app/api/cron) passa a: escolher layout do dia, calcular mood, gerar a frase do editor (via provider de IA com fallback), ordenar os blocos do mural por importância como narrativa. Expõe GET /api/edition/today para o Explorar. Seed com os dados demo do protótipo (Chido, Benfica, Gemini 3, Palma de Ouro, BTC, etc.).
```

## Fase 8 — Mobile + polish

```
Lê screenshots/mobile.png e o README (secção 9).

Passa tudo em revista mobile-first: safe areas iOS (conteúdo ≥62px do topo, nav acima do home indicator), hit targets ≥44px, gestos touch no feed e na cena, prefers-reduced-motion (desativa placeBlock/particulas/glow e usa o ritmo subtil), dark mode only por agora. Corre typecheck, lint, build e testes; corrige tudo.
```
