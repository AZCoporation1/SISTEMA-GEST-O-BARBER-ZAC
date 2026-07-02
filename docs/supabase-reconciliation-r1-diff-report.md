# Relatório de DB Diff — Fase R1.D

Este documento deveria registrar a diferença estrutural (SQL) entre o Conjunto Canônico Candidato e o schema remoto público em `artifacts/supabase/canonical-candidate-vs-remote.diff.sql`.

## Resultado da Execução
A CLI do Supabase foi acionada para calcular o diff local-remoto:
```powershell
npx supabase db diff --linked
```
**Falha Crítica:** A CLI depende da criação de um *Shadow Database* para compilar as migrations locais antes de compará-las ao remoto. O processo falhou porque o serviço local do Docker Desktop não está em execução no host:
`failed to connect to the docker API... Docker Desktop is a prerequisite for local development.`

## Classificação do Resultado
Devido à impossibilidade tecnológica de rodar o Shadow DB sem Docker, todas as DMLs (`UPDATE`, `INSERT`), Triggers e Policies incluídas nas migrations não puderam ser comparadas com o banco de produção.
Isto nos enquadra perfeitamente na regra de segurança estabelecida para a fase R1:

**Classificação: G. Diferença de DML não verificável.**

## Decisão
**BLOQUEADO — CONJUNTO CANÔNICO NÃO REPRODUZ O BANCO REMOTO**
