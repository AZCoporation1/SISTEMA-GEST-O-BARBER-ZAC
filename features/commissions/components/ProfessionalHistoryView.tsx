// @ts-nocheck
"use client"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth-provider"
import { useProfessionalLedger } from "../hooks/useProfessionalLedger"
import { cancelAdvance, reverseProfessionalSale, cancelClosure } from "../actions/professionals.actions"
import { cancelPerfumeSale } from "@/features/perfumes/actions/perfumes.actions"
import { formatCurrencyBR, formatFullDateBR } from "../services/periodUtils"
import {
  ADVANCE_TYPE_LABELS, ADVANCE_STATUS_LABELS, ADVANCE_STATUS_COLORS,
  CLOSURE_STATUS_LABELS, CLOSURE_STATUS_COLORS,
  SALE_STATUS_LABELS, SALE_STATUS_COLORS,
  PERFUME_STATUS_LABELS, PERFUME_STATUS_COLORS,
} from "../types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Wallet, TrendingUp, TrendingDown, Scissors, Package, ShoppingBag, FileText, Shield, Copy, Check, XCircle, RotateCcw, AlertTriangle } from "lucide-react"

type TabKey = "resumo"|"vendas"|"pegos"|"produtos"|"perfumes"|"fechamentos"|"auditoria"

interface Props {
  professionalId: string
  professionalName: string
  periodStart: string
  periodEnd: string
  periodLabel: string
  isAdmin?: boolean
}

