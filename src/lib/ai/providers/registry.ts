import { AI_CONFIG } from "../config";
import { openai } from "./openai";
import { anthropic } from "./anthropic";

export function getEmbeddingModel() {
  return openai.embedding(AI_CONFIG.models.embedding);
}

export function getEnrichmentModel() {
  return anthropic(AI_CONFIG.models.enrichment);
}

export function getSignalSynthesisModel() {
  return anthropic(AI_CONFIG.models.signalSynthesis);
}

export function getReflectionModel() {
  return anthropic(AI_CONFIG.models.reflectionPrompts);
}

export function getAttentionModel() {
  return anthropic(AI_CONFIG.models.attentionAnalysis);
}

export function getMediaDescriptionModel() {
  return anthropic(AI_CONFIG.models.mediaDescription);
}

export function getR1AskModel() {
  return anthropic(AI_CONFIG.models.r1Ask);
}
