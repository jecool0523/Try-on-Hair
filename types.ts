
export interface FaceAnalysis {
  faceShape: string;
  skinTone: string;
  currentHairTexture: string;
  hairColorEstimate: string;
  styleAdvice: string;
}

export interface HairstyleItem {
  id: string;
  name: string;
  category: string;
  description: string; // The prompt sent to Gemini
  image: string; // Placeholder or uploaded image URL
  isCustom?: boolean; // Flag to indicate if this is a user-uploaded hairstyle reference
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SHOPPING = 'SHOPPING', // Keeps the name "Shopping" for selecting items, or could be BROWSING
  GENERATING_TRYON = 'GENERATING_TRYON',
  RESULT = 'RESULT',
}