export function ProfessionalHistoryView({ professionalId, professionalName, periodStart, periodEnd, periodLabel, isAdmin: isAdminProp }: Props) {
  const [tab, setTab] = useState<TabKey>("resumo")
  const [confirmDialog, setConfirmDialog] = useState<{open:boolean,type:string,id:string,label:string}>({open:false,type:"",id:"",label:""})
  const [reason, setReason] = useState("")
  const [copiedLegit, setCopiedLegit] = useState<string|null>(null)
  const { hasAdminAccess } = useAuth()
  const isAdmin = isAdminProp ?? hasAdminAccess
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: ledger, isLoading } = useProfessionalLedger(professionalId, periodStart, periodEnd)
  const s = ledger?.summary

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["professionalLedger"] })
    qc.invalidateQueries({ queryKey: ["professionalSales"] })
    qc.invalidateQueries({ queryKey: ["professionalAdvances"] })
    qc.invalidateQueries({ queryKey: ["professionalClosures"] })
    qc.invalidateQueries({ queryKey: ["allProfMetrics"] })
    qc.invalidateQueries({ queryKey: ["professionalPerfumeSales"] })
  }

  const mutation = useMutation({
    mutationFn: async ({ type, id, reason: r }: { type:string, id:string, reason:string }) => {
      if (type === "sale") return reverseProfessionalSale(id, r)
      if (type === "advance") return cancelAdvance(id, r)
      if (type === "perfume") return cancelPerfumeSale({ sale_id: id, reason: r })
      if (type === "closure") return cancelClosure(id, r)
      throw new Error("Tipo desconhecido")
    },
    onSuccess: (res: any) => {
      if (res.success) {
        invalidateAll()
        toast({ title: "Operação realizada com sucesso!" })
        setConfirmDialog({ open: false, type: "", id: "", label: "" })
        setReason("")
      } else {
        toast({ title: "Erro", description: res.error, variant: "destructive" })
      }
    },
  })

  const openConfirm = (type: string, id: string, label: string) => {
    setReason("")
    setConfirmDialog({ open: true, type, id, label })
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLegit(id)
    setTimeout(() => setCopiedLegit(null), 2000)
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "resumo", label: "Resumo" },
    { key: "vendas", label: "Vendas" },
    { key: "pegos", label: "Pegos" },
    { key: "produtos", label: "Produtos" },
    { key: "perfumes", label: "Perfumes" },
    { key: "fechamentos", label: "Legit" },
    { key: "auditoria", label: "Audit" },
  ]

  if (isLoading) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Carregando histórico...</div>
  if (!ledger || !s) return <div style={{textAlign:"center",padding:40,color:"var(--text-muted)"}}>Sem dados para o período</div>

  return (
    <div>
      {/* Tab nav */}
      <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:16,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            flex:1,padding:"8px 4px",background:"none",border:"none",
            borderBottom:tab===t.key?"2px solid var(--accent)":"2px solid transparent",
            color:tab===t.key?"var(--accent)":"var(--text-muted)",
            fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ═══ RESUMO ═══ */}
      {tab==="resumo"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Kpi label="A Pagar" value={`R$ ${formatCurrencyBR(s.netPayable)}`} color={s.netPayable>=0?"var(--success)":"var(--danger)"} icon={<Wallet size={14}/>} />
            <Kpi label="Bruto" value={`R$ ${formatCurrencyBR(s.grossTotal)}`} color="var(--accent-light)" icon={<TrendingUp size={14}/>} />
            <Kpi label="Pegos" value={`-R$ ${formatCurrencyBR(s.advancesTotal)}`} color="var(--danger)" icon={<TrendingDown size={14}/>} />
            <Kpi label="Atendimentos" value={String(s.salesCount)} color="var(--text-primary)" icon={<Scissors size={14}/>} />
          </div>
          <div className="section-card"><div className="section-card-body" style={{padding:0}}>
            <Row label="Faturamento Bruto" value={`R$ ${formatCurrencyBR(s.grossTotal)}`} />
            <Row label={`Comissão (${s.commissionPercent}%)`} value={`R$ ${formatCurrencyBR(s.barberShareFromSales)}`} accent />
            <Row label="Parte Barbearia" value={`R$ ${formatCurrencyBR(s.barbershopShare)}`} muted />
            {s.perfumeCommissionTotal>0&&<Row label={`Perfumes (${s.perfumeSalesCount})`} value={`+R$ ${formatCurrencyBR(s.perfumeCommissionTotal)}`} accent />}
            <Row label="Total Barbeiro" value={`R$ ${formatCurrencyBR(s.barberShare)}`} bold />
            {s.advancesTotal>0&&<Row label="Pegos/Adiantamentos" value={`-R$ ${formatCurrencyBR(s.advancesTotal)}`} danger />}
            <Row label="Líquido a Pagar" value={`R$ ${formatCurrencyBR(s.netPayable)}`} highlight />
          </div></div>
          <div style={{display:"flex",gap:8,fontSize:11,color:"var(--text-muted)",flexWrap:"wrap"}}>
            <span><strong>{s.servicesCount}</strong> serviços</span>
            <span><strong>{s.productsCount}</strong> produtos</span>
            <span>TM: <strong>R$ {formatCurrencyBR(s.ticketMedio)}</strong></span>
          </div>
        </div>
      )}

      {/* ═══ VENDAS ═══ */}
      {tab==="vendas"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.sales.length===0?<Empty text="Nenhuma venda no período"/>:
            ledger.sales.map((sale:any)=>(
              <div key={sale.id} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{sale.customer_name_snapshot||"Cliente avulso"}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                    {new Date(sale.sale_date).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                    {" · "}{(sale.items||[]).length} item(s)
                    <StatusBadge status={sale.status} labels={SALE_STATUS_LABELS} colors={SALE_STATUS_COLORS} />
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:sale.status==="completed"?"var(--success)":"var(--text-muted)",fontVariantNumeric:"tabular-nums",textDecoration:sale.status!=="completed"?"line-through":"none"}}>
                    R$ {formatCurrencyBR(sale.total)}
                  </div>
                  {isAdmin&&sale.status==="completed"&&(
                    <button onClick={()=>openConfirm("sale",sale.id,`Venda R$ ${formatCurrencyBR(sale.total)}`)} style={{fontSize:10,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit",marginTop:2}}>
                      Estornar
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ PEGOS ═══ */}
      {tab==="pegos"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.advances.length===0?<Empty text="Nenhum adiantamento no período"/>:
            ledger.advances.map((adv:any)=>(
              <div key={adv.id} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>
                    {adv.type==="stock_consumption"?"📦 ":adv.type==="pix_advance"?"💲 ":"💵 "}
                    {adv.description}
                  </div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                    {new Date(adv.occurred_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                    {" · "}{ADVANCE_TYPE_LABELS[adv.type]||adv.type}
                    {adv.carry_over_to_next_period&&<span style={{color:"var(--warning)"}}> · mês q vem</span>}
                    <StatusBadge status={adv.status} labels={ADVANCE_STATUS_LABELS} colors={ADVANCE_STATUS_COLORS} />
                  </div>
                  {adv.cancellation_reason&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2,fontStyle:"italic"}}>Motivo: {adv.cancellation_reason}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:700,color:adv.status==="active"?"var(--danger)":"var(--text-muted)",fontVariantNumeric:"tabular-nums",textDecoration:adv.status!=="active"?"line-through":"none"}}>
                    -R$ {formatCurrencyBR(adv.total_amount)}
                  </span>
                  {isAdmin&&adv.status==="active"&&(
                    <div><button onClick={()=>openConfirm("advance",adv.id,adv.description)} style={{fontSize:10,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit",marginTop:2}}>
                      Cancelar
                    </button></div>
                  )}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ PRODUTOS/BEBIDAS ═══ */}
      {tab==="produtos"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.stockWithdrawals.length===0?<Empty text="Nenhuma retirada de produto no período"/>:
            ledger.stockWithdrawals.map((sw:any)=>(
              <div key={sw.id} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>📦 {sw.description}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                    {new Date(sw.occurred_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}
                    {" · Qtd: "}{sw.quantity}
                    <StatusBadge status={sw.status} labels={ADVANCE_STATUS_LABELS} colors={ADVANCE_STATUS_COLORS} />
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:700,color:sw.status==="active"?"var(--danger)":"var(--text-muted)",fontVariantNumeric:"tabular-nums"}}>
                    -R$ {formatCurrencyBR(sw.total_amount)}
                  </span>
                  {isAdmin&&sw.status==="active"&&(
                    <div><button onClick={()=>openConfirm("advance",sw.id,sw.description)} style={{fontSize:10,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit",marginTop:2}}>
                      Reverter
                    </button></div>
                  )}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ PERFUMES ═══ */}
      {tab==="perfumes"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.perfumeSales.length===0?<Empty text="Nenhuma venda de perfume no período"/>:
            ledger.perfumeSales.map((ps:any)=>(
              <div key={ps.id} style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>🧴 {ps.perfume_name_snapshot}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                    {new Date(ps.sale_date).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}
                    {" · "}{ps.customer_name_snapshot||"—"}
                    {" · "}{ps.payment_mode==="cash"?"À Vista":`${ps.installment_count}x`}
                    <StatusBadge status={ps.status} labels={PERFUME_STATUS_LABELS} colors={PERFUME_STATUS_COLORS} />
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,color:"var(--text-muted)"}}>R$ {formatCurrencyBR(ps.total_price)}</div>
                  <div style={{fontSize:12,fontWeight:700,color:ps.status!=="cancelled"?"var(--accent-light)":"var(--text-muted)"}}>
                    +R$ {formatCurrencyBR(ps.commission_amount_snapshot)}
                  </div>
                  {isAdmin&&ps.status!=="cancelled"&&(
                    <button onClick={()=>openConfirm("perfume",ps.id,ps.perfume_name_snapshot)} style={{fontSize:10,color:"var(--danger)",background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"inherit",marginTop:2}}>
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ FECHAMENTOS/LEGIT ═══ */}
      {tab==="fechamentos"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.closures.length===0?<Empty text="Nenhum fechamento registrado"/>:
            ledger.closures.map((c:any)=>(
              <div key={c.id} style={{padding:"14px 16px",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-secondary)"}}>
                    {formatFullDateBR(c.period_start)} — {formatFullDateBR(c.period_end)}
                  </span>
                  <StatusBadge status={c.status} labels={CLOSURE_STATUS_LABELS} colors={CLOSURE_STATUS_COLORS} />
                </div>
                <div style={{display:"flex",gap:16,fontSize:12,marginBottom:6}}>
                  <span style={{color:"var(--text-muted)"}}>Bruto: <strong>R$ {formatCurrencyBR(c.gross_total)}</strong></span>
                  <span style={{color:"var(--success)"}}>Líquido: <strong>R$ {formatCurrencyBR(c.net_payable)}</strong></span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {c.legit_text&&(
                    <button onClick={()=>handleCopy(c.legit_text,c.id)} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",background:"var(--accent-subtle)",border:"1px solid var(--accent-border)",borderRadius:6,color:"var(--accent)",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      {copiedLegit===c.id?<><Check size={10}/>Copiado!</>:<><Copy size={10}/>Copiar Legit</>}
                    </button>
                  )}
                  {isAdmin&&(c.status==="confirmed"||c.status==="paid")&&(
                    <button onClick={()=>openConfirm("closure",c.id,`Fechamento ${c.status==="paid"?"pago":"confirmado"}`)} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,color:"var(--danger)",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      <XCircle size={10}/>{c.status==="paid"?"Reverter":"Cancelar"}
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ AUDITORIA ═══ */}
      {tab==="auditoria"&&(
        <div className="section-card"><div className="section-card-body" style={{padding:0}}>
          {ledger.auditEvents.length===0?<Empty text="Nenhum evento de auditoria"/>:
            ledger.auditEvents.slice(0,50).map((evt:any)=>(
              <div key={evt.id} style={{padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary)"}}>{evt.action} · {evt.entity_type}</span>
                  <span style={{fontSize:10,color:"var(--text-muted)"}}>{new Date(evt.created_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div style={{fontSize:11,color:"var(--text-muted)",marginTop:2}}>
                  {evt.actor?.full_name||"Sistema"}
                  {evt.context?.observation&&<span> · {String(evt.context.observation).substring(0,120)}</span>}
                </div>
              </div>
            ))
          }
        </div></div>
      )}

      {/* ═══ CONFIRM DIALOG ═══ */}
      <Dialog open={confirmDialog.open} onOpenChange={(o)=>setConfirmDialog(p=>({...p,open:o}))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18}/>
              {confirmDialog.type==="sale"?"Estornar Venda":confirmDialog.type==="advance"?"Cancelar Adiantamento":confirmDialog.type==="perfume"?"Cancelar Venda de Perfume":"Cancelar Fechamento"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.label} — Esta ação NÃO apaga dados. Cria movimentos inversos seguros.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",color:"var(--text-secondary)"}}>Motivo *</label>
            <Textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Descreva o motivo..." rows={3}/>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setConfirmDialog(p=>({...p,open:false}))}>Voltar</Button>
            <Button variant="destructive" disabled={mutation.isPending||reason.length<3} onClick={()=>mutation.mutate({type:confirmDialog.type,id:confirmDialog.id,reason})}>
              {mutation.isPending?"Processando...":"Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helpers ──
function Kpi({label,value,color,icon}:{label:string;value:string;color:string;icon:React.ReactNode}) {
  return <div style={{padding:"12px 10px",borderRadius:10,background:"var(--bg-surface)",border:"1px solid var(--border)"}}>
    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><span style={{color:"var(--text-muted)"}}>{icon}</span><span style={{fontSize:9,fontWeight:600,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</span></div>
    <div style={{fontSize:16,fontWeight:800,color,fontVariantNumeric:"tabular-nums"}}>{value}</div>
  </div>
}

function Row({label,value,accent,muted,bold,danger,highlight}:{label:string;value:string;accent?:boolean;muted?:boolean;bold?:boolean;danger?:boolean;highlight?:boolean}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid var(--border)",background:highlight?"rgba(16,185,129,0.04)":"transparent"}}>
    <span style={{fontSize:12,fontWeight:bold||highlight?700:500,color:highlight?"var(--success)":muted?"var(--text-muted)":"var(--text-secondary)"}}>{label}</span>
    <span style={{fontSize:13,fontWeight:700,fontVariantNumeric:"tabular-nums",color:highlight?"var(--success)":danger?"var(--danger)":accent?"var(--accent-light)":muted?"var(--text-muted)":"var(--text-primary)"}}>{value}</span>
  </div>
}

function StatusBadge({status,labels,colors}:{status:string;labels:Record<string,string>;colors:Record<string,string>}) {
  return <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${colors[status]||""}`}>{labels[status]||status}</span>
}

function Empty({text}:{text:string}) {
  return <div style={{padding:32,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>{text}</div>
}
