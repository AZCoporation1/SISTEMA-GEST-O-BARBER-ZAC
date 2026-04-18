"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { UploadCloud, FileType, CheckCircle2, AlertCircle } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { importCustomersBatch } from "../actions/import.actions"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CustomerImportDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const queryClient = useQueryClient()

  const { mutateAsync: processImport, isPending } = useMutation({
    mutationFn: (data: any[]) => importCustomersBatch(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Importação concluída!`, {
          description: `${res.imported} adicionados, ${res.updated} atualizados, ${res.skipped} ignorados.`
        })
        queryClient.invalidateQueries({ queryKey: ["customers"] })
        handleClose()
      } else {
        toast.error(res.error)
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha na importação.")
    }
  })

  const handleClose = () => {
    setFile(null)
    setPreviewData([])
    onOpenChange(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setIsProcessingFile(true)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" })
        setPreviewData(data)
      } catch (error) {
        console.error("Erro ao ler excel", error)
        toast.error("Erro ao ler o arquivo Excel. Verifique o formato.")
        setFile(null)
      } finally {
        setIsProcessingFile(false)
      }
    }
    reader.readAsBinaryString(selectedFile)
  }

  const handleConfirm = () => {
    if (previewData.length > 0) {
      processImport(previewData)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Clientes</DialogTitle>
          <DialogDescription>
            Faça upload da planilha (Excel/CSV) para adicionar ou atualizar clientes em lote.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {!file && (
            <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => document.getElementById("excel-upload")?.click()}>
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Clique para selecionar</p>
              <p className="text-xs text-muted-foreground">ou arraste o arquivo .xlsx</p>
              <input 
                id="excel-upload" 
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload} 
              />
            </div>
          )}

          {isProcessingFile && (
            <div className="p-4 rounded-lg bg-muted flex items-center justify-center">
              <p className="text-sm animate-pulse">Lendo arquivo...</p>
            </div>
          )}

          {file && !isProcessingFile && (
            <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <FileType className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreviewData([]); }}>
                  Trocar
                </Button>
              </div>

              <div className="bg-background border rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-green-600 dark:text-green-400">Arquivo válido</span>
                </div>
                <p>Encontramos <strong>{previewData.length}</strong> registros para importar.</p>
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>A importação fará a atualização automática caso o CPF, Celular ou E-mail já existam no sistema.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!file || isPending || previewData.length === 0}>
            {isPending ? "Importando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
