# Barber Zac ERP — Verificação de PWA em Produção

> **Data**: 2026-06-26  
> **Objetivo**: Auditar o Service Worker ativo no domínio de produção.

## 1. Proveniência da Vercel (Fase B)

A partir da análise via Vercel CLI (`npx vercel ls` e headers HTTP):

- **DOMÍNIO PRINCIPAL:** `barber-zac.vercel.app`
- **DEPLOYMENT ATIVO:** `barber-9khjt9xgr-ichtonnys-projects.vercel.app` (ID: `dpl_6ca4bFCis5KuXMnpgNaEKUfftqZE`)
- **SHA IMPLANTADO:** Provavelmente `17d4dd02996d934bb0837d995955dc9359eaf27a` (HEAD da branch `main` no GitHub remote). Em implantações mais antigas, o commit `4517b48` estava presente.
- **BRANCH DE ORIGEM:** `main` (Remote)
- **ORIGEM DO DEPLOY:** GitHub Integration / CLI (20h atrás)
- **PROJETO VERCEL:** `barber-zac` (ID: `prj_ihhDFbfb82wjtDm8YAtwGnHGDCkD`)
- **ALIAS CONFIRMADO:** `barber-zac.vercel.app`

### Conclusão do Build Ativo
A build ativa **NÃO CONTÉM** os arquivos de otimização:
- Não há `UpdateBanner`.
- O `sw.js` em produção é a versão não otimizada.
- Não há instrumentação `[PERF]`.
- O POS continua com o comportamento original.
- Não há error boundary global.

## 2. Auditoria do Service Worker em Produção (Fase C)

Devido ao bloqueio de código demonstrado na Fase A/B:

1. **O Service Worker instalado**: É a versão antiga (v1 ou v2).
2. **Cache de REST do Supabase**: CONTINUA ATIVO (TTL de 5 min) no SW em produção.
3. **Páginas internas autenticadas**: Sujeitas às estratégias originais de cache (NetworkFirst/StaleWhileRevalidate sem clean-up versionado).
4. **RSC privado**: Cacheável sob a estratégia `html-pages` padrão antiga.
5. **Comportamento de Atualização**: O `controllerchange` continua disparando `window.location.reload()`, o que interrompe fluxos.
6. **Banner de atualização**: INEXISTENTE em produção.
7. **Carrinho preservado**: INEXISTENTE (o reset incondicional ocorre na versão de produção).

## Conclusão da Fase C
O deployment ativo está entregando o código ANTERIOR à otimização. A interface descrita como "v1.0.0" decorre do fato de que a Vercel implantou o código presente no remote `origin/main` (ou uma build baseada num cache preso antigo), o qual não possui 100% das evoluções feitas unicamente no repositório local.

---

**BLOQUEADO — DOMÍNIO NÃO APONTA PARA A BUILD AUDITADA**
