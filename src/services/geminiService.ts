import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface HiddenGem {
  name: string;
  rating: number;
  user_ratings_total: number;
  address: string;
  maps_uri: string;
  description: string;
}

export async function findHiddenGems(
  lat: number, 
  lng: number, 
  minKm: number = 0, 
  maxKm: number = 5, 
  category: string = "all",
  minRating: number = 4.5,
  maxReviews: number = 200,
  vibe: string = ""
): Promise<{ text: string; groundingMetadata: any }> {
  const categoryPrompt = category === "all" 
    ? "unique local spots" 
    : category;

  const vibePrompt = vibe ? `The user is looking for a "${vibe}" vibe. ` : "";

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find 5 hidden gems (${categoryPrompt}) near ${lat}, ${lng}.
    Range: ${minKm}km to ${maxKm}km.
    Criteria: Rating >= ${minRating}, Total Reviews <= ${maxReviews}.
    ${vibePrompt}
    Focus on places that are truly "hidden"—not mainstream chains.
    
    For each place, provide:
    1. Name & Category
    2. Rating & Review Count
    3. "The Secret": Why is this a hidden gem? (Focus on the ${vibe || 'unique'} aspect)
    4. Address & Distance
    5. Google Maps Link
    
    End your response with exactly this format:
    COORDINATES: [{"name": "...", "lat": 0, "lng": 0}, ...]`,
    config: {
      tools: [{ googleMaps: {} }, { googleSearch: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      },
    },
  });

  return {
    text: response.text || "No hidden gems found nearby.",
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
}

export function extractGroundingLinks(response: any) {
  return response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
}
