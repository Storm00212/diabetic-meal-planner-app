import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { apiFetch } from '@/lib/mobile/api-client';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await apiFetch("/api/chat");
        if (Array.isArray(history)) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    }
    loadHistory();
  }, []);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: input }),
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: res.content || "I'm sorry, I couldn't process that. Please try again.",
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chat error", err);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Error connecting to GlucoPlate AI. Please check your connection.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <View className="p-4 border-b border-slate-100 bg-slate-50 flex-row items-center gap-2">
        <Text className="text-lg font-bold text-slate-900">GlucoPlate AI Assistant</Text>
        <View className="h-2 w-2 rounded-full bg-emerald-500" />
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 p-4"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View className="flex-col gap-4">
          {messages.length === 0 && (
            <Text className="text-center text-slate-400 mt-10 italic">
              Ask me anything about your meal plans or diabetic nutrition!
            </Text>
          )}
          {messages.map((msg, i) => (
            <View
              key={i}
              className={`flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <View
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? "bg-teal-600 rounded-tr-none"
                    : "bg-slate-100 rounded-tl-none"
                }`}
              >
                <Text className={`${msg.role === 'user' ? 'text-white' : 'text-slate-800'}`}>
                  {msg.content}
                </Text>
                <Text className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-teal-100' : 'text-slate-400'} text-right`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
          {loading && (
            <View className="flex-row justify-start">
              <View className="bg-slate-100 p-3 rounded-2xl rounded-tl-none">
                <ActivityIndicator size="small" color="#0d9488" />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="p-4 border-t border-slate-100 flex-row gap-2 bg-white">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask AI..."
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 bg-slate-50"
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={loading}
          className={`rounded-full p-2 ${loading ? 'bg-slate-300' : 'bg-teal-600'}`}
        >
          <Text className="text-white font-bold px-2">Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
