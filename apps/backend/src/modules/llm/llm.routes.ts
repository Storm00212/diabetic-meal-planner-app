import { Router } from "express";
import { requireAuth, callerId } from "../../lib/http.js";
import { generatePersonalisedRecommendation } from "./recommendations.service.js";
import { answerQuestion } from "./assistant.service.js";
import {
  checkAndGeneratePopups,
  getStoppedPopupTypes,
  togglePopupType,
  type PopupTrigger,
} from "./popups.service.js";

export const llmRouter = Router();

llmRouter.post("/api/llm/recommendation", requireAuth, async (req, res) => {
  try {
    const userId = callerId(req);
    const result = await generatePersonalisedRecommendation(userId);
    res.json({
      recommendation: result.text,
      fallback: result.fallback,
      facts: result.facts,
      notice: "GlucoPlate is a planning aid, not medical advice.",
    });
  } catch (error) {
    res.status(500).json({ error: "Could not generate recommendation." });
  }
});

llmRouter.post("/api/llm/ask", requireAuth, async (req, res) => {
  try {
    const userId = callerId(req);
    const question = String(req.body?.question ?? "").trim();
    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }
    const result = await answerQuestion(userId, question);
    res.json({
      answer: result.answer,
      disclaimer: result.disclaimer,
      fallback: result.fallback,
      notice: "GlucoPlate is a planning aid, not medical advice.",
    });
  } catch (error) {
    res.status(500).json({ error: "Could not answer question." });
  }
});

llmRouter.post("/api/llm/popup", requireAuth, async (req, res) => {
  try {
    const userId = callerId(req);
    const trigger = req.body as PopupTrigger;
    if (!trigger || !trigger.type) {
      res.status(400).json({ error: "Trigger type is required." });
      return;
    }
    const popup = await checkAndGeneratePopups(userId, trigger);
    if (!popup) {
      res.json({ popup: null, reason: "rate_limited_or_stopped" });
      return;
    }
    res.json({ popup });
  } catch (error) {
    res.status(500).json({ error: "Could not generate popup." });
  }
});

llmRouter.get("/api/llm/popups/stopped", requireAuth, async (req, res) => {
  try {
    const userId = callerId(req);
    const stopped = await getStoppedPopupTypes(userId);
    res.json({ stopped });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch stopped popup types." });
  }
});

llmRouter.patch("/api/llm/popups/stopped", requireAuth, async (req, res) => {
  try {
    const userId = callerId(req);
    const { type, stopped } = req.body as { type: string; stopped: boolean };
    if (!type || typeof stopped !== "boolean") {
      res.status(400).json({ error: "type and stopped are required." });
      return;
    }
    await togglePopupType(userId, type as any, stopped);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Could not update popup preference." });
  }
});