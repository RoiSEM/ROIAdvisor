import { supabase } from "@/lib/supabase-server";
import { buildPreviewSummary, getReportHealthScore } from "@/lib/report-summary";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

function formatReportMonth(value: string | null) {
  if (!value) return "No month set";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatNumber(value: number | null) {
  return Number(value || 0).toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function splitSummarySections(markdown: string | null) {
  if (!markdown) return [];

  const sections: Array<{ title: string; content: string }> = [];
  const lines = markdown.split("\n");
  let inCodeFence = false;
  let currentTitle = "";
  let currentLines: string[] = [];

  const pushSection = () => {
    const content = currentLines.join("\n").trim();

    if (!currentTitle && !content) return;

    sections.push({
      title: currentTitle || "Summary",
      content,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^##\s+/.test(line)) {
      pushSection();
      currentTitle = line.replace(/^##\s+/, "").trim() || "Summary";
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  pushSection();

  return sections.filter(
    (section) => section.title.trim() || section.content.trim(),
  );
}

function extractBulletItems(content: string) {
  const lines = content.split("\n");
  const bullets: string[] = [];
  const remainder: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }

    if (!inCodeFence && /^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, "").trim());
      continue;
    }

    remainder.push(line);
  }

  return {
    bullets,
    remainder: remainder.join("\n").trim(),
  };
}

function sanitizeText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = sanitizeText(text).split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;

      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

function estimateTextHeight(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  lineGap = 4,
) {
  const lines = wrapText(text, font, size, maxWidth);
  const lineHeight = size + lineGap;
  return Math.max(lineHeight, lines.length * lineHeight);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data: report, error } = await supabase
      .from("reports")
      .select(
        `
        *,
        clients (*)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !report) {
      return new Response("Report not found", { status: 404 });
    }

    const client = Array.isArray(report.clients)
      ? report.clients[0]
      : report.clients;

    const summaryMarkdown = report.ai_summary || buildPreviewSummary(report, client);
    const summarySections = splitSummarySections(summaryMarkdown);
    const healthScore = getReportHealthScore(report, client);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageSize: [number, number] = [612, 792];
    const margin = 42;
    const pageWidth = pageSize[0];
    const pageHeight = pageSize[1];
    const contentWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage(pageSize);
    let y = pageHeight - margin;

    const colors = {
      ink: rgb(0.06, 0.09, 0.16),
      muted: rgb(0.39, 0.43, 0.49),
      border: rgb(0.88, 0.9, 0.92),
      panel: rgb(0.98, 0.99, 1),
      subtle: rgb(0.97, 0.98, 0.99),
      healthy: rgb(0.08, 0.55, 0.33),
      warning: rgb(0.85, 0.55, 0.08),
      critical: rgb(0.78, 0.19, 0.23),
    };

    const addPage = () => {
      page = pdfDoc.addPage(pageSize);
      y = pageHeight - margin;
    };

    const ensureSpace = (needed: number) => {
      if (y - needed < margin) addPage();
    };

    const drawWrappedText = (
      text: string,
      x: number,
      topY: number,
      maxWidth: number,
      size: number,
      chosenFont: PDFFont,
      color: ReturnType<typeof rgb>,
      lineGap = 4,
    ) => {
      const lines = wrapText(text, chosenFont, size, maxWidth);
      const lineHeight = size + lineGap;
      let lineY = topY;

      for (const line of lines) {
        if (line) {
          page.drawText(line, {
            x,
            y: lineY - size,
            size,
            font: chosenFont,
            color,
          });
        }

        lineY -= lineHeight;
      }

      return topY - Math.max(lineHeight, lines.length * lineHeight);
    };

    const drawSectionTitle = (title: string) => {
      ensureSpace(28);
      page.drawText(title, {
        x: margin,
        y: y - 18,
        size: 18,
        font: boldFont,
        color: colors.ink,
      });
      y -= 30;
    };

    const drawParagraphBlock = (text: string, inset = 16) => {
      const width = contentWidth - inset * 2;
      const height = estimateTextHeight(text, font, 11, width, 5) + 24;
      ensureSpace(height);

      page.drawRectangle({
        x: margin,
        y: y - height,
        width: contentWidth,
        height,
        borderColor: colors.border,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      drawWrappedText(text, margin + inset, y - 14, width, 11, font, colors.ink, 5);
      y -= height + 18;
    };

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 4,
      color: colors.ink,
    });

    y -= 22;

    page.drawText("Monthly Performance Report", {
      x: margin,
      y: y - 12,
      size: 10,
      font: boldFont,
      color: colors.muted,
    });

    y -= 24;

    page.drawText(client?.name || "Client Report", {
      x: margin,
      y: y - 22,
      size: 28,
      font: boldFont,
      color: colors.ink,
    });

    y -= 34;

    page.drawText(formatReportMonth(report.month), {
      x: margin,
      y: y - 16,
      size: 16,
      font,
      color: colors.ink,
    });

    const clientDetails = [client?.website, client?.email].filter(Boolean).join("\n");

    if (clientDetails) {
      y -= 24;
      y = drawWrappedText(
        clientDetails,
        margin,
        y,
        contentWidth - 170,
        10,
        font,
        colors.muted,
        4,
      );
    }

    page.drawRectangle({
      x: pageWidth - margin - 120,
      y: pageHeight - margin - 78,
      width: 120,
      height: 54,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.subtle,
    });

    page.drawText("LOGO", {
      x: pageWidth - margin - 78,
      y: pageHeight - margin - 46,
      size: 12,
      font: boldFont,
      color: colors.muted,
    });

    y -= 28;

    drawSectionTitle("Performance Overview");

    const kpis = [
      { label: "Traffic", value: formatNumber(report.traffic) },
      { label: "Page Views", value: formatNumber(report.page_views) },
      { label: "Active Users", value: formatNumber(report.active_users) },
      { label: "Bounce Rate", value: formatPercent(report.bounce_rate) },
      { label: "Engagement Rate", value: formatPercent(report.engagement_rate) },
      { label: "Conversions", value: formatNumber(report.conversions) },
    ];

    const cardGap = 12;
    const cardWidth = (contentWidth - cardGap * 2) / 3;
    const cardHeight = 64;

    for (let i = 0; i < kpis.length; i += 3) {
      ensureSpace(cardHeight + 12);

      const row = kpis.slice(i, i + 3);

      row.forEach((item, index) => {
        const x = margin + index * (cardWidth + cardGap);

        page.drawRectangle({
          x,
          y: y - cardHeight,
          width: cardWidth,
          height: cardHeight,
          borderColor: colors.border,
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });

        page.drawText(item.label.toUpperCase(), {
          x: x + 12,
          y: y - 18,
          size: 8,
          font: boldFont,
          color: colors.muted,
        });

        page.drawText(item.value, {
          x: x + 12,
          y: y - 44,
          size: 18,
          font: boldFont,
          color: colors.ink,
        });
      });

      y -= cardHeight + 12;
    }

    const healthColor =
      healthScore.label === "Healthy"
        ? colors.healthy
        : healthScore.label === "Warning"
          ? colors.warning
          : colors.critical;

    const healthReasonHeight =
      estimateTextHeight(healthScore.reason, font, 11, contentWidth - 190, 5) + 12;
    const healthHeight = Math.max(78, healthReasonHeight + 24);

    ensureSpace(healthHeight + 18);

    page.drawRectangle({
      x: margin,
      y: y - healthHeight,
      width: contentWidth,
      height: healthHeight,
      borderColor: rgb(
        Math.min(1, healthColor.red + 0.35),
        Math.min(1, healthColor.green + 0.35),
        Math.min(1, healthColor.blue + 0.35),
      ),
      borderWidth: 1,
      color: colors.panel,
    });

    page.drawText("REPORT HEALTH", {
      x: margin + 16,
      y: y - 18,
      size: 8,
      font: boldFont,
      color: colors.muted,
    });

    page.drawRectangle({
      x: margin + 16,
      y: y - 40,
      width: 72,
      height: 18,
      color: rgb(
        Math.min(1, healthColor.red + 0.75),
        Math.min(1, healthColor.green + 0.75),
        Math.min(1, healthColor.blue + 0.75),
      ),
    });

    page.drawText(healthScore.label.toUpperCase(), {
      x: margin + 24,
      y: y - 33,
      size: 8,
      font: boldFont,
      color: healthColor,
    });

    page.drawText(`${healthScore.score}/100`, {
      x: margin + 102,
      y: y - 38,
      size: 20,
      font: boldFont,
      color: colors.ink,
    });

    page.drawCircle({
      x: margin + 212,
      y: y - 31,
      size: 4,
      color: healthColor,
    });

    drawWrappedText(
      healthScore.reason,
      margin + 224,
      y - 20,
      contentWidth - 240,
      11,
      font,
      colors.ink,
      5,
    );

    y -= healthHeight + 18;

    drawSectionTitle("Notes");
    drawParagraphBlock(report.notes || "No notes provided.");

    drawSectionTitle("Summary & Insights");

    if (summarySections.length > 0) {
      for (const section of summarySections) {
        const { bullets, remainder } = extractBulletItems(section.content || "");
        const bulletLines = bullets.flatMap((bullet) =>
          wrapText(`• ${bullet}`, font, 11, contentWidth - 32),
        );
        const remainderHeight = remainder
          ? estimateTextHeight(remainder, font, 11, contentWidth - 32, 5)
          : 0;
        const sectionHeight =
          48 +
          (bulletLines.length > 0 ? bulletLines.length * 16 + 12 : 0) +
          (remainderHeight > 0 ? remainderHeight + 8 : 0) +
          12;

        ensureSpace(sectionHeight);

        page.drawRectangle({
          x: margin,
          y: y - sectionHeight,
          width: contentWidth,
          height: sectionHeight,
          borderColor: colors.border,
          borderWidth: 1,
          color: rgb(1, 1, 1),
        });

        page.drawText(section.title, {
          x: margin + 16,
          y: y - 24,
          size: 15,
          font: boldFont,
          color: colors.ink,
        });

        page.drawLine({
          start: { x: margin + 16, y: y - 34 },
          end: { x: pageWidth - margin - 16, y: y - 34 },
          thickness: 1,
          color: colors.border,
        });

        let sectionY = y - 48;

        if (bulletLines.length > 0) {
          for (const line of bulletLines) {
            if (line) {
              page.drawText(line, {
                x: margin + 16,
                y: sectionY - 11,
                size: 11,
                font,
                color: colors.ink,
              });
            }

            sectionY -= 16;
          }

          sectionY -= 4;
        }

        if (remainder) {
          sectionY = drawWrappedText(
            remainder,
            margin + 16,
            sectionY,
            contentWidth - 32,
            11,
            font,
            colors.ink,
            5,
          );
        }

        y -= sectionHeight + 16;
      }
    } else {
      drawParagraphBlock(summaryMarkdown || "No summary available.");
    }

    ensureSpace(36);
    page.drawLine({
      start: { x: margin, y: y - 6 },
      end: { x: pageWidth - margin, y: y - 6 },
      thickness: 1,
      color: colors.border,
    });

    page.drawText("Confidential", {
      x: margin,
      y: y - 24,
      size: 9,
      font,
      color: colors.muted,
    });

    const generatedText = `Generated ${new Date().toLocaleDateString()}`;
    const generatedWidth = font.widthOfTextAtSize(generatedText, 9);

    page.drawText(generatedText, {
      x: pageWidth - margin - generatedWidth,
      y: y - 24,
      size: 9,
      font,
      color: colors.muted,
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}
