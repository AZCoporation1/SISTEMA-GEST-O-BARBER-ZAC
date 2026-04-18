"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { processServicesImport } from "../actions/import.actions"
import { toast } from "sonner"
import * as XLSX from "xlsx"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ServiceImportDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo .xlsx")
      return
    }

    setLoading(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (!jsonData || jsonData.length === 0) {
        throw new Error("A planilha está vazia ou no formato incorreto.")
      }

      const res = await processServicesImport(jsonData)
      
      if (!res.success) {
        throw new Error("Erro na importação.")
      }

      toast.success(`Importação concluída. Inseridos: ${res.inserted}. Atualizados: ${res.updated}.`)
      
      if (res.errors && res.errors.length > 0) {
        console.warn("Erros na importação de serviços:", res.errors)
        toast.warning(`${res.errors.length} aviso(s)/erro(s) na importação. Veja o console.`)
      }

      queryClient.invalidateQueries({ queryKey: ["services"] })
      onOpenChange(false)
      setFile(null)
    } catch (err: any) {
      toast.error(err.message || "Erro fatal ao ler planilha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Importar Serviços (Excel)</DialogTitle>
          <DialogDescription>
            Envie sua planilha padrão com as colunas: <b>Descrição, Valor, Tempo, Comissão, Categoria, Disponível</b>.<br/>
            Serviços já existentes (pelo nome) serão apenas atualizados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? "Importando..." : "Iniciar Importação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
