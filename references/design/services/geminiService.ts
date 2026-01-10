
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const analyzeFinances = async (transactions: Transaction[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    다음 가계부 내역을 분석하여 3줄 내외로 조언을 해줘:
    ${JSON.stringify(transactions.map(t => ({ title: t.title, amount: t.amount, type: t.type, category: t.category })))}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "당신은 가계부 분석 전문가입니다. 사용자의 소비 패턴을 파악하여 한국어로 친절하고 전문적인 금융 조언을 제공합니다."
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};
