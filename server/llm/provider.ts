import { type AnalysisResult, analysisResultSchema, type EmployeeData } from "@shared/schema";

export interface ILLMProvider {
  analyze(employee: EmployeeData): Promise<AnalysisResult>;
}

export class MockLLMProvider implements ILLMProvider {
  async analyze(employee: EmployeeData): Promise<AnalysisResult> {
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    
    const flags: string[] = [];
    let recommendation: "GREEN" | "RED" = "GREEN";
    
    const ratingMap: Record<string, number> = {
      "does not meet expectations": 1,
      "does not meet": 1,
      "below expectations": 1,
      "below": 1,
      "needs improvement": 1,
      "meets expectations": 2,
      "meets": 2,
      "meeting expectations": 2,
      "meeting": 2,
      "satisfactory": 2,
      "exceeds expectations": 3,
      "exceeds": 3,
      "exceeding expectations": 3,
      "exceeding": 3,
      "outstanding": 3,
      "exceptional": 3,
    };

    const normalizeRating = (rating: string | undefined): number | null => {
      if (!rating) return null;
      const normalized = rating.toLowerCase().trim();
      if (ratingMap[normalized] !== undefined) {
        return ratingMap[normalized];
      }
      flags.push("UnknownRatingLabel");
      return null;
    };

    const overallEmp = normalizeRating(employee.overallRatingEmployee);
    const overallMgr = normalizeRating(employee.overallRatingManager);
    const goalEmp = normalizeRating(employee.goalEmployeeRating);
    const goalMgr = normalizeRating(employee.goalManagerRating);
    const valuesEmp = normalizeRating(employee.valuesEmployeeRating);
    const valuesMgr = normalizeRating(employee.valuesManagerRating);

    if (overallEmp !== null && overallMgr !== null && Math.abs(overallEmp - overallMgr) >= 2) {
      flags.push("RatingMismatch_Overall_2+Levels");
      recommendation = "RED";
    }
    if (goalEmp !== null && goalMgr !== null && Math.abs(goalEmp - goalMgr) >= 2) {
      flags.push("RatingMismatch_Goals_2+Levels");
      recommendation = "RED";
    }
    if (valuesEmp !== null && valuesMgr !== null && Math.abs(valuesEmp - valuesMgr) >= 2) {
      flags.push("RatingMismatch_Values_2+Levels");
      recommendation = "RED";
    }

    const comments = (employee.managerComments || "").toLowerCase();
    
    if (!employee.managerComments || employee.managerComments.trim().length < 20) {
      flags.push("NarrativeInsufficient");
      recommendation = "RED";
    }

    const loadedTerms = [
      "abrasive", "emotional", "not a culture fit", "too aggressive",
      "lacks executive presence", "difficult", "temperamental"
    ];
    const hasLoadedLanguage = loadedTerms.some(term => comments.includes(term));
    const hasConcreteEvidence = comments.includes("example") || comments.includes("instance") || 
                                 comments.includes("specifically") || comments.includes("on [date]") ||
                                 /\d{1,2}\/\d{1,2}|\d{4}/.test(comments);
    
    if (hasLoadedLanguage && !hasConcreteEvidence) {
      flags.push("LoadedLanguage_NoEvidence");
      recommendation = "RED";
    }

    const policySensitiveTerms = [
      "medical", "disability", "pregnant", "pregnancy", "religion", "religious",
      "race", "racial", "age", "gender", "gender identity", "harassment",
      "discrimination", "retaliation", "ada", "fmla", "eeoc"
    ];
    const hasPolicySensitive = policySensitiveTerms.some(term => comments.includes(term));
    
    if (hasPolicySensitive) {
      flags.push("PolicySensitive_EscalateHR");
      recommendation = "RED";
    }

    let ratingConsistency: "Consistent" | "Inconsistent" = "Consistent";
    let ratingConsistencyRationale = "All ratings appear consistent within expected variance.";
    
    const ratings = [overallEmp, overallMgr, goalEmp, goalMgr, valuesEmp, valuesMgr].filter((r): r is number => r !== null);
    if (ratings.length >= 2) {
      const hasLargeDiff = ratings.some((r1, i) => 
        ratings.slice(i + 1).some(r2 => Math.abs(r1 - r2) >= 2)
      );
      if (hasLargeDiff) {
        ratingConsistency = "Inconsistent";
        ratingConsistencyRationale = "Significant variance detected between employee and manager ratings.";
      }
    }

    let valuesAlignment: "Aligned" | "Partially aligned" | "Misaligned" = "Aligned";
    if (valuesEmp !== null && valuesMgr !== null) {
      const diff = Math.abs(valuesEmp - valuesMgr);
      if (diff >= 2) {
        valuesAlignment = "Misaligned";
      } else if (diff === 1) {
        valuesAlignment = "Partially aligned";
      }
    }

    let biasAssessment = "No significant bias indicators detected in the review narrative.";
    if (hasLoadedLanguage) {
      biasAssessment = "Potential bias indicators present: subjective language used without supporting evidence.";
    }
    if (hasPolicySensitive) {
      biasAssessment = "Policy-sensitive content detected - requires HR review for compliance.";
    }

    const result: AnalysisResult = {
      employeeId: employee.employeeId,
      biasAssessment,
      valuesAlignment,
      ratingConsistency,
      ratingConsistencyRationale,
      aiRecommendation: recommendation,
      flagsTriggered: Array.from(new Set(flags)),
    };

    return analysisResultSchema.parse(result);
  }
}

export function createLLMProvider(): ILLMProvider {
  const provider = process.env.LLM_PROVIDER || "mock";
  
  if (provider === "mock") {
    return new MockLLMProvider();
  }
  
  return new MockLLMProvider();
}
