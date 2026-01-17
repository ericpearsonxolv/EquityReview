import ExcelJS from "exceljs";
import { type EmployeeData, columnAliases } from "@shared/schema";

export interface ParseResult {
  success: boolean;
  employees?: EmployeeData[];
  error?: string;
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function findColumnIndex(headers: string[], targetAliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeColumnName(headers[i] || "");
    if (targetAliases.some(alias => normalized === alias || normalized.includes(alias))) {
      return i;
    }
  }
  return -1;
}

export async function parseExcelFile(buffer: Buffer): Promise<ParseResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { success: false, error: "No worksheet found in the Excel file" };
    }

    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || "");
    });

    const columnIndices: Record<keyof EmployeeData, number> = {
      employeeId: findColumnIndex(headers, columnAliases.employeeId),
      goalEmployeeRating: findColumnIndex(headers, columnAliases.goalEmployeeRating),
      goalManagerRating: findColumnIndex(headers, columnAliases.goalManagerRating),
      valuesEmployeeRating: findColumnIndex(headers, columnAliases.valuesEmployeeRating),
      valuesManagerRating: findColumnIndex(headers, columnAliases.valuesManagerRating),
      overallRatingEmployee: findColumnIndex(headers, columnAliases.overallRatingEmployee),
      overallRatingManager: findColumnIndex(headers, columnAliases.overallRatingManager),
      managerComments: findColumnIndex(headers, columnAliases.managerComments),
    };

    if (columnIndices.employeeId === -1) {
      return { 
        success: false, 
        error: "EmployeeId column not found. Please ensure your Excel file has a column named 'EmployeeId', 'Employee ID', or similar." 
      };
    }

    const employees: EmployeeData[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      
      const getCellValue = (index: number): string | undefined => {
        if (index === -1) return undefined;
        const cell = row.getCell(index + 1);
        const value = cell.value;
        if (value === null || value === undefined) return undefined;
        return String(value).trim();
      };

      const employeeId = getCellValue(columnIndices.employeeId);
      if (!employeeId) return;

      employees.push({
        employeeId,
        goalEmployeeRating: getCellValue(columnIndices.goalEmployeeRating),
        goalManagerRating: getCellValue(columnIndices.goalManagerRating),
        valuesEmployeeRating: getCellValue(columnIndices.valuesEmployeeRating),
        valuesManagerRating: getCellValue(columnIndices.valuesManagerRating),
        overallRatingEmployee: getCellValue(columnIndices.overallRatingEmployee),
        overallRatingManager: getCellValue(columnIndices.overallRatingManager),
        managerComments: getCellValue(columnIndices.managerComments),
      });
    });

    if (employees.length === 0) {
      return { success: false, error: "No employee data found in the Excel file" };
    }

    return { success: true, employees };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}` 
    };
  }
}
