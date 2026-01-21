import { supabase } from './supabase';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenAiProxyOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export const callOpenAiProxy = async (messages: ChatMessage[], options: OpenAiProxyOptions = {}) => {
  const { data, error } = await supabase.functions.invoke('openai-proxy', {
    body: {
      messages,
      ...options
    }
  });

  if (error) {
    console.error('❌ openai-proxy 호출 실패:', error);
    throw error;
  }

  return data;
};
