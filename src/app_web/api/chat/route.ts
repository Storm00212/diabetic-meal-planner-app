import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { query } = body;

    // Pilot Test: Simulating a Verified Medical AI response
    // In production, this would call Perplexity API or a similar RAG system
    const medicalKnowledge: Record<string, string> = {
      "glycemic index": "The Glycemic Index (GI) is a rating system for foods containing carbohydrates. It shows how quickly each food affects your blood glucose level. Low GI foods (55 or less) are generally preferred for diabetics.",
      "carbs": "Carbohydrates are broken down into glucose, which raises blood sugar. Managing total carb intake is key to avoiding hyperglycemic spikes.",
      "weight loss": "For diabetics, gradual weight loss is often recommended to improve insulin sensitivity. Consult your doctor for a safe target calorie deficit.",
    };

    const match = Object.entries(medicalKnowledge).find(([k]) => query?.toLowerCase().includes(k));
    const response = match
      ? `${match[1]}\n\nSource: Verified Medical Guidelines (Simulated)`
      : "I couldn't find a specific medical citation for that. Please rephrase or consult your doctor.";

    return Response.json({
      answer: response,
      disclaimer: "Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider before making dietary changes."
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to process chat request" }, { status: 500 });
  }
}
