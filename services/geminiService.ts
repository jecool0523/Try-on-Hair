
import { GoogleGenAI, Type } from "@google/genai";
import { FaceAnalysis } from "../types";

// Helper to get client with current key
// We initialize this lazily to ensure we catch any runtime injections of the API key
// (e.g. via window.aistudio selection)
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Analyzes a face image to estimate shape and features.
 */
export const analyzeFaceImage = async (base64Image: string): Promise<FaceAnalysis> => {
  // Remove data URL prefix if present for processing
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: `Analyze this person's face for a hairstyle try-on application. 
                   Identify face shape, skin tone, and current hair. Be polite and professional.
                   Provide the output strictly in JSON format.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceShape: { type: Type.STRING, description: "Estimated face shape (e.g., 'Oval', 'Square', 'Heart', 'Round')" },
            skinTone: { type: Type.STRING, description: "Description of skin tone" },
            currentHairTexture: { type: Type.STRING, description: "Current hair texture (e.g., 'Straight', 'Curly', 'Wavy')" },
            hairColorEstimate: { type: Type.STRING, description: "Current hair color" },
            styleAdvice: { type: Type.STRING, description: "One sentence hairstyle advice based on face shape" },
          },
          required: ["faceShape", "skinTone", "currentHairTexture", "hairColorEstimate", "styleAdvice"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as FaceAnalysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Generates a "Hair Try-On" image.
 * Uses the image model to modify the user's hair.
 */
export const generateTryOnImage = async (
  personImageBase64: string, 
  hairstyleDescription: string,
  referenceImageBase64?: string
): Promise<string> => {
  
  const cleanPersonBase64 = personImageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");

  try {
    const parts: any[] = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanPersonBase64,
        },
      }
    ];

    // If we have a reference hairstyle image, add it to the prompt parts
    if (referenceImageBase64) {
      const cleanRefBase64 = referenceImageBase64.replace(/^data:image\/(png|jpeg|webp);base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanRefBase64,
        },
      });
      parts.push({
        text: `Using the second image (hairstyle) as a reference, apply this hairstyle to the person in the first image.
               Maintain the person's exact face features, skin texture, makeup, and clothing. 
               Only change the hair. Blend it naturally with the forehead and ears.
               Make it look photorealistic.`,
      });
    } else {
      // Standard Text-based Try On
      parts.push({
        text: `Change the person's hairstyle to: ${hairstyleDescription}. 
               Maintain the person's exact face features, expression, skin texture, and current clothing. 
               Only modify the hair.
               Make it look photorealistic. High quality salon photography.`,
      });
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", 
      contents: {
        parts: parts,
      },
    });

    // Extract image from response
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated.");

  } catch (error) {
    console.error("Try-on generation failed:", error);
    throw error;
  }
};
