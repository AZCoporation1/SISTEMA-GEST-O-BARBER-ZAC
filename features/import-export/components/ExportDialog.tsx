"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Download, FileText, FileSpreadsheet, FileJson, Loader2 } from "lucide-react"
import { ExportService } from "../services/export.service"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ExportDialogProps {
  data: any[]
  filename: string
  title: string
  buttonText?: string
}

export function ExportDialog({ data, filename, title, buttonText = "Exportar" }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    setIsExporting(true)
    try {
      // Small timeout to allow UI loading state to render
      await new Promise(resolve => setTimeout(resolve, 50))
      const success = ExportService.exportData(data, filename, format, title)
      if (!success) {
        toast.warning("Não há dados válidos para exportar.")
      } else {
        setOpen(false)
      }
    } catch (err) {
      console.error(err)
      toast.error("Falha ao exportar relatório.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Relatório</DialogTitle>
          <DialogDescription>
            Escolha o formato ideal para analisar ou compartilhar "{title}".
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={() => handleExport('xlsx')}
            disabled={isExporting || data.length === 0}
          >
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            Excel (XLSX)
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
            onClick={() => handleExport('pdf')}
            disabled={isExporting || data.length === 0}
          >
            <FileText className="h-8 w-8 text-red-600" />
            Documento (PDF)
          </Button>

          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => handleExport('csv')}
            disabled={isExporting || data.length === 0}
          >
            <FileJson className="h-8 w-8" />
            Tabela (CSV)
          </Button>
        </div>
        
        {isExporting && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
             <Loader2 className="h-4 w-4 animate-spin" /> Gerando arquivo...
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
