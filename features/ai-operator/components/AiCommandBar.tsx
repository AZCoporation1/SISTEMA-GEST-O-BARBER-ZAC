"use client"

import { useState } from "react"
import { Bot, Sparkles, Send, X, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { submitAiCommand, executeAiAction } from "../actions/ai.actions"
import { AiResponse } from "../types"
import { useAppSettings } from "@/features/settings/hooks/useSettings"

export function AiCommandBar() {
  const { data: settings } = useAppSettings()
  const [isOpen, setIsOpen] = useState(false)
  const [command, setCommand] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Feedback States
  const [response, setResponse] = useState<AiResponse | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim()) return

    setIsLoading(true)
    setError(null)
    setResponse(null)

    const res = await submitAiCommand(command)
    setIsLoading(false)

    if (res.success && res.data) {
      setResponse(res.data)
      if (res.data.type === 'action') {
        setShowPreview(true)
      } else {
        setShowPreview(true) // Show query or alert results in the same modal
      }
    } else {
      setError(res.error || "Houve uma falha ao contatar a IA Operacional.")
    }
  }

  const handleConfirmAction = async () => {
    if (!response || !response.action) return
    
    setIsLoading(true)
    const res = await executeAiAction(response.action, command)
    setIsLoading(false)

    if (res.success) {
      setResponse({
        type: 'query', // Mocking a success message
        message: res.message
      })
      setCommand("") // clear input on success
    } else {
      setError(res.error || "Falha ao gravar a operação gerada pela IA.")
    }
  }

  // Respect global settings
  if (settings && settings.ai_enabled === false) {
    return null
  }

  return (
    <>
      {/* Floating Button */}
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-2xl btn-gold flex items-center justify-center z-50 hover:scale-110 transition-transform"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Command Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] border-amber-500/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-amber-500" />
              IA Operacional
            </DialogTitle>
            <DialogDescription>
              Peça relatórios, faça ajustes de estoque ou consulte informações num comando simples.
            </DialogDescription>
          </DialogHeader>

          {!showPreview ? (
            <form onSubmit={handleSubmit} className="flex gap-2 items-center mt-4">
              <Input 
                autoFocus
                placeholder="Ex: Registre a entrada de 5 Pomadas Fox For Men por R$ 22 cada" 
                value={command}
                onChange={e => setCommand(e.target.value)}
                disabled={isLoading}
                className="text-base py-6 focus-visible:ring-amber-500"
              />
              <Button type="submit" size="icon" disabled={isLoading || !command.trim()} className="h-12 w-12 btn-gold">
                <Send className="h-5 w-5" />
              </Button>
            </form>
          ) : (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
              {response?.type === 'action' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-500 font-medium">
                    <AlertTriangle className="h-5 w-5" />
                    Revisão de Comando
                  </div>
                  <p className="text-sm">{response.message}</p>
                  
                  <div className="p-3 bg-background rounded border-l-4 border-amber-500 text-sm font-mono">
                    {response.preview}
                  </div>

                  <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isLoading}>Cancelar</Button>
                    <Button className="btn-gold" onClick={handleConfirmAction} disabled={isLoading}>
                      {isLoading ? "Processando..." : "Confirmar Operação"}
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {(response?.type === 'query' || response?.type === 'alert') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-500 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    Resposta da IA
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{response.message}</p>
                  
                  {response.items && response.items.length > 0 && (
                    <ul className="list-disc pl-5 text-sm space-y-1 mt-2 text-muted-foreground">
                      {response.items.map((item, i) => (
                        <li key={i}>{JSON.stringify(item)}</li>
                      ))}
                    </ul>
                  )}

                  <DialogFooter className="mt-6">
                    <Button onClick={() => setShowPreview(false)}>Nova Pergunta</Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}

          {isLoading && !showPreview && (
            <p className="text-sm text-yellow-600 animate-pulse mt-2">IA interpretando seu comando...</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
