# Resumo do trabalho e estimativa de dedicação no WID

Estudo de produto e método, 25 de novembro de 2026. Proposta para evolução; nenhuma das capacidades futuras descritas aqui está implementada por este documento.

## Recomendação

O WID deve abrir com um resumo curto do trabalho realizado com IA e da dedicação humana registrada. O histórico continua sendo a base auditável, mas o usuário não deve precisar reconstruir seu dia lendo eventos técnicos.

A estimativa deve ser feita por episódios de participação humana, com evidências, faixa de duração e calibração pessoal. A IA interpreta o trabalho; regras determinísticas conciliam as fontes e somam o tempo. Contagem de mensagens, tokens, testes, commits ou duração do agente não fornece uma conversão válida para minutos humanos.

Nathan escolheu como fontes **somente conversas e eventos dos agentes**. Ficam fora desta proposta sensores de editor, janela ativa, teclado, mouse e capturas de tela. O preenchimento permanece nos agentes; confirmações excepcionais acontecem pela conversa, sem formulário obrigatório no painel.

## O que o produto atual ainda não resolve

A versão 0.5.0 fornece persistência, contexto global, referências, histórico e categorias separadas de tempo. Entretanto:

| Constatação no código                                                                                                       | Consequência                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ui/DayOverview.tsx` destaca quatro métricas antes das atividades. `ui/WorkComponents.tsx` apresenta título e estado atual. | Falta uma resposta direta sobre o resultado ou avanço daquele dia.                                                    |
| `ui/ActivityView.tsx` seleciona atividades por qualquer evento do dia.                                                      | Uma mudança de contexto, referência ou estimativa pode parecer trabalho realizado na tarefa.                          |
| `src/interface/mcp.ts`, `estimateSchema` e `wid_estimate_day`, recebem minutos, justificativa livre e confiança declarada.  | O serviço armazena o número escolhido pelo agente. Não existe hoje um estimador calibrado baseado em evidências.      |
| `src/domain/work.ts`, `summarize`, mantém o último total por tarefa/dia/categoria.                                          | Escritas idempotentes não resolvem disputas entre estimativas concorrentes nem trabalho repetido em chats diferentes. |
| O alerta mensal detecta dias acima de 24 horas.                                                                             | Sobreposições menores também podem inflar os totais.                                                                  |

Exemplo sintético do problema concorrente: dois chats leem a mesma revisão; um escreve 60 minutos e outro 20. O último total prevalece, sem distinguir evidências complementares, repetidas ou conflitantes. A regra atual `max(medido, estimado)` também é uma convenção contábil, não uma validação da estimativa.

Estimativas pequenas atribuídas apenas à existência de poucas mensagens, como dois ou três minutos, devem ser tratadas como estimativas legadas sem validação do método. Este estudo não altera nem apaga esses registros.

## Lições dos métodos de mercado

As fontes abaixo descrevem funcionalidades dos próprios fornecedores, não precisão comprovada para o cenário do WID.

| Referência                                                                      | O que aproveitar                                                                        | O que não transferir automaticamente                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [ActivityWatch](https://docs.activitywatch.net/en/latest/faq.html)              | Armazenamento local e distinção entre sinais observados e ausência presumida.           | Usa sinais de aplicativos/inatividade que o WID não terá nesta proposta.           |
| [RescueTime](https://help.rescuetime.com/article/245-how-rescuetime-works)      | Separar tempo de relógio de atividade e permitir complementar trabalho fora da captura. | Presença no computador não determina dedicação a uma tarefa.                       |
| [Timely Memory](https://www.timely.com/help/handbook/autosheet/memory-101/)     | Agrupar sinais em blocos e tornar sugestões inspecionáveis.                             | A linha do tempo depende de fontes de atividade diferentes das conversas.          |
| [Rize](https://docs.rize.io/automatic-tracking/time-entry-suggestions-settings) | Separar captura, agrupamento e atribuição a tarefa; aprender com correções.             | Confiança na classificação da tarefa não é confiança na duração humana.            |
| [Timely Agent Tracking](https://www.timely.com/ai-agents/)                      | Colocar resultados e execução de agentes em uma trilha própria.                         | A oferta consultada é beta; duração de sessão do agente não mede dedicação humana. |

A conclusão para o WID é adotar blocos e atribuição de trabalho, preservando a restrição de fontes escolhida. Não há, nas referências consultadas, validação de uma fórmula universal mensagem → minutos humanos.

O [SPACE, de Microsoft Research/ACM](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/), sustenta a separação entre atividade e produtividade; não propõe uma conversão de contagens em duração. O [diário de uso do tempo ATUS, do BLS](https://www.bls.gov/tus/), é uma referência para reconstruir episódios com relato de duração ou início/fim. Autorrelato continua sendo uma referência imperfeita, não um cronômetro.

## A experiência principal

Uma abertura deve permitir entender o período em poucos segundos. O seguinte conteúdo é um exemplo sintético, sem relação com horas reais de Nathan:

```text
Contexto: Projeto A                         Hoje

