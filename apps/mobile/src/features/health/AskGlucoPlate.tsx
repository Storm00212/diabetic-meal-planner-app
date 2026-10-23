import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { api } from '@/lib/api-client';
import { Icons } from '@/shared/components/Icons';

type Message = { role: 'user' | 'assistant'; text: string; fallback?: boolean };

const SUGGESTED_QUESTIONS = [
  'How do I set my daily budget?',
  'What is glycemic index?',
  'How do I add a dish to my bucket?',
  'What does premium unlock?',
  'How do I log my weight?',
  'Can I swap a dish in my plan?',
];

export function AskGlucoPlate() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setError(null);

    const userMsg: Message = { role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await api.llm.ask({ question });
      const assistantMsg: Message = {
        role: 'assistant',
        text: data.answer,
        fallback: data.fallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.disclaimer) setShowDisclaimer(true);
    } catch {
      setError('Could not get answer. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (q: string) => {
    setInput(q);
    handleSubmit();
  };

  return (
    <SafeAreaView className="flex-1 bg-white rounded-2xl border border-slate-200 p-4">
      <View className="flex-row items-center gap-2 mb-4">
        <Icons.ai size={26} strokeWidth={2} />
        <Text className="text-lg font-semibold text-slate-900">Ask GlucoPlate</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 space-y-3"
        style={{ maxHeight: 320 }}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {messages.length === 0 && (
          <View className="items-center justify-center py-8">
            <Text className="font-medium text-slate-500 text-center px-4">
              Ask about the app, Kenyan diet, or diabetes meal planning.
            </Text>
            <Text className="text-xs text-slate-400 text-center px-4 mt-1">
              I cannot answer medication, insulin, or diagnosis questions.
            </Text>
          </View>
        )}
        {messages.map((msg, idx) => (
          <View
            key={idx}
            className={`flex ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <View
              className={`max-w-[80%] rounded-2xl p-3 ${
                msg.role === 'user'
                  ? 'bg-teal-600 rounded-br-none'
                  : 'bg-slate-100 rounded-bl-none'
              }`}
            >
              <Text className={`text-sm ${msg.role === 'user' ? 'text-white' : 'text-slate-900'}`}>
                {msg.text}
              </Text>
              {msg.fallback && msg.role === 'assistant' && (
                <Text className="mt-1 text-[10px] opacity-70">
                  Cached response
                </Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {showDisclaimer && (
        <View className="mt-3 p-2 rounded bg-amber-50 border border-amber-200">
          <Text className="text-xs text-amber-800">
            Disclaimer: I am an AI, not a doctor. Please consult your healthcare provider before making dietary changes.
          </Text>
        </View>
      )}

      {error && (
        <View className="mt-3 p-2 rounded bg-rose-50 border border-rose-200">
          <Text className="text-sm text-rose-700">{error}</Text>
        </View>
      )}

      <View className="mt-4 space-y-2">
        <View className="flex-row gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about budget, carbs, GI, weight, planning..."
            editable={!loading}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            style={{ backgroundColor: loading ? '#f5f5f5' : 'white' }}
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-teal-600 px-4 py-2"
            style={{ opacity: loading || !input.trim() ? 0.6 : 1 }}
          >
            <Text className="text-sm font-semibold text-white">{loading ? '...' : 'Ask'}</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap gap-1">
          {SUGGESTED_QUESTIONS.map((q) => (
            <TouchableOpacity
              key={q}
              onPress={() => handleSuggestion(q)}
              disabled={loading}
              className="rounded-full border border-slate-200 px-2 py-1"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              <Text className="text-xs text-slate-600">{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}