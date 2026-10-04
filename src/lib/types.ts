export type Dish = {
  id: number;
  userId: number;
  name: string;
  description: string;
  mealTime: string;
  cost: number;
  isPantryItem: boolean;
  calories: number;
  carbsG: number;
  proteinG: number;
  glycemicIndex: number;
  createdAt: string;
};

export type PlanItem = {
  id: number;
  planId: number;
  slot: string;
  dishId: number;
  dishName: string;
  cost: number;
  carbsG: number;
  calories: number;
  glycemicIndex: number;
  status: string;
  actualCost: number;
};

export type SavedPlan = {
  id: number;
  userId: number;
  planDate: string;
  budget: number;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  createdAt: string;
  items: PlanItem[];
};

export type PlanResult = {
  slots: Record<string, any | null>;
  totalCost: number;
  totalCarbs: number;
  totalCalories: number;
  withinBudget: boolean;
  withinCarbs: boolean;
  message: string;
};

export type DishFormValues = {
  name: string;
  description: string;
  mealTime: string;
  cost: number;
  isPantryItem: boolean;
  calories: number;
  carbsG: number;
  proteinG: number;
  glycemicIndex: number;
};
