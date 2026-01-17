import ExcelJS from "exceljs";
import { type AnalysisResult } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

export interface WriteResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export async function generateResultsExcel(
  reviewBatch: string,
  results: AnalysisResult[],
  jobId: string
): Promise<WriteResult> {
  try {
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const fileName = `analysis-results-${jobId}.xlsx`;
    const filePath = path.join(tmpDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EquityReview Analysis Portal";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Analysis Results");

    worksheet.columns = [
      { header: "ReviewBatch", key: "reviewBatch", width: 25 },
      { header: "EmployeeId", key: "employeeId", width: 15 },
      { header: "AI_Output", key: "aiOutput", width: 80 },
      { header: "AI_Recommendation", key: "aiRecommendation", width: 20 },
      { header: "ReviewStatus", key: "reviewStatus", width: 15 },
      { header: "ReviewerNotes", key: "reviewerNotes", width: 30 },
      { header: "FlagsTriggered", key: "flagsTriggered", width: 40 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

    for (const result of results) {
      const aiOutput = `Bias Assessment: ${result.biasAssessment} | Values Alignment: ${result.valuesAlignment} | Rating Consistency: ${result.ratingConsistency} (${result.ratingConsistencyRationale})`;
      
      const row = worksheet.addRow({
        reviewBatch,
        employeeId: result.employeeId,
        aiOutput,
        aiRecommendation: result.aiRecommendation,
        reviewStatus: "Pending",
        reviewerNotes: "",
        flagsTriggered: result.flagsTriggered.join(", "),
      });

      if (result.aiRecommendation === "RED") {
        row.getCell("aiRecommendation").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFF6B6B" },
        };
      } else {
        row.getCell("aiRecommendation").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF51CF66" },
        };
      }
    }

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: results.length + 1, column: 7 },
    };

    await workbook.xlsx.writeFile(filePath);

    return { success: true, filePath, fileName };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate results Excel: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
