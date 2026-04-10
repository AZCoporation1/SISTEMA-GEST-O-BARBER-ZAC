import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

type ExportFormat = "csv" | "xlsx" | "pdf"

export class ExportService {

  /**
   * Browser-side generic exporter.
   * `filename` should not include extension (e.g. "relatorio_estoque")
   * `data` must be an array of objects representing rows.
   */
  static exportData(data: any[], filename: string, format: ExportFormat, title?: string): boolean {
    const safeData = data?.filter(Boolean) || []
    
    if (safeData.length === 0) {
      return false
    }

    if (format === 'csv') {
      this.downloadCSV(safeData, `${filename}.csv`)
    } else if (format === 'xlsx') {
      this.downloadXLSX(safeData, `${filename}.xlsx`)
    } else if (format === 'pdf') {
      this.downloadPDF(safeData, `${filename}.pdf`, title || "Relatório Barber Zac")
    }

    return true
  }

  private static downloadCSV(data: any[], filename: string) {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" }) // Barber Zac legacy relies on semicolon primarily 

    // Add BOM for correct UTF-8 rendering in Excel
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' })
    this.triggerDownload(blob, filename)
  }

  private static downloadXLSX(data: any[], filename: string) {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
    
    // Write array buffer
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    this.triggerDownload(blob, filename)
  }

  private static downloadPDF(data: any[], filename: string, title: string) {
    const doc = new jsPDF('landscape')
    
    // Header
    doc.setFontSize(18)
    doc.text(title, 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30)

    // Table Generation requires headers
    if (!data[0]) {
      doc.text("Sem dados disponíveis.", 14, 40)
      doc.save(filename)
      return
    }
    const headers = Object.keys(data[0])
    const rows = data.map(item => headers.map(h => String(item[h] ?? "")))

    // @ts-ignore - jspdf-autotable extends jsPDF but typings sometimes drop in TS
    doc.autoTable({
      startY: 35,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [43, 45, 66] }, // Barberzac Dark Primary
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 35 }
    })

    doc.save(filename)
  }

  private static triggerDownload(blob: Blob, filename: string) {
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
