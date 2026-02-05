import { GoogleGenAI } from "@google/genai";
import Constants from "expo-constants";

const apiKey =
    Constants.expoConfig?.extra?.geminiApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    "";

if (!apiKey) {
  console.warn("❌ Gemini API Key가 설정되지 않았습니다. 환경 변수를 확인해주세요.");
}

// @google/genai 최신 SDK 사용
const ai = new GoogleGenAI({ apiKey });

export interface OCRResult {
  amount: number;
  category: string;
  description: string;
  date: string;
  type: "expense" | "income";
}

// 공통 파싱 로직
function parseGeminiResponse(text: string): OCRResult | null {
  try {
    // 마크다운 코드 블록(```json ... ```) 제거
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanedText) as OCRResult;
  } catch (e) {
    console.error("JSON Parse Error:", e);
    // 혹시 JSON 포맷이 꼬였을 경우를 대비해 정규식으로 추출 시도
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as OCRResult;
      } catch (e2) {
        return null;
      }
    }
    return null;
  }
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
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseGeminiResponse(result.text || "");
  } catch (error) {
    console.error("Gemini OCR failed:", error);
    throw error;
  }
}

export async function parseTransactionText(
  inputText: string
): Promise<OCRResult | null> {
  const prompt = `
당신은 금융 텍스트 분석 전문가입니다. 아래의 카드 사용 문자나 금융 메시지를 분석하여 핵심 정보를 추출하고 JSON 형식으로 응답하세요.

[분석할 텍스트]:
${inputText}

[요구사항]:
1. amount: 결제 금액 (숫자만, 쉼표 제외)
2. category: 식비, 교통, 쇼핑, 주거/통신, 의료/건강, 기타 중 가장 적절한 것 선택.
3. description: 사용처 (가맹점명)
4. date: 결제 일시 (YYYY-MM-DD 형식). 연도가 없으면 2026년으로 가정.
5. type: 지출이면 'expense', 입금/취소면 'income' (취소는 income으로 처리하거나 마이너스 expense로 처리할 수 있으나 여기선 문맥에 맞게 판단, 보통 결제 문자는 'expense')

[응답 예시]:
{"amount":25000,"category":"식비","description":"BBQ치킨","date":"2026-02-03","type":"expense"}
  `.trim();

  try {
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    return parseGeminiResponse(result.text || "");
  } catch (error) {
    console.error("Gemini Text Parse failed:", error);
    throw error;
  }
}
