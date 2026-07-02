# Barber Zac ERP — Contenção de Segurança

> **Data**: 2026-06-26  
> **Objetivo**: Registro formal da contenção de segurança em relação ao vazamento de credenciais locais.

## 1. Regras de Contenção Estabelecidas

Em cumprimento estrito às diretrizes de segurança, estão bloqueadas as seguintes ações no ambiente local:
- Leitura, impressão ou busca de conteúdo em arquivos `.env`, `.env.local` e `*auth.json`.
- Leitura de diretórios `%APPDATA%\vercel` e `%LOCALAPPDATA%\com.vercel.cli`.
- Exposição ou busca por valor de credenciais Supabase, Vercel, tokens, cookies, headers, chaves, service role ou PATs.
- Inclusão de tokens em scripts ou commits.
- Qualquer tentativa de burlar GitHub Secret Scanning ou realizar force push.

## 2. Status de Rotação de Credenciais

Conforme o protocolo de segurança, a rotação deve ser efetuada manualmente pelo usuário administrador. O status atual é:

- Supabase token rotacionado: **pendente**
- Vercel token/sessão rotacionado: **pendente**

*Aviso: Nunca registre valores ou trechos de credenciais neste documento ou em qualquer outro log do sistema.*
