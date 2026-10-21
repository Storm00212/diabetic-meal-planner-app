import type { Prisma } from "../../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

/** The row type Prisma returns for a user. */
export type UserRow = Prisma.UserGetPayload<Record<string, never>>;

/** The fields a user update may set. */
export type UserUpdate = Prisma.UserUpdateInput;

export const authRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: number): Promise<UserRow | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    setting: string;
    diabetesLevel: string;
    dailyCarbTarget: number;
    dailyGiLimit: number;
    dailyCalorieLimit: number;
    needsClinicianReview: boolean;
  }): Promise<UserRow> {
    return prisma.user.create({ data });
  },

  async update(
    id: number,
    data: Prisma.UserUpdateInput,
  ): Promise<UserRow> {
    return prisma.user.update({ where: { id }, data });
  },

  async touchLogin(id: number): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },

  async countUsers(): Promise<number> {
    return prisma.user.count();
  },
};
