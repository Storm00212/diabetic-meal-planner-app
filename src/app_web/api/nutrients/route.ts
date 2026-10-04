import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.toLowerCase() || "";

    // For the pilot test, we simulate a Nutrient API (like Nutritionix or Edamam)
    // In a production environment, this would be a fetch call to a real API
    const mockNutrients: Record<string, any> = {
      "chicken": { calories: 239, carbsG: 0, proteinG: 27, glycemicIndex: 45 },
      "salad": { calories: 150, carbsG: 12, proteinG: 5, glycemicIndex: 15 },
      "apple": { calories: 52, carbsG: 14, proteinG: 0, glycemicIndex: 38 },
      "brown rice": { calories: 111, carbsG: 23, proteinG: 3, glycemicIndex: 50 },
      "egg": { calories: 78, carbsG: 0.6, proteinG: 6, glycemicIndex: 0 },
      "fish": { calories: 208, carbsG: 0, proteinG: 20, glycemicIndex: 0 },
    };

    const match = Object.entries(mockNutrients).find(([k]) => query.includes(k));
    const data = match
      ? match[1]
      : { calories: 150, carbsG: 15, proteinG: 10, glycemicIndex: 50 };

    return Response.json(data);
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Failed to fetch nutrients" }, { status: 500 });
  }
}
