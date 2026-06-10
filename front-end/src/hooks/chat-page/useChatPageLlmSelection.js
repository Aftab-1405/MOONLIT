import { useEffect, useState, useCallback, useMemo } from 'react';
import { getLlmOptions } from '@/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import logger from '@/utils/logger';

export function useChatPageLlmSelection({ settings, updateSettings }) {
  const [llmOptions, setLlmOptions] = useState(() =>
    queryClient.getQueryData(queryKeys.llmOptions) || {
      providers: [],
      default_provider: null,
      default_model: null,
    }
  );
  const [llmOptionsLoading, setLlmOptionsLoading] = useState(() =>
    !queryClient.getQueryData(queryKeys.llmOptions)
  );

  const providerOptions = useMemo(() => llmOptions.providers ?? [], [llmOptions.providers]);
  const selectedProvider = useMemo(() => {
    if (!providerOptions.length) return '';
    if (settings.llmProvider && providerOptions.some((provider) => provider.name === settings.llmProvider)) {
      return settings.llmProvider;
    }
    return llmOptions.default_provider || providerOptions[0].name;
  }, [providerOptions, settings.llmProvider, llmOptions.default_provider]);
  const selectedProviderOption = useMemo(() => {
    return providerOptions.find((provider) => provider.name === selectedProvider) || null;
  }, [providerOptions, selectedProvider]);
  const modelOptions = useMemo(() => selectedProviderOption?.models || [], [selectedProviderOption]);
  const selectedModel = useMemo(() => {
    if (!modelOptions.length) return '';
    if (settings.llmModel && modelOptions.includes(settings.llmModel)) {
      return settings.llmModel;
    }
    return selectedProviderOption?.default_model || modelOptions[0];
  }, [modelOptions, settings.llmModel, selectedProviderOption]);

  const handleLlmSelection = useCallback((providerName, modelName) => {
    const providerOption = providerOptions.find((provider) => provider.name === providerName);
    if (!providerOption) return;

    const nextModel = providerOption.models?.includes(modelName)
      ? modelName
      : (providerOption.default_model || providerOption.models?.[0] || null);

    updateSettings({ llmProvider: providerName, llmModel: nextModel });
  }, [providerOptions, updateSettings]);

  useEffect(() => {
    let cancelled = false;

    queryClient.fetchQuery({
      queryKey: queryKeys.llmOptions,
      queryFn: ({ signal }) => getLlmOptions(signal),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    })
      .then((response) => {
        if (!cancelled && response?.status === 'success') {
          setLlmOptions(response);
        }
      })
      .catch((error) => {
        logger.warn('Failed to fetch LLM options:', error);
      })
      .finally(() => {
        if (!cancelled) setLlmOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (llmOptions.status !== 'success' || !providerOptions.length) return;

    const validProvider = settings.llmProvider && providerOptions.some((provider) => provider.name === settings.llmProvider)
      ? settings.llmProvider
      : (llmOptions.default_provider || providerOptions[0].name);

    const providerConfig = providerOptions.find((provider) => provider.name === validProvider) || providerOptions[0];
    const candidateModels = providerConfig?.models || [];
    const validModel = settings.llmModel && candidateModels.includes(settings.llmModel)
      ? settings.llmModel
      : (providerConfig?.default_model || candidateModels[0] || null);

    const patch = {};
    if (validProvider !== settings.llmProvider) patch.llmProvider = validProvider;
    if (validModel !== settings.llmModel) patch.llmModel = validModel;
    if (Object.keys(patch).length > 0) updateSettings(patch);
  }, [
    llmOptions.default_provider,
    llmOptions.status,
    providerOptions,
    settings.llmModel,
    settings.llmProvider,
    updateSettings,
  ]);

  return {
    providerOptions,
    selectedProvider,
    selectedModel,
    llmOptionsLoading,
    handleLlmSelection,
  };
}
