import { Router } from "express";
import { requireAuth } from "../../lib/http.js";
import { chatService } from "./chat.service.js";

/**
 * Chat pilot endpoints.
 *
 * - GET  /api/chat  the conversation history (the pilot keeps none)
 * - POST /api/chat  ask a question
 */
export const chatRouter = Router();

chatRouter.get("/api/chat", requireAuth, (_req, res) => {
  // The pilot keeps no server-side history.
  res.json({ messages: [] });
});

chatRouter.post("/api/chat", requireAuth, (req, res) => {
  const body = (req.body ?? {}) as { query?: unknown; message?: unknown };
  const query = body.query ?? body.message;

  res.json(chatService.answer(query));
});
