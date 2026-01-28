import { GoogleGenAI, GenerateContentResponse, Type, Modality } from "@google/genai";
import type { AIMessage } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export const generateImageWithPrompt = async (prompt: string): Promise<AIMessage> => {
    const ai = getAiClient();
    const fullPrompt = `Photorealistic, high-resolution image of a recreational vehicle (RV) based on the following description: "${prompt}". The image should be in a 16:9 aspect ratio and look like a professional photograph for a manufacturer's brochure.`;
    
    // Using gemini-3-pro-image-preview (Best quality)
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
            parts: [{ text: fullPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K', // High quality 2K resolution
          },
        },
    });

    const message: AIMessage = {
        id: `model_${Date.now()}`,
        role: 'model',
        text: `Generated image based on: "${prompt}"`,
        images: []
    };

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                message.images?.push({
                    id: `img_${Date.now()}_${message.images.length}`,
                    data: part.inlineData.data,
                    type: 'generated',
                    mimeType: part.inlineData.mimeType
                });
            } else if (part.text && !message.text) {
                 message.text = part.text;
            }
        }
    }

    if (!message.images || message.images.length === 0) {
        throw new Error("No image was generated. The model may have refused the prompt.");
    }

    return message;
}


export const generateWithNanoBanana = async (prompt: string, images: { data: string; mimeType: string }[]): Promise<AIMessage> => {
  const ai = getAiClient();
  const imageParts = images.map(img => fileToGenerativePart(img.data, img.mimeType));
  
  let fullPrompt: string;
  if (images.length > 1) {
    fullPrompt = `You are an expert image editor. The user has provided multiple images. The VERY FIRST image is the primary subject (an RV design) that needs to be edited. All subsequent images are for reference (e.g., a logo, a texture, a style example).
    Your task is to edit the FIRST image based on the user's text instruction, using the other images as reference.
    User instruction: "${prompt}"`;
  } else {
    fullPrompt = `You are an expert image editor. Edit the provided RV image based on the following user instruction: "${prompt}".`;
  }

  const contents = {
    parts: [
      ...imageParts,
      { text: fullPrompt },
    ],
  };

  // Using gemini-3-pro-image-preview for best editing capabilities
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: contents,
    config: {
        imageConfig: {
            aspectRatio: '16:9',
            imageSize: '2K' // High quality 2K resolution
        }
    },
  });

  const message: AIMessage = {
    id: `model_${Date.now()}`,
    role: 'model',
    text: '',
    images: [],
  };

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
        message.images?.push({
            id: `img_${Date.now()}_${message.images.length}`,
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
            type: 'generated',
        });
        } else if (part.text) {
            message.text += part.text;
        }
    }
  }
  
  if (!message.text) {
      message.text = `Image updated based on your request: "${prompt}"`;
  }

  return message;
};

export const fetchSuggestedEdits = async (
  chatHistory: AIMessage[],
  image?: { data: string; mimeType: string }
): Promise<string[]> => {
  const ai = getAiClient();
  try {
    let contents;
    const recentMessages = chatHistory.slice(-5).map(m => `${m.role}: ${m.text || '[image]'}`).join('\n');

    if (image) {
      const promptText = `You are an expert RV design assistant. Your task is to provide innovative and context-aware design suggestions.
Analyze the provided image, which is the current state of an RV design.
Also, consider the recent conversation history to understand the user's goals:
--- CONVERSATION ---
${recentMessages}
--- END CONVERSATION ---
Based on BOTH the image and the conversation, generate 4 distinct, actionable, and creative next steps for this design. The suggestions should feel like they are continuing the conversation logically. Focus on specific modifications to the visible parts of the RV.
For example, if the user just isolated the front cap, suggest specific changes to the cap's logo, lighting, or materials.
Avoid generic suggestions.
Return your 4 suggestions as a JSON array of strings.`;
      contents = {
        parts: [
          { inlineData: { data: image.data, mimeType: image.mimeType } },
          { text: promptText }
        ]
      };
    } else {
      const lastUserPrompt = chatHistory.slice(-1)[0]?.text || 'a new RV';
      contents = `You are an expert RV design assistant. A user has just started a new design with the prompt: "${lastUserPrompt}".
Generate 4 distinct and creative starting suggestions for features or design directions they could explore. Think about innovative features, materials, and aesthetics.
For example: "Incorporate a slide-out stargazing panoramic roof", "Design a transformable outdoor dining area", "Integrate smart home features throughout", "Use sustainable, lightweight materials for the body".
Return your 4 suggestions as a JSON array of strings.`;
    }

    // Using gemini-3-flash-preview for fast and smart text suggestions
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });
    const jsonString = response.text?.trim() || '[]';
    const suggestions = JSON.parse(jsonString);
    return Array.isArray(suggestions) ? suggestions.slice(0, 4) : [];
  } catch (error) {
    console.error("Error fetching suggested edits:", error);
    return [
        "Change the color to matte black",
        "Add larger windows",
        "Make it more luxurious inside",
        "Add a solar panel array"
    ]; // Fallback suggestions
  }
};

interface DesignMatrixCategoryData {
  name: string;
  options: string[];
}

export const generateDesignMatrixCategories = async (
  image: { data: string; mimeType: string },
  chatHistory: AIMessage[],
): Promise<DesignMatrixCategoryData[]> => {
  const ai = getAiClient();
  try {
    const recentMessages = chatHistory.slice(-5).map(m => `${m.role}: ${m.text || '[image]'}`).join('\n');
    const promptText = `You are an expert RV design consultant. Your task is to analyze an image of an RV (which could be an interior or exterior view) and generate a design matrix for modification.
Based on the provided image and the recent conversation history, identify 5 distinct and relevant design categories for the visible parts of the RV.
For each of the 5 categories, provide 5 creative and actionable design options.
--- CONVERSATION ---
${recentMessages}
--- END CONVERSATION ---
Return the result as a JSON array of objects. Each object must have a "name" key (the category title as a string) and an "options" key (an array of 5 strings).`;

    const contents = {
      parts: [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: promptText }
      ]
    };

    // Using gemini-3-flash-preview
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  },
                  required: ['name', 'options']
                }
            }
        },
    });
    const jsonString = response.text?.trim() || '[]';
    const matrixData = JSON.parse(jsonString);
    if (Array.isArray(matrixData) && matrixData.length > 0) {
      return matrixData.slice(0, 5);
    }
    return [];
  } catch (error) {
    console.error(`Error fetching design matrix categories:`, error);
    return [];
  }
};

export const generateOptionsForCategory = async (
  image: { data: string; mimeType: string },
  chatHistory: AIMessage[],
  categoryName: string
): Promise<string[]> => {
  const ai = getAiClient();
  try {
    const recentMessages = chatHistory.slice(-5).map(m => `${m.role}: ${m.text || '[image]'}`).join('\n');
    const promptText = `You are an expert RV design consultant.
Analyze the provided image of an RV and the recent conversation history.
The user wants design options for the following specific category: "${categoryName}".
Generate 5 creative and actionable design options for this category.
--- CONVERSATION ---
${recentMessages}
--- END CONVERSATION ---
Return the result as a JSON array of 5 strings.`;

    const contents = {
      parts: [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: promptText }
      ]
    };

    // Using gemini-3-flash-preview
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
    });
    const jsonString = response.text?.trim() || '[]';
    const options = JSON.parse(jsonString);
    return Array.isArray(options) ? options.slice(0, 5) : [];
  } catch (error) {
    console.error(`Error fetching options for category "${categoryName}":`, error);
    return [];
  }
};