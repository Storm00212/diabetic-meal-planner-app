import { db } from "@/db";
import { dishes, type NewDish } from "@/db/schema";

type SeedDish = Omit<NewDish, "userId">;

// Realistic, diabetes-friendly dishes with cost, macros and glycemic index.
export const DEMO_DISHES: SeedDish[] = [
  {
    name: "Steel-Cut Oatmeal with Berries",
    description: "Slow-release oats topped with blueberries and cinnamon.",
    mealTime: "morning",
    cost: 2.2,
    calories: 290,
    carbsG: 42,
    proteinG: 9,
    glycemicIndex: 42,
  },
  {
    name: "Veggie Egg-White Omelette",
    description: "Egg whites with spinach, tomato and bell peppers.",
    mealTime: "morning",
    cost: 2.8,
    calories: 220,
    carbsG: 8,
    proteinG: 22,
    glycemicIndex: 20,
  },
  {
    name: "Greek Yogurt & Walnut Bowl",
    description: "Unsweetened Greek yogurt with walnuts and chia seeds.",
    mealTime: "morning",
    cost: 2.5,
    calories: 240,
    carbsG: 14,
    proteinG: 18,
    glycemicIndex: 30,
  },
  {
    name: "Grilled Chicken & Quinoa Salad",
    description: "Lean grilled chicken over quinoa with mixed greens.",
    mealTime: "afternoon",
    cost: 4.5,
    calories: 430,
    carbsG: 38,
    proteinG: 35,
    glycemicIndex: 45,
  },
  {
    name: "Lentil & Vegetable Soup",
    description: "Hearty lentil soup with carrots, celery and kale.",
    mealTime: "afternoon",
    cost: 2.9,
    calories: 310,
    carbsG: 40,
    proteinG: 18,
    glycemicIndex: 32,
  },
  {
    name: "Tuna Salad Lettuce Wraps",
    description: "Tuna with olive oil and herbs in crisp lettuce cups.",
    mealTime: "afternoon",
    cost: 3.6,
    calories: 280,
    carbsG: 6,
    proteinG: 30,
    glycemicIndex: 15,
  },
  {
    name: "Baked Salmon with Asparagus",
    description: "Omega-3 rich salmon fillet with roasted asparagus.",
    mealTime: "evening",
    cost: 5.5,
    calories: 400,
    carbsG: 10,
    proteinG: 34,
    glycemicIndex: 18,
  },
  {
    name: "Turkey & Bean Chili",
    description: "Lean ground turkey with kidney beans and tomato.",
    mealTime: "evening",
    cost: 3.8,
    calories: 360,
    carbsG: 34,
    proteinG: 28,
    glycemicIndex: 40,
  },
  {
    name: "Tofu Stir-Fry with Broccoli",
    description: "Firm tofu and broccoli in a light ginger-soy glaze.",
    mealTime: "evening",
    cost: 3.4,
    calories: 320,
    carbsG: 22,
    proteinG: 20,
    glycemicIndex: 35,
  },
  {
    name: "Almonds & Apple Slices",
    description: "A handful of raw almonds with fresh apple.",
    mealTime: "any",
    cost: 1.5,
    calories: 180,
    carbsG: 20,
    proteinG: 6,
    glycemicIndex: 38,
  },
  {
    name: "Chickpea Hummus with Cucumber",
    description: "Homemade hummus with crunchy cucumber sticks.",
    mealTime: "any",
    cost: 1.8,
    calories: 200,
    carbsG: 18,
    proteinG: 8,
    glycemicIndex: 28,
  },
  {
    name: "Cottage Cheese with Flaxseed",
    description: "Low-fat cottage cheese sprinkled with ground flax.",
    mealTime: "any",
    cost: 2.0,
    calories: 190,
    carbsG: 9,
    proteinG: 24,
    glycemicIndex: 25,
  },
];

export async function seedDishesForUser(userId: number) {
  await db
    .insert(dishes)
    .values(DEMO_DISHES.map((d) => ({ ...d, userId })));
}
