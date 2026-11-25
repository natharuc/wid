<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/01-logo/svg/wid-logo-branco.svg">
  <img src="brand/01-logo/svg/wid-logo-grafite.svg" alt="WID" width="280">
</picture>

**What I did?** Registro local de tarefas e dedicação humana, com painel web e MCP para agentes.

O WID responde **o que fiz em cada dia, quanto tempo dediquei a cada tarefa e quantas horas tenho registradas no mês**. Intenções, avanços, decisões, bloqueios e entregas ficam persistidos com sua origem. Estimativas continuam identificadas como estimativas.

## Rodar localmente

Node.js **22.13+**. Não precisa de Docker nem de instalar um servidor de banco: o padrão é PostgreSQL embutido com [PGlite](https://pglite.dev/), persistido em disco.

Instale o pacote compilado da release:

```sh
npm install -g https://github.com/natharuc/wid/releases/latest/download/wid.tgz
wid setup
wid start --background
```

Abra **http://127.0.0.1:4318**. Ative os agentes pela página **Agentes** ou pela CLI:

```sh
wid agent codex
# opcionais, se você usa esses agentes:
wid agent claude
wid agent cursor
```

Abra uma **nova sessão do agente** para carregar o MCP e as instruções. `npm install` não modifica configurações globais; `wid setup` apenas detecta. A ativação é explícita e reversível.

O nome `wid` no npm já pertence a outro projeto. Este pacote se chama **`@natharuc/wid`**, com executável **`wid`**. A versão 0.5.0 está distribuída pelo GitHub; não está publicada no registro npm.

### Atualizar a instalação

A instalação por tarball não acompanha automaticamente as próximas releases com `npm update`. Para buscar a última versão publicada:

```sh
wid stop
npm install -g --prefer-online https://github.com/natharuc/wid/releases/latest/download/wid.tgz
wid start --background
wid --version
```

Tarefas, configurações e histórico ficam no diretório de dados, separado do pacote. A atualização no mesmo caminho preserva a configuração dos agentes. Para fixar a release 0.5.0, use `https://github.com/natharuc/wid/releases/download/v0.5.0/wid.tgz`.

Também é possível instalar da fonte, com build local automático:

```sh
npm install -g github:natharuc/wid
```

## MVP

- Tarefas com empresa, projeto e referências opcionais a chats, issues, Tasks e PRs.
- Contextos dinâmicos escolhidos pelo agente: texto livre, grupos e relatórios filtrados, com reclassificação auditável.
- Histórico persistente: intenção, início, avanço, decisão, bloqueio, conclusão e cancelamento.
- Tempo por **tarefa/dia**, estimado pelo agente com evidência e confiança ou informado pelo usuário.
- Visão diária, linha do tempo e calendário mensal com cobertura explícita.
- Interface React com componentes DaisyUI, temas corporate (claro) / business (escuro) e layout Tailwind; sem CSS próprio. O seletor de sol/lua no cabeçalho salva a escolha no navegador; na primeira abertura, segue o sistema. O tema é aplicado antes da renderização da interface.
- MCP local por **stdio** e **Streamable HTTP**, usando o SDK oficial.
- Detecção e ativação/desativação de Codex, Claude Code e Cursor.
- Instruções globais gerenciadas para Codex e Claude Code; instruções no MCP para todos.
- Hook opcional `SessionStart` no Claude Code, como lembrete de registro.
- Exportação JSON com fontes, horários originais e histórico de correções.
- URLs de GitHub e Azure DevOps como atalhos configuráveis. Sem sincronização ou credenciais externas nesta versão.

## Como as horas são calculadas

Cada registro de tempo é um **total acumulado da tarefa naquele dia e categoria**. Atualizar uma estimativa de 40 para 60 minutos resulta em **60**, não 100. Uma nova revisão tem outra chave idempotente; reenviar o mesmo comando usa a mesma chave e não duplica o registro.

Categorias:

| Categoria | Significado |
| --- | --- |
| `human_estimated` | Total humano estimado para a tarefa/dia; requer justificativa e confiança. |
| `human_measured` | Total humano medido ou explicitamente informado pelo usuário para a tarefa/dia. |
| `agent_run` | Total de execução do agente; fora das horas humanas. |
| `wait` | Total de espera ou jobs; fora das horas humanas. |

Para cada tarefa/dia, o total humano é o **maior entre o medido e o estimado**. A parcela estimada do relatório é a diferença positiva entre estimativa total e medição. Exemplo: estimativa de 90 min com 30 min medidos → 90 min humanos, sendo 30 medidos + 60 estimados. Se você tem apenas uma parte adicional estimada, informe na estimativa o total, incluindo o já medido.

O agente deve ler o relatório do dia antes de revisar uma estimativa, considerar outras sessões e informar a base da estimativa e a confiança. Tempo decorrido entre mensagens, inatividade, execução delegada e espera não equivalem a trabalho humano. Se a conversa não fornece evidência suficiente, o tempo continua desconhecido.

O mês soma os totais diários por tarefa. **É um total registrado com cobertura parcial**, não uma declaração de jornada completa. Dias sem evidência não significam ausência de trabalho. O WID alerta sobre dias acima de 24h; sobreposição entre tarefas precisa ser revisada mesmo abaixo desse limite. O MVP não contém cronômetro nem detector de presença.

```sh
wid report 2026-11
```

## Contextos dinâmicos

O seletor no cabeçalho define o contexto de trabalho para toda a navegação. Tarefas, contadores, histórico, horas diárias/mensais, páginas de detalhe e exportações seguem a seleção. A escolha fica na URL e é lembrada no navegador; links internos preservam o escopo, inclusive em outra aba. `Todos os contextos` é uma opção explícita. Um contexto sem tarefas continua vazio, sem ampliar silenciosamente a consulta. Ao trocar de contexto numa página de tarefa, o painel abre a lista do novo grupo. A página de detalhe também verifica o contexto na API e não retorna dados de outro grupo.

Fuso horário e ativação de agentes continuam gerais. GitHub, Azure DevOps, Slack e outras ferramentas são referências por tarefa; não há configuração global de ferramenta. O contexto escolhido no painel filtra a visualização; cada agente continua escolhendo e enviando o contexto da tarefa pelo MCP.

O agente decide o contexto de cada tarefa, separado de empresa e projeto. **Não existe uma lista fechada nem um cadastro obrigatório.** `MAG`, `POLLARIS`, `SEDUCAO` e `OUTROS` são exemplos; `Pesquisa / Cliente Á` ou qualquer outro nome também é válido.

Antes de criar uma tarefa, o agente consulta `wid_list_contexts` para reaproveitar um nome quando fizer sentido e envia `context` explicitamente em `wid_create_task`. Um nome novo cria o grupo a partir desse registro. O painel monta a lista de grupos dinamicamente, agrupa as tarefas e permite filtrar atividades, horas diárias e mensais. A comparação ignora caixa, acentos e espaços repetidos; o nome legível é preservado.

```json
{
  "title": "Revisar o fluxo de autenticação",
  "context": "Pesquisa / Cliente Á",
  "project": "Portal",
  "idempotencyKey": "session-123:auth-intention"
}
```

Tarefas antigas sem contexto aparecem em `OUTROS`. O agente pode classificá-las ou corrigir um grupo sem duplicar a tarefa:

```json
{
  "taskId": "UUID da tarefa existente",
  "kind": "context_changed",
  "context": "Pesquisa / Cliente Á",
  "note": "Classificação definida para este trabalho.",
  "idempotencyKey": "session-123:classify-auth"
}
```

Essa alteração é registrada no histórico, com contexto anterior e novo. **Todo o histórico e as horas da tarefa passam a ser agrupados pelo contexto atual.** Para consultas de um grupo, envie `context` em `wid_list_tasks`, `wid_report_day` e `wid_report_month`; omita para consultar todos. O MCP e as instruções globais deixam essa escolha explícita. A API continua aceitando clientes antigos sem o campo, usando `OUTROS`; isso é compatibilidade, não uma restrição de catálogo.

## MCP

### Acompanhar uma tarefa

O título de uma tarefa abre `/task/{id}`: intenção, estado, histórico completo, horas por dia e referências para os sistemas de origem. A URL pode ser aberta diretamente e recarregada. O painel é voltado ao acompanhamento; o agente registra o trabalho pelo MCP.

O campo `references` já existe na criação. Use links reais, quando conhecidos:

```json
{
  "title": "Revisar recebimentos",
  "context": "Cliente A",
  "note": "Validar o comportamento solicitado e registrar os resultados.",
  "references": [
    { "label": "Issue de recebimentos", "url": "https://github.com/organizacao/projeto/issues/123" }
  ],
  "idempotencyKey": "session-123:recebimentos"
}
```

Para adicionar links posteriormente, `wid_record_event` aceita `kind: "references_added"`, `taskId`, `references: [{label, url}]`, `note` e `idempotencyKey`. A alteração é auditada e não duplica a tarefa. URLs repetidas são consolidadas e a tarefa aceita até 20 referências. O painel identifica links do Azure DevOps, GitHub e Slack; outros destinos usam o rótulo da referência. WID não consulta esses serviços nem envia mensagens ao abri-los.

| Ferramenta | Uso |
| --- | --- |
| `wid_list_tasks` | Buscar/reutilizar tarefas e consultar o histórico. |
| `wid_list_contexts` | Consultar nomes dinâmicos de contextos e quantidade de tarefas para reutilizar ou criar outro nome. |
| `wid_create_task` | Registrar a intenção de trabalho. |
| `wid_record_event` | Registrar andamento, decisão, bloqueio, entrega, tempo, correção, `context_changed`, `references_added` ou `historical_note`. |
| `wid_estimate_day` | Revisar o total humano estimado de uma tarefa/dia com justificativa e confiança. |
| `wid_report_day` | Consultar horas por tarefa e a cobertura do dia. |
| `wid_report_month` | Consultar o total mensal, parcelas medidas/estimadas e lacunas. |

Exemplo de `wid_estimate_day`:

```json
{
  "taskId": "UUID retornado por wid_create_task",
  "day": "2026-11-25",
  "minutes": 45,
  "basis": "Discussão e revisão ativa do fluxo. Tempo do build excluído; início sem medição precisa.",
  "confidence": "low",
  "idempotencyKey": "session-123:task-456:2026-11-25:estimate-v1",
  "sessionId": "session-123"
}
```

O stdio inicia o servidor local em background quando necessário; só esse servidor abre o banco embutido. Outros clientes podem usar `http://127.0.0.1:4318/mcp/{agente}` com o respectivo agente ativado: `codex`, `claude`, `cursor`, `copilot`, `gemini` ou `opencode`. O serviço não escuta na rede externa.

O MCP fornece instruções de uso, mas **o agente precisa segui-las**. A versão inicial não intercepta todas as conversas nem garante registro por todos os clientes. O hook do Claude é um lembrete, não um coletor de transcrições nem um medidor de tempo. Clientes em nuvem não acessam este localhost.

## Anotações históricas

Para acrescentar um fato antigo a uma tarefa existente sem alterar seu estado atual, use `wid_record_event` com `kind: "historical_note"`. Funciona em tarefas planejadas, em andamento, bloqueadas, concluídas ou canceladas. `occurredAt` é obrigatório, com horário original e offset explícito; `recordedAt` continua sendo o momento real da gravação. A anotação aparece no histórico e na cobertura diária/mensal pela data original, mesmo quando os registros são enviados fora de ordem.

```json
{
  "taskId": "UUID da tarefa existente",
  "kind": "historical_note",
  "note": "Validação realizada no período, conforme a referência registrada. Duração humana desconhecida.",
  "occurredAt": "2026-11-03T10:00:00-03:00",
  "references": [{"label": "Fonte do registro", "url": "https://example.com/evidence"}],
  "idempotencyKey": "history:task-id:2026-11-03:validation"
}
```

Não envie `effort`, `context` ou `correctsEventId` nessa anotação. O contexto é o da tarefa; referências históricas pertencem ao evento e não substituem os links atuais da tarefa. Tempo, quando houver evidência, usa os registros de esforço separados. Sem evidência de duração, o tempo permanece desconhecido. Uma chave idempotente repetida com o mesmo conteúdo retorna o mesmo evento; conteúdo diferente na mesma chave é recusado. Eventos comuns de ciclo de vida continuam sendo processados na ordem de gravação e não fazem replay por `occurredAt`.

## Configuração de agentes

O WID altera somente sua própria entrada e blocos marcados. Uma entrada `wid` de outra instalação gera conflito em vez de sobrescrita.

| Agente | MCP | Instruções |
| --- | --- | --- |
| Codex | `$CODEX_HOME/config.toml` ou `~/.codex/config.toml` | Bloco marcado no `AGENTS.md` global. |
| Claude Code | `~/.claude.json` | Bloco marcado no `~/.claude/CLAUDE.md`. |
| Cursor | `~/.cursor/mcp.json` | Orientações enviadas pelo próprio MCP. |
| GitHub Copilot | `$COPILOT_HOME/mcp-config.json` ou `~/.copilot/mcp-config.json` | Orientações MCP. CLI e harness Copilot do VS Code; não configura o antigo MCP do perfil do editor. |
| Gemini CLI | `~/.gemini/settings.json` | Orientações MCP. |
| OpenCode 2 | `~/.config/opencode/opencode.json` ou `.jsonc` existente | Orientações MCP; entrada em `mcp.servers`. Formato legado não é migrado. |

Os adaptadores JSON preservam comentários JSONC e configurações de outros servidores. A configuração de clientes é validada com diretórios temporários e o protocolo MCP é testado localmente; a execução dentro de cada aplicativo depende de sua instalação, permissões e políticas. A detecção usa diretórios/configurações, executáveis e a extensão Copilot do VS Code, sem varrer conversas. Nenhum agente novo é ativado automaticamente.

Formatos verificados nas documentações de [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration), [Gemini CLI](https://geminicli.com/docs/tools/mcp-server/) e [OpenCode](https://opencode.ai/docs/mcp-servers/). Logotipos SVG identificam os clientes; fonte e licença em `ui/public/agents/`.

```sh
wid agent codex --disable
wid agent copilot
wid agent gemini
wid agent opencode
wid hook-install claude
wid hook-install claude --disable
```

Desativar Claude remove também o hook desta instalação. O hook nunca registra o prompt bruto. Comandos usam o caminho absoluto do Node e da instalação; se mover ou reinstalar em outro caminho, desative na instalação antiga e ative na nova.

## Dados e privacidade

O diretório padrão é `%LOCALAPPDATA%/wid` no Windows e `~/.local/share/wid` nas demais plataformas. Contém `settings.json`, banco `postgres/` e um lock do processo ativo. Altere com `WID_DATA_DIR` ou `--data-dir` (use o mesmo diretório nos comandos e agentes).

- Sem telemetria, importação de conversas, captura de tela ou upload automático.
- Registre resumos do trabalho; nunca prompts integrais, credenciais ou dados sensíveis.
- O banco e os arquivos de configuração são locais; proteja o acesso à sua conta e ao disco. Não há criptografia de aplicação nem autenticação entre processos do mesmo usuário/máquina.
- HTTP restringe host e origem a localhost e exige cabeçalho próprio nas mutações da API. Não há CORS para sites externos.
- Correções acrescentam eventos; originais são preservados. Para corrigir tempo, informe `correctsEventId`, categoria, dia e total corrigido. Cada original admite uma correção; revisões posteriores de totais usam novos eventos de tempo.
- Exportação JSON no painel. Importação e restauração de JSON ficam fora do MVP.
- Para backup recuperável do banco embutido, pare o WID e copie o diretório de dados. Não copie um banco embutido em uso.

### PostgreSQL externo (opcional)

Defina `WID_DATABASE_URL` no ambiente do processo servidor, apontando para um **banco exclusivo do WID**, e execute `wid start`. O esquema usa tabelas `wid_*`. O WID não cria banco/usuário no servidor e não grava a connection string em configurações de agentes ou exportações.

Esse modo usa o adaptador `pg`. O fluxo local padrão é testado com PostgreSQL embutido; para usar um servidor externo, valide a conexão e permissões no seu ambiente. Trocar de motor não migra os dados automaticamente.

## Desenvolvimento

O checkout local principal fica em `C:\nac\wid`. O kit original de identidade visual fica em `brand/`: logo em SVG para cada tema, símbolo e ícones de web/aplicativo. Os SVGs usados no painel são importados diretamente dos arquivos mestres; `ui/public` contém os arquivos preparados de favicon e ícones de aplicativo para servir em URLs estáveis. Não redesenhe nem altere as proporções dos ativos. O manifesto declara a identidade de aplicativo; esta versão não oferece cache offline.

```sh
git clone https://github.com/natharuc/wid.git
cd wid
npm install
npm run typecheck
npm test
npm run build
npm start
```

`npm install` executa o build via `prepare`. Se o PATH exceder o limite do `cmd.exe` no Windows, use um terminal com PATH reduzido ou `npm --script-shell pwsh install` / `npm --script-shell pwsh run build`.

Estrutura:

```text
src/domain/           contratos, validações, estados e cálculo de tempo
src/application/      casos de uso e porta de persistência
src/infrastructure/   PostgreSQL, configurações e integração com agentes
src/interface/        HTTP, MCP e stdio
ui/                   painel React + DaisyUI + Tailwind
tests/                domínio, banco real embutido, HTTP/MCP e configuração isolada
```

O domínio não conhece HTTP, MCP, interface web nem banco. O serviço de aplicação depende da porta `WorkStore`; a infraestrutura implementa essa porta. As interfaces usam os mesmos casos de uso. Transações garantem atomicidade entre tarefa, evento e idempotência; a projeção atual é acompanhada por eventos imutáveis.

## Próximos passos

Publicação no registro npm; conectores autenticados de leitura para GitHub/Azure DevOps; temporizador humano explícito; mais agentes e hooks documentados; paginação, filtros e cobertura declarada pelo usuário; importação e recuperação de exportações.

## Referências de implementação

- [DaisyUI com Vite](https://daisyui.com/docs/install/vite/) e [temas prontos](https://daisyui.com/docs/themes/).

- [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server) e [transporte local e HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
- [Codex MCP](https://developers.openai.com/codex/mcp) e [instruções AGENTS.md](https://developers.openai.com/codex/guides/agents-md).
- [Claude Code MCP](https://code.claude.com/docs/en/mcp) e [hooks](https://code.claude.com/docs/en/hooks).
- [Cursor MCP](https://cursor.com/docs/mcp).

## Licença

MIT.
