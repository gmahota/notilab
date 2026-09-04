# /missao — Executar missão ponta a ponta

Missão: $ARGUMENTS

Executa o fluxo completo do agente `cto` (usa o subagente `cto` para orquestrar; nunca executes trabalho de área diretamente):

1. **Índice por grep**: procura no `tasks/_index.md` pelas palavras-chave do objetivo da missão — **não leias o índice inteiro** (~300 linhas, ~13k tokens por tarefa, e o grep encontra tudo o que a leitura integral encontraria). Só abre o arquivo da task que o grep apontar.
2. **Dedup**: procura task com objetivo semelhante à missão, comparando pelo campo **Objetivo** (nunca pelo nome). Se existir, retoma do campo **Handoff/Estado atual** em vez de criar nova; duplicadas antigas viram `cancelada-duplicada` apontando a original.
3. **Criar/retomar tasks**: decompõe a missão em tasks por domínio usando `tasks/_template.md`, com ID **reservado por `pnpm task:id <DS|FIN|TRV>`** e nunca escolhido por leitura da maior sequência do índice (TRV-076 — ler o índice em sessões paralelas produz a colisão), arquivo na pasta do domínio e registo no índice **no mesmo passo**. Task sem critério de aceitação verificável não pode ser delegada.
4. **Delegar com contexto mínimo**: roteia cada task ao agente certo pela tabela de roteamento do `.claude/agents/cto.md`, passando apenas os arquivos no escopo da task ativa — **sem histórico da conversa**. Os nomes de agente válidos são os arquivos de `.claude/agents/`: `architect`, `backend`, `database`, `docs-memory`, `frontend-terminal`, `integrations`, `product-finance`, `security`, `testing`.
5. **Revisão independente obrigatória**: nenhuma missão fecha sem revisão de um agente que **não** executou o trabalho — `testing` por omissão, ou o especialista do domínio que não implementou (a segurança revê-se com `security`, a arquitetura com `architect`). Máx. 2 ciclos de reprovação; depois estado `bloqueada` com motivo.
6. **Atualizar estados nos dois lugares**: toda mudança de estado atualiza o arquivo da task E a linha do `tasks/_index.md`.
7. **Resumo final**: tasks criadas/retomadas, estados finais, resultado da revisão independente e pendências.

**Missão ambígua**: escolhe a interpretação mais consistente com o `CLAUDE.md`, regista essa interpretação no campo "Decisões e interpretações" da task e segue em frente — sem ciclos de pergunta ao utilizador.
