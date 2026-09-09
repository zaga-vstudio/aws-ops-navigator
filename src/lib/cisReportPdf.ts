import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CISAuditRun, CISCheckResult, CISSeverity, CISStatus } from "@/hooks/useCISAudit";
import {
  CIS_TOTAL_CONTROLS,
  CIS_UNCOVERED_AREAS,
  cisImpact,
  cisRegionNotice,
} from "@/lib/cisScope";

const STATUS_LABEL: Record<CISStatus, string> = {
  PASS: "Correcto",
  FAIL: "Incumple",
  NOT_APPLICABLE: "No aplica",
  ERROR: "Sin datos",
};

const SEVERITY_LABEL: Record<CISSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SEVERITY_ORDER: CISSeverity[] = ["critical", "high", "medium", "low"];

const COLORS = {
  ink: [24, 28, 38] as [number, number, number],
  muted: [110, 118, 132] as [number, number, number],
  brand: [37, 99, 235] as [number, number, number],
  pass: [22, 128, 92] as [number, number, number],
  fail: [190, 44, 44] as [number, number, number],
  warn: [176, 118, 12] as [number, number, number],
  line: [222, 226, 234] as [number, number, number],
};

function statusColor(status: CISStatus): [number, number, number] {
  if (status === "PASS") return COLORS.pass;
  if (status === "FAIL") return COLORS.fail;
  if (status === "ERROR") return COLORS.warn;
  return COLORS.muted;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function drawFooters(doc: jsPDF, subject: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLORS.line);
    doc.line(40, h - 42, w - 40, h - 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Clodaro · Informe de auditoría CIS · ${subject}`, 40, h - 28);
    doc.text(`Página ${i} de ${total}`, w - 40, h - 28, { align: "right" });
  }
}

/** Generates the branded CIS audit report and triggers a download. */
export function generateCISReportPdf(run: CISAuditRun) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const subject = run.client_name_snapshot || "Mi cuenta AWS";

  // ----- Portada -----
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 180, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("Informe de auditoría CIS", 40, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(run.benchmark, 40, 104);
  doc.setFontSize(10);
  doc.text("Clodaro · Auditoría de infraestructura AWS", 40, 140);

  let y = 220;
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Alcance de la auditoría", 40, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 6, textColor: COLORS.ink },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 150, textColor: COLORS.muted } },
    body: [
      ["Cliente auditado", subject],
      ["Cuenta AWS", run.aws_account_id || "No disponible"],
      ["Región analizada", run.region],
      ["Fecha de ejecución", formatDate(run.created_at)],
      ["Controles evaluados", `${run.passed_count + run.failed_count}`],
      ["Controles no aplicables", `${run.not_applicable_count}`],
      ["Controles sin datos", `${run.error_count}`],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 36;

  // ----- Puntuación -----
  const scoreColor = run.score >= 80 ? COLORS.pass : run.score >= 50 ? COLORS.warn : COLORS.fail;
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(248, 249, 251);
  doc.roundedRect(40, y, pageWidth - 80, 96, 8, 8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.setTextColor(...scoreColor);
  doc.text(`${run.score}%`, 68, y + 62);
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text("Nivel de cumplimiento", 190, y + 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `${run.passed_count} controles correctos · ${run.failed_count} incumplimientos detectados`,
    190,
    y + 60,
  );

  y += 130;

  // ----- Resumen por severidad -----
  const failed = run.results.filter((r) => r.status === "FAIL");
  const bySeverity = SEVERITY_ORDER.map((sev) => [
    SEVERITY_LABEL[sev],
    String(failed.filter((r) => r.severity === sev).length),
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.ink);
  doc.text("Incumplimientos por severidad", 40, y);

  autoTable(doc, {
    startY: y + 12,
    head: [["Severidad", "Incumplimientos"]],
    body: bySeverity,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: COLORS.ink, textColor: 255 },
    columnStyles: { 1: { halign: "right", cellWidth: 120 } },
  });

  // ----- Hallazgos prioritarios -----
  if (failed.length > 0) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.ink);
    doc.text("Hallazgos y remediación", 40, 60);

    const sorted = [...failed].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );

    autoTable(doc, {
      startY: 80,
      head: [["Control", "Severidad", "Hallazgo", "Remediación recomendada"]],
      body: sorted.map((r) => [
        `${r.id}\n${r.title}`,
        SEVERITY_LABEL[r.severity],
        r.evidence.length > 0 ? `${r.summary}\n\n${r.evidence.slice(0, 6).join("\n")}` : r.summary,
        r.remediation,
      ]),
      styles: { fontSize: 9, cellPadding: 6, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: COLORS.ink, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 120, fontStyle: "bold" },
        1: { cellWidth: 60 },
        2: { cellWidth: 175 },
      },
    });
  }

  // ----- Detalle completo -----
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.ink);
  doc.text("Detalle de todos los controles", 40, 60);

  const sections = Array.from(new Set(run.results.map((r) => r.section)));
  let cursor = 80;

  sections.forEach((section) => {
    const rows: CISCheckResult[] = run.results.filter((r) => r.section === section);
    autoTable(doc, {
      startY: cursor,
      head: [[section, "Severidad", "Estado", "Resultado"]],
      body: rows.map((r) => [`${r.id} ${r.title}`, SEVERITY_LABEL[r.severity], STATUS_LABEL[r.status], r.summary]),
      styles: { fontSize: 9, cellPadding: 5, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: COLORS.brand, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 170 },
        1: { cellWidth: 55 },
        2: { cellWidth: 60 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const status = rows[data.row.index].status;
          data.cell.styles.textColor = statusColor(status);
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    cursor = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  });

  if (run.errors && run.errors.length > 0) {
    autoTable(doc, {
      startY: cursor,
      head: [["Control sin datos", "Motivo"]],
      body: run.errors.map((e) => [e.check, e.message]),
      styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: COLORS.warn, textColor: 255 },
    });
  }

  drawFooters(doc, subject);

  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const date = run.created_at.slice(0, 10);
  doc.save(`informe-cis-${slug}-${date}.pdf`);
}
