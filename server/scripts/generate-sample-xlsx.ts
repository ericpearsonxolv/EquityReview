import ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";

const ratingOptions = [
  "Does Not Meet Expectations",
  "Meets Expectations", 
  "Exceeds Expectations"
];

const managerCommentsPool = [
  "Employee consistently meets expectations and delivers quality work on time.",
  "Strong performer who exceeds expectations in most areas. Demonstrated leadership during Q3 project.",
  "Needs improvement in communication. Often misses deadlines without prior notice.",
  "Good team player with solid technical skills. Could benefit from more proactive approach.",
  "Excellent work ethic and always willing to help colleagues.",
  "Performance has declined this quarter. Recommend performance improvement plan.",
  "Outstanding contributor who goes above and beyond. Ready for promotion consideration.",
  "Meets basic requirements but lacks initiative. Consider additional training.",
  "Employee is difficult to work with and has communication issues.",
  "Great attitude but performance does not meet expectations in key areas.",
  "Too aggressive in meetings, needs to learn to collaborate better.",
  "Not a culture fit for the team dynamics.",
  "Emotional responses during feedback sessions noted.",
  "Employee mentioned ongoing medical issues affecting work.",
  "Reported harassment concerns from previous department - requires HR review.",
  "Excellent performer, consistently delivers high-quality results with minimal supervision.",
  "Solid contributor but struggles with new technology adoption.",
  "Team lead material. Ready for next level responsibilities.",
  "Performance inconsistent. Some weeks excellent, others below par.",
  "Lacks executive presence in client-facing situations.",
];

async function generateSampleExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sample Generator";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Performance Reviews");

  worksheet.columns = [
    { header: "EmployeeId", key: "employeeId", width: 15 },
    { header: "Goal Employee Rating", key: "goalEmployeeRating", width: 25 },
    { header: "Goal Manager Rating", key: "goalManagerRating", width: 25 },
    { header: "Values Employee Rating", key: "valuesEmployeeRating", width: 25 },
    { header: "Values Manager Rating", key: "valuesManagerRating", width: 25 },
    { header: "Overall Rating - Employee", key: "overallRatingEmployee", width: 25 },
    { header: "Overall Rating - Manager", key: "overallRatingManager", width: 25 },
    { header: "Manager Comments", key: "managerComments", width: 80 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (let i = 1; i <= 25; i++) {
    const employeeId = `E${String(i).padStart(3, "0")}`;
    
    const empRatingIndex = Math.floor(Math.random() * 3);
    const mgrRatingVariance = Math.random() < 0.2 ? 2 : Math.random() < 0.4 ? 1 : 0;
    const mgrRatingIndex = Math.max(0, Math.min(2, empRatingIndex + (Math.random() < 0.5 ? mgrRatingVariance : -mgrRatingVariance)));

    worksheet.addRow({
      employeeId,
      goalEmployeeRating: ratingOptions[empRatingIndex],
      goalManagerRating: ratingOptions[Math.floor(Math.random() * 3)],
      valuesEmployeeRating: ratingOptions[Math.floor(Math.random() * 3)],
      valuesManagerRating: ratingOptions[Math.floor(Math.random() * 3)],
      overallRatingEmployee: ratingOptions[empRatingIndex],
      overallRatingManager: ratingOptions[mgrRatingIndex],
      managerComments: managerCommentsPool[i % managerCommentsPool.length],
    });
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const outputPath = path.join(tmpDir, "sample-performance-reviews.xlsx");
  await workbook.xlsx.writeFile(outputPath);
  
  console.log(`Sample Excel file generated: ${outputPath}`);
  console.log("Contains 25 employee records with varied ratings and comments.");
}

generateSampleExcel().catch(console.error);
