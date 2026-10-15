import { LocationPreset, RiskWeights, RoadSegment } from '../types';

export interface GeminiStatusResponse {
  available: boolean;
  model: string;
  message: string;
}

export interface AuditReportResponse {
  success: boolean;
  report: string;
  timestamp: string;
  model: string;
}

export interface DefectAnalysisResponse {
  success: boolean;
  analysis: string;
  timestamp: string;
  model: string;
}

export interface CopilotResponse {
  success: boolean;
  reply: string;
  model: string;
}

export async function checkGeminiStatus(): Promise<GeminiStatusResponse> {
  try {
    const res = await fetch('/api/gemini/status');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      available: false,
      model: 'gemini-3.8-flash',
      message: err?.message || 'Server-side API check failed',
    };
  }
}

export async function generateGeminiAuditReport(
  road: RoadSegment,
  corridor: LocationPreset,
  weights?: RiskWeights
): Promise<string> {
  const res = await fetch('/api/gemini/audit-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ road, corridor, weights }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to generate audit report.');
  }

  return data.report;
}

export async function analyzeDefectWithGemini(params: {
  imageBase64?: string;
  imageUrl?: string;
  defectType?: string;
  roadName?: string;
}): Promise<string> {
  const res = await fetch('/api/gemini/analyze-defect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to analyze road defect with Gemini.');
  }

  return data.analysis;
}

export async function askRoadSenseCopilot(
  message: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  context: {
    corridorName: string;
    city: string;
    country: string;
    roadName?: string;
    riskScore?: number;
    riskLevel?: string;
  }
): Promise<string> {
  const res = await fetch('/api/gemini/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to query RoadSense Copilot.');
  }

  return data.reply;
}
