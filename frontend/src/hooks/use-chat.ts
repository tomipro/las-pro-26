import { useState } from "react";

import { fetchChatAnswer } from "../services/api-service";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type UseChatOptions = {
  getAnalysisId: () => string | null;
  isAiEnabled: () => boolean;
  onStatus: (message: string) => void;
};

export function useChat(options: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);

  function resetForAnalysis() {
    if (options.getAnalysisId()) {
      setMessages([
        {
          role: "system",
          content:
            "Analysis context ready. Ask about ranking, risk, facies similarity, sequence picks, or recommended follow-up checks.",
        },
      ]);
      return;
    }
    setMessages([]);
  }

  async function sendMessageWithText(rawQuestion?: string) {
    const analysisId = options.getAnalysisId();
    if (!analysisId || isPending) return;
    const question = (rawQuestion ?? input).trim();
    if (!question) return;

    const previous = [...messages];
    setMessages((old) => [...old, { role: "user", content: question }]);
    if (rawQuestion === undefined) {
      setInput("");
    }
    setIsPending(true);

    try {
      const response = await fetchChatAnswer(
        analysisId,
        question,
        previous.map((m) => ({ role: m.role, content: m.content })),
        options.isAiEnabled()
      );
      setMessages((old) => [...old, { role: "assistant", content: response.answer || "No response." }]);
      options.onStatus("Chat response generated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chat error";
      setMessages((old) => [...old, { role: "assistant", content: `Error: ${msg}` }]);
      options.onStatus(`Error: ${msg}`);
    } finally {
      setIsPending(false);
    }
  }

  return {
    messages,
    input,
    setInput,
    isPending,
    resetForAnalysis,
    sendMessage: () => sendMessageWithText(),
    sendMessageWithText,
    clear: () => setMessages([]),
  };
}
