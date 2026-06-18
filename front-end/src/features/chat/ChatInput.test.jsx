import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';

import ChatInput from './ChatInput';
import { createLightTheme } from '@/theme';

vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabaseConnection: () => ({
    availableSchemas: [],
    currentSchema: null,
    selectSchema: vi.fn(),
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    settings: {},
    updateSetting: vi.fn(),
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    isDarkMode: false,
  }),
}));

describe('ChatInput context tooltip', () => {
  it('shows active context consumption separately from the full model window', async () => {
    const user = userEvent.setup();
    const theme = createLightTheme();

    render(
      <ThemeProvider theme={theme}>
        <ChatInput
          onSend={vi.fn()}
          selectedProvider="bedrock"
          selectedModel="moonshotai.kimi-k2.5"
          providerOptions={[
            {
              name: 'bedrock',
              label: 'Bedrock',
              models: ['moonshotai.kimi-k2.5'],
            },
          ]}
          usageMetrics={{
            inputTokens: 12000,
            outputTokens: 3600,
            totalTokens: 15600,
            inputPayloadTokens: 151000,
            activeContextBudget: 201315,
            pressureTriggerTokens: 227611,
            totalContextWindow: 262144,
            modelContextWindow: 262144,
            systemPromptTokens: 1623,
            toolSchemaTokens: 5200,
            tokenCountingMode: 'estimated',
          }}
        />
      </ThemeProvider>,
    );

    await user.hover(screen.getByRole('button', { name: /select model/i }));

    expect(await screen.findByText('Provider: Bedrock')).toBeInTheDocument();
    expect(screen.getByText('Token usage: conservative estimate')).toBeInTheDocument();
    expect(
      screen.getByText('Active context: 151,000 / 227,611 (66%)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Model window: 151,000 / 262,144 (58%)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Static: SI 1,623 · tools 5,200'),
    ).toBeInTheDocument();
  });

  it('labels pre-summary pressure separately from final model usage', async () => {
    const user = userEvent.setup();
    const theme = createLightTheme();

    render(
      <ThemeProvider theme={theme}>
        <ChatInput
          onSend={vi.fn()}
          selectedProvider="bedrock"
          selectedModel="openai.gpt-oss-120b-1:0"
          providerOptions={[
            {
              name: 'bedrock',
              label: 'Bedrock',
              models: ['openai.gpt-oss-120b-1:0'],
            },
          ]}
          usageMetrics={{
            inputPayloadTokens: 9200,
            pressureTriggerTokens: 9643,
            modelContextWindow: 30000,
            systemPromptTokens: 8352,
            toolSchemaTokens: 2837,
            tokenCountingMode: 'estimated',
            contextPhase: 'pre_summary',
            summaryThresholdTokens: 8678,
          }}
        />
      </ThemeProvider>,
    );

    await user.hover(screen.getByRole('button', { name: /select model/i }));

    expect(await screen.findByText('Context pressure: summarizing unsummarized tail')).toBeInTheDocument();
    expect(screen.getByText('Summary pressure: 9,200 / 9,643 (95%)')).toBeInTheDocument();
    expect(screen.getByText('Summary trigger: 8,678 tokens')).toBeInTheDocument();
  });
});