O que você fez
• Definiu as regras de classificação das tarefas.
• Revisou a correção de recebimentos; validação concluída.
• A publicação ficou bloqueada pela configuração do ambiente.

Dedicação humana registrada: 30–35 min
20 min com cronômetro declarado + 10–15 min estimados
Há períodos sem duração humana conhecida.

Cada atividade abre a tarefa. Ver evidências fica nos detalhes.
```

A lista deve consolidar repetições por tarefa/resultado e mostrar poucas atividades principais, com expansão para as demais. Intenção sem execução fica como planejada. Evidência de teste passa a informar o que foi validado. Alterações administrativas permanecem na auditoria e não viram automaticamente realização de trabalho.

Resultados produzidos pelo agente pertencem ao trabalho realizado **com IA**, mas a redação deve respeitar os papéis: “Correção implementada pelo agente e revisada por você” exige evidência de ambas as ações. Um aviso de conclusão do agente, sozinho, não prova revisão humana.

No detalhe da tarefa, a primeira informação deve ser a síntese de resultado, andamento e impedimento. Abaixo ficam horas, fontes e histórico completo. Execução do agente, espera, tokens e registros técnicos ficam em uma seção secundária. O contexto global existente continua valendo em todas as consultas.

## Método de estimativa proposto

### Extrair fatos antes de estimar duração

O agente registra fatos curtos e estruturados: tarefa/contexto, ação, ator, resultado, origem e IDs das evidências. É necessário distinguir pedido, decisão, revisão humana declarada, teste manual relatado, execução do agente, pausa declarada e simples atualização administrativa.

“Teste isso” é uma intenção. “Testei e reproduzi o erro” é um relato de execução humana. “O comando de teste terminou” demonstra execução do processo. Nenhum desses textos, isoladamente, determina a duração humana.

O WID deve preservar separadamente o instante original da fonte, o momento de gravação e a precisão temporal disponível. `recordedAt` de uma chamada MCP não é o horário de uma mensagem humana. Quando o cliente não oferece timestamps, o serviço não deve fabricá-los a partir da ordem das mensagens. Fontes conhecidas apenas por dia precisam manter essa granularidade em um futuro contrato; a anotação histórica atual exige um instante com offset.

### Reconstruir episódios

Um episódio reúne uma participação coerente: definir um requisito, revisar uma saída, discutir uma decisão ou validar um resultado. Pode reunir várias mensagens e terminar com mudança de assunto, pausa explícita ou evidência de outro período.

Os horários delimitam uma **janela candidata**, não um bloco humano contínuo comprovado. Uma hora entre mensagens pode conter uma hora de leitura ou poucos minutos de interação e uma longa ausência. Eventos do agente ajudam a explicar a janela, mas não eliminam essa ambiguidade.

Um limiar de inatividade eventualmente usado para segmentar episódios será um parâmetro experimental, sujeito a validação. Não haverá uma regra de “X minutos por mensagem”, “Y minutos por teste” ou percentual fixo da duração do chat. Tamanho de mensagem e cadência podem ser sinais auxiliares de um modelo futuro, nunca uma régua isolada: texto pode ter sido colado e leitura pode ocorrer em silêncio.

### Distinguir a origem da duração

| Origem                                                   | Tratamento proposto                                             |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| “Cronometrei 20 minutos.”                                | Medição declarada pelo usuário, com essa procedência explícita. |
| “Devo ter gasto entre 10 e 15 minutos.”                  | Estimativa informada pelo usuário. Não promover a medição.      |
| Padrão de participação com referência pessoal suficiente | Estimativa inferida, com faixa, método e evidências.            |
| Participação comprovada, sem suporte temporal suficiente | Atividade registrada com duração desconhecida.                  |
| Execução automática ou espera                            | Trilha de agente/espera; não somar como dedicação humana.       |

Uma medição declarada que cobre um episódio inteiro substitui a estimativa anterior daquele episódio. Quando cobre apenas parte, substitui somente a parte correspondente. A comparação exige identificar a cobertura; não usar automaticamente o maior número nem somar uma medição já incluída numa estimativa. Uma revisão pode reduzir o total, preservando o histórico da correção.

Durante um job o usuário pode ler, revisar ou trabalhar em outra tarefa. Portanto, nem incluir toda a execução nem subtrair todo o runtime do agente é correto. A exclusão é da inferência automática; uma revisão humana evidenciada durante o job continua elegível.

### Começar sem precisão fictícia

No início, priorizar durações explicitamente relatadas e episódios com evidência temporal suficiente. Para os demais, apresentar sugestões provisórias em faixa somente quando houver uma base explicável; sem base temporal, registrar o fato e manter a duração desconhecida.

Uma faixa numérica precisa derivar de duração relatada, restrições temporais factuais ou de um modelo pessoal avaliado para esse tipo de episódio. Uma justificativa eloquente do LLM não satisfaz esse requisito. Timestamps que delimitam uma janela, sozinhos, não sustentam um limite humano inferior positivo. Na ausência dessa base, a saída operacional é episódio registrado com duração desconhecida; previsões experimentais não entram automaticamente no total divulgado.

Uma faixa ampla que altere materialmente o total pode justificar uma pergunta ocasional no próprio chat: “Nesse trecho você estava revisando ou deixou o agente trabalhando?”. A pergunta não pode ser condição para continuar a tarefa. Sem resposta, a lacuna permanece.

Os rótulos baixa/média/alta não são probabilidades. Não publicar “90% de confiança” ou um erro percentual até existir avaliação que sustente a afirmação. A literatura de [calibração de intervalos](https://arxiv.org/abs/2107.07511) é referência para uma evolução posterior, não validação automática de uma faixa produzida por LLM.

### Conciliar todos os chats da mesma pessoa

Evidências precisam de identidade estável de origem: conversa, mensagem/evento e relações de delegação, quando disponíveis. Um pedido repassado a três agentes não representa três intervenções humanas novas. Similaridade textual sozinha também não prova duplicação.

O serviço deve reconciliar as evidências antes da soma. Quando há intervalos humanos conhecidos, considerar sua união e atribuir dedicação entre tarefas sem duplicar o mesmo minuto. Uma janela candidata, porém, não pode ser tratada como intervalo humano medido para fazer essa união.

Se apenas a duração é conhecida, mas a posição no tempo ou a atribuição são incertas, registrar a pendência de conciliação. Não dividir igualmente entre tarefas nem somar integralmente em cada contexto. Tempo humano conhecido sem tarefa definida deve continuar visível no total geral, com atribuição pendente.

A conciliação deve considerar os contextos da pessoa antes de aplicar o filtro visual. Revisões concorrentes precisam identificar a revisão anterior e o conjunto de evidências considerado, para que uma estimativa parcial não apague silenciosamente outra. Correções continuam auditáveis.

## Exemplo de cálculo

Exemplo inteiramente sintético; as durações vêm dos relatos do cenário, não de coeficientes de mensagens:

| Evidência                                                                              | Dedicação humana          | Execução do agente      |
| -------------------------------------------------------------------------------------- | ------------------------- | ----------------------- |
| Usuário declara revisão cronometrada de 20 min.                                        | 20 min medidos declarados | —                       |
| Job executado por 20 min, sem informação de participação humana.                       | Desconhecida nessa janela | 20 min                  |
| Usuário estima 10–15 min de validação. Um segundo agente referencia a mesma validação. | 10–15 min uma única vez   | Separada, se registrada |

Resultado: **30–35 minutos humanos registrados**, compostos por 20 medidos declarados e 10–15 estimados. A janela do job continua sem cobertura humana suficiente; não significa que o usuário ficou sem trabalhar. O resultado não representa uma jornada completa.

A soma pressupõe que revisão e validação sejam atividades distintas, sem sobreposição e sem inclusão de uma duração na outra. A menção feita pelo segundo agente é uma referência à mesma validação, não uma nova atividade.

## Responder quantas horas houve no mês

O relatório deve dizer a dedicação registrada no período, a composição por origem e as lacunas. Por exemplo, usando valores sintéticos: “33h30–41h30 registradas, sendo 5h30 com cronômetro declarado e 28–36h estimadas; seis atividades ainda sem duração”. Uma faixa cobre somente a parcela estimada, não o trabalho que não foi observado.

Somar limites inferiores e superiores pode formar uma faixa de cenários registrados. Isso não cria um intervalo mensal com cobertura probabilística garantida: os erros de episódios e dias podem ser dependentes. O método de agregação e sua validação devem ser explícitos. Tempo desconhecido nunca entra como zero, como uma jornada padrão ou como preenchimento das horas restantes do dia.

## Evolução mínima do contrato e da arquitetura

Esta tabela descreve necessidades futuras, **não parâmetros disponíveis nos tools atuais**:

| Informação                                         | Finalidade                                                    |
| -------------------------------------------------- | ------------------------------------------------------------- |
| IDs de evidência, origem, ator e precisão temporal | Sustentar fatos e permitir deduplicação.                      |
| Episódio e janela observada, com pausas/lacunas    | Organizar participação sem presumir presença contínua.        |
| Fonte da duração, limites e ponto central opcional | Separar relato, medição declarada, inferência e desconhecido. |
| Método/versão, pressupostos e evidências excluídas | Explicar e reproduzir a estimativa.                           |
| Revisão anterior e evidências já cobertas          | Resolver concorrência e correções sem perda silenciosa.       |
| Síntese por tarefa/dia com IDs de suporte          | Alimentar o resumo rápido sem inventar resultados.            |

A primeira implementação pode ampliar os registros e relatórios existentes, sem multiplicar ferramentas MCP. Os agentes já conectados extraem fatos no contexto da conversa. O serviço local valida referências, estados, revisões e somas; não precisa inicialmente de um LLM adicional obrigatório nem de chave de provedor no WID.

Na transição, um total legado de tarefa/dia e os novos episódios que reconstroem esse mesmo trabalho são revisões alternativas, não parcelas somáveis. A nova revisão identifica quais evidências já cobertas está substituindo. Sem correspondência suficiente, marcar pendência de conciliação e não adicionar automaticamente os episódios ao total antigo. Preservar dados inclui preservar essa distinção, além da trilha histórica.

Coletores devem declarar quais dados realmente conseguem fornecer em cada cliente. Conectar MCP não garante acesso a toda a conversa ou a timestamps originais. Os registros guardam resumos e identificadores mínimos, sem transcrições brutas, credenciais ou prompts integrais. Não há importação geral de históricos nesta proposta.

## Ordem de entrega e critérios de aceitação

1. **Resumo primeiro.** Home com fatos/entregas, andamento e bloqueios; fonte acessível por item. Excluir auditoria administrativa da síntese de realizações. Medir se Nathan entende o dia rapidamente sem abrir cada tarefa.
2. **Evidências e episódios.** Captura prospectiva pelos agentes, capacidades explícitas dos clientes, precisão temporal e conciliação de duplicatas. Preservar estimativas legadas com sua procedência.
3. **Estimativa em observação.** Propostas por episódio com faixa e explicação. Nenhuma promessa de precisão nem lançamento de duração sem suporte. Regressões devem cobrir pausas, execuções longas, testes humanos/automáticos, delegação, dois chats e virada de dia.
4. **Piloto pessoal.** Aproximadamente duas semanas como ensaio inicial, sem tratar essa duração como amostra estatisticamente suficiente. Usar relatos espontâneos e, quando necessário, no máximo uma confirmação curta por dia como hipótese de carga de uso. Participação opcional; ausência de resposta não bloqueia o produto.
5. **Avaliação e liberação gradual.** Separar dias usados para ajustar o método dos usados para avaliá-lo. Comparar com um método simples de referência, medir erro absoluto, viés de super/subestimação, largura e cobertura das faixas, conciliação entre chats, quantidade de tempo desconhecido e carga de perguntas. Relatos do usuário são referência imperfeita; distinguir os casos com cronômetro declarado. Continuar a coleta/avaliação se não houver evidência suficiente para promover a inferência automática.

Os critérios imediatos são rastreabilidade de cada afirmação, nenhuma duração gerada só por contagem de eventos, nenhuma duplicação conhecida e visibilidade das lacunas. A precisão temporal do método próprio ainda precisa ser demonstrada; o valor imediato do produto é resumir corretamente o trabalho e organizar as evidências necessárias para melhorar a estimativa.
