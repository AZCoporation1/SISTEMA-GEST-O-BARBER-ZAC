"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, FileText } from "lucide-react"
import { ImportParserService } from "../services/import.service"
import { importProducts } from "../actions/import.actions"
import { ParsedImportResult } from "../types"

export function ImportWizard() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setParsedData(null)
      setError(null)
      setSuccessMsg(null)
    }
  }

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)
    setError(null)
    try {
      let result;
      if (file.name.toLowerCase().endsWith('.pdf')) {
         const { PdfExtractionService } = await import("../services/pdf.service")
         result = await PdfExtractionService.parseProductPdf(file)
      } else {
         result = await ImportParserService.parseFile(file)
      }
      
      const { valid, invalid } = result
      setParsedData({
        validRows: valid,
        invalidRows: invalid,
        totalProcessed: valid.length + invalid.length
      })
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao ler arquivo.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!parsedData || parsedData.validRows.length === 0) return
    
    setIsImporting(true)
    setError(null)
    const result = await importProducts(parsedData.validRows)
    setIsImporting(false)

    if (result.success) {
      setSuccessMsg(`Sucesso! ${result.count} produtos foram importados/atualizados no estoque Barber Zac.`)
      setParsedData(null)
      setFile(null)
      router.refresh()
    } else {
      setError(result.error || "Falha ao gravar linhas no banco de dados.")
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Upload Box */}
      {(!parsedData && !successMsg) && (
        <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center bg-card text-center hover:bg-muted/30 transition-colors">
          <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Importar Dados Barber Zac</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            Envie planilhas (.xlsx, .csv) ou Relatórios em PDF. O sistema usará o Código do produto para identificar produtos novos ou atualizar os existentes.
          </p>
          
          <div className="flex items-center gap-4">
            <input 
               type="file" 
               id="spreadsheet-upload" 
               className="hidden" 
               accept=".xlsx, .xls, .csv, .pdf"
               onChange={handleFileChange}
            />
            <Button 
               variant={file ? "secondary" : "default"} 
               className={!file ? "btn-gold text-black" : ""}
               asChild
            >
              <label htmlFor="spreadsheet-upload" className="cursor-pointer">
                {file ? "Trocar Arquivo" : "Selecionar Planilha"}
              </label>
            </Button>
            
            {file && (
              <Button onClick={handleParse} disabled={isParsing} className="btn-gold text-black">
                {isParsing ? "Lendo..." : "Processar Arquivo"}
              </Button>
            )}
          </div>
          {file && (
            <p className="mt-4 text-sm font-medium flex items-center gap-2">
              {file.name.toLowerCase().endsWith('.pdf') ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
              {file.name}
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3 text-danger">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <p className="font-medium">Falha na importação</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {successMsg && (
        <div className="p-6 bg-success/10 border border-success/20 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-12 w-12 bg-success/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-success">Importação Concluída</h3>
            <p className="text-sm text-foreground">{successMsg}</p>
          </div>
          <Button variant="outline" onClick={() => setSuccessMsg(null)}>Importar outra planilha</Button>
        </div>
      )}

      {/* Preview & Confirmation Box */}
      {parsedData && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-3 gap-4">
             <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground">Linhas Processadas</p>
                <p className="text-2xl font-bold">{parsedData.totalProcessed}</p>
             </div>
             <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-success">
                <p className="text-sm">Prontas para Importar</p>
                <p className="text-2xl font-bold">{parsedData.validRows.length}</p>
             </div>
             <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger">
                <p className="text-sm">Linhas com Erros</p>
                <p className="text-2xl font-bold">{parsedData.invalidRows.length}</p>
             </div>
          </div>

          {parsedData.invalidRows.length > 0 && (
             <div className="p-4 rounded-lg bg-card border max-h-48 overflow-auto">
               <h4 className="font-semibold text-danger flex items-center gap-2 mb-2">
                 <AlertTriangle className="h-4 w-4" /> Problemas Encontrados
               </h4>
               <p className="text-sm text-muted-foreground mb-4">
                 Linhas vazias geralmente causam erro de "Código Obrigatório". As linhas vermelhas abaixo <b>NÃO</b> serão importadas.
               </p>
               <ul className="text-sm space-y-2">
                 {parsedData.invalidRows.slice(0, 10).map((ir, i) => (
                   <li key={i} className="text-foreground bg-muted p-2 rounded">
                      <span className="font-medium">Linha:</span> {JSON.stringify(ir.row?.codigo || "Vazia")} <br/>
                      <span className="text-danger">{ir.errors.join(', ')}</span>
                   </li>
                 ))}
                 {parsedData.invalidRows.length > 10 && (
                   <li className="text-muted-foreground text-xs ita">+ {parsedData.invalidRows.length - 10} outras linhas com erro.</li>
                 )}
               </ul>
             </div>
          )}

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div>
              <p className="font-medium">Confirmação de Importação</p>
              <p className="text-sm text-muted-foreground">
                Serão processados {parsedData.validRows.length} produtos. Produtos com código já existente serão atualizados.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setParsedData(null)} disabled={isImporting}>Cancelar</Button>
              <Button onClick={handleImport} disabled={isImporting || parsedData.validRows.length === 0} className="btn-gold text-black">
                {isImporting ? "Gravando no Banco..." : "Confirmar e Importar"}
              </Button>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
