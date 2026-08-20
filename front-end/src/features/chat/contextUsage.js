function percentage(numerator, denominator) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

/**
 * Convert a backend usage event into the context indicator's render model.
 * Backend percentages are authoritative. Raw-token calculation exists only
 * for conversations persisted before those percentage fields were added.
 */
export function getContextUsage(usageMetrics) {
  if (!usageMetrics) return null;

  const activePercent =
    usageMetrics.activePercent ??
    percentage(
      usageMetrics.activeContextTokens ?? usageMetrics.inputPayloadTokens,
      usageMetrics.activeContextBudget ?? usageMetrics.pressureTriggerTokens,
    );
  const modelPercent =
    usageMetrics.modelPercent ??
    percentage(
      usageMetrics.inputPayloadTokens,
      usageMetrics.modelContextWindow ?? usageMetrics.totalContextWindow,
    );

  if (activePercent == null) return null;
  return {
    activePercent,
    modelPercent,
    contextPhase: usageMetrics.contextPhase,
    tokenCountingMode: usageMetrics.tokenCountingMode,
  };
}
