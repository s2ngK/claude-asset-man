import { GoogleGenAI } from "@google/genai";
import Constants from "expo-constants";

const apiKey =
    Constants.expoConfig?.extra?.geminiApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    "";

if (!apiKey) {
  console.warn("❌ Gemini API Key가 설정되지 않았습니다. 환경 변수를 확인해주세요.");
}

const ai = new GoogleGenAI({ apiKey });

export interface OCRResult {
  amount: number;
  category: string;
  description: string;
  date: string;
  type: "expense" | "income";
}

export async function scanReceipt(
    base64Image: string,
    mimeType: string
): Promise<OCRResult | null> {
  const prompt = `
당신은 영수증 분석 전문가입니다. 주어진 영수증 이미지에서 다음 정보를 추출하여 반드시 JSON 형식으로만 응답하세요.
항목은 다음과 같아야 합니다:
- amount (숫자, 총 금액)
- category (문자열, 식비, 교통, 쇼핑, 주거/통신, 의료/건강, 기타 중 하나로 분류)
- description (문자열, 상호명 또는 품목명)
- date (문자열, YYYY-MM-DD 형식, 영수증 날짜)
- type (항상 'expense'로 설정)

응답 예시: {"amount":15000,"category":"식비","description":"스타벅스","date":"2026-01-10","type":"expense"}
  `.trim();

  try {
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = result.text || "";
    if (!text) return null;

    // responseMimeType을 JSON으로 강제했기 때문에 보통 바로 JSON 문자열이 옵니다.
    return JSON.parse(text) as OCRResult;
  } catch (error) {
    console.error("Gemini OCR failed:", error);
    throw error;
  }
}