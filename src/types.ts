export interface Suggestion {
  id: string;
  name: string;
  prompt: string;
  comment: string;
}

export interface HairstyleResult {
  faceShape: string;
  analysisReport: string;
  suggestions: Suggestion[];
}
