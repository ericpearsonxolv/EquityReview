import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronRight, Shield, AlertTriangle, FileCheck, Scale, Lock, Eye } from "lucide-react";

const escalationFlags = [
  {
    id: "rating-mismatch",
    name: "Rating Mismatch (2+ Levels)",
    description: "Triggered when employee and manager ratings differ by 2 or more levels on goals, values, or overall performance.",
    severity: "high",
    action: "Review should be escalated to HR Business Partner for calibration discussion.",
  },
  {
    id: "narrative-insufficient",
    name: "Insufficient Narrative",
    description: "Manager comments contain fewer than 20 characters of substantive feedback.",
    severity: "medium",
    action: "Manager should be prompted to provide more detailed written feedback.",
  },
  {
    id: "loaded-language",
    name: "Loaded Language Without Evidence",
    description: "Comments contain potentially biased language (e.g., 'emotional', 'aggressive', 'not a culture fit') without specific examples.",
    severity: "high",
    action: "Escalate to HR for bias review before finalizing the review.",
  },
  {
    id: "policy-sensitive",
    name: "Policy-Sensitive Content",
    description: "Comments reference protected characteristics or sensitive topics (medical, disability, pregnancy, religion, etc.).",
    severity: "critical",
    action: "Immediate escalation to HR Legal for review before any further processing.",
  },
];

const auditPolicies = [
  {
    title: "Data Retention",
    description: "Analysis results are retained for 3 years in accordance with employment records requirements.",
    icon: FileCheck,
  },
  {
    title: "Access Control",
    description: "Only authorized HR personnel with appropriate role-based permissions can access analysis data.",
    icon: Lock,
  },
  {
    title: "Audit Trail",
    description: "All analysis actions are logged with timestamps, user IDs, and action types for compliance auditing.",
    icon: Eye,
  },
  {
    title: "Bias Prevention",
    description: "AI analysis includes built-in checks for potential bias indicators and discriminatory language patterns.",
    icon: Scale,
  },
];

function SeverityBadge({ severity }: { severity: string }) {
  const variants = {
    critical: "bg-red-600 hover:bg-red-700 text-white",
    high: "bg-orange-500 hover:bg-orange-600 text-white",
    medium: "bg-yellow-500 hover:bg-yellow-600 text-white",
    low: "bg-blue-500 hover:bg-blue-600 text-white",
  };

  return (
    <Badge className={variants[severity as keyof typeof variants] || variants.medium}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

export default function Compliance() {
  return (
    <div className="p-6 space-y-6" data-testid="page-compliance">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Compliance</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Compliance & Policies
        </h1>
        <p className="text-muted-foreground mt-1">
          Review escalation rules, audit policies, and compliance requirements for performance review analysis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Escalation Flags
            </CardTitle>
            <CardDescription>
              Conditions that trigger automatic escalation for human review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {escalationFlags.map((flag) => (
                <AccordionItem key={flag.id} value={flag.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{flag.name}</span>
                      <SeverityBadge severity={flag.severity} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <p className="text-sm text-muted-foreground">{flag.description}</p>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="text-sm font-medium">Required Action:</p>
                        <p className="text-sm text-muted-foreground">{flag.action}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Audit & Security Policies
            </CardTitle>
            <CardDescription>
              Data governance and security measures for compliance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {auditPolicies.map((policy, index) => (
                <div key={index} className="flex gap-4 p-3 rounded-md bg-muted/30">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <policy.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{policy.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-green-600" />
            Compliance Checklist
          </CardTitle>
          <CardDescription>
            Ensure all requirements are met before finalizing performance reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "All escalated reviews addressed",
              "Manager narratives reviewed for bias",
              "Rating calibration completed",
              "HR sign-off obtained",
              "Employee acknowledgment received",
              "Documentation archived",
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-3 rounded-md border">
                <div className="h-5 w-5 rounded border-2 border-muted-foreground/30" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
