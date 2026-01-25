import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import apiClient from '../api/n8n';
import type { ChatMessage } from '../types/api';

interface ChatProps {
  chatId: number | null;
}

export const Chat = ({ chatId }: ChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Привет! Я AI-риелтор Жилфонда Астрахань. Задайте мне любой вопрос о недвижимости, ЖК, ипотеке или финансовых инструментах.',
      timestamp: new Date(),
      suggestions: ['Покажи ЖК в центре', 'Какие ипотечные программы?', 'Скидки на квартиры'],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { hapticFeedback } = useTelegram();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !chatId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    hapticFeedback('light');

    try {
      const response = await apiClient.sendChatMessage({
        chat_id: chatId,
        message: text,
        type: 'text',
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        suggestions: response.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      hapticFeedback('success');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      hapticFeedback('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleSuggestionClick = (suggestion: string) => {
    hapticFeedback('light');
    sendMessage(suggestion);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    hapticFeedback('medium');
    // Voice recording implementation would go here
  };

  return (
    <div className="flex flex-col h-full pb-16">
      {/* Header */}
      <div className="bg-tg-bg border-b border-tg-hint/20 p-4">
        <h1 className="text-lg font-semibold text-tg-text">AI Консультант</h1>
        <p className="text-xs text-tg-hint">Задайте вопрос о недвижимости</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-tg-button text-tg-button-text rounded-br-md'
                  : 'bg-tg-secondary-bg text-tg-text rounded-bl-md'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-tg-button-text/70' : 'text-tg-hint'
              }`}>
                {message.timestamp.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-tg-secondary-bg rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {messages.length > 0 && messages[messages.length - 1].suggestions && !isLoading && (
          <div className="flex flex-wrap gap-2">
            {messages[messages.length - 1].suggestions?.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-2 bg-tg-secondary-bg text-tg-text text-sm rounded-full hover:bg-tg-hint/20 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-tg-hint/20 p-3 bg-tg-bg">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-500 text-white'
                : 'bg-tg-secondary-bg text-tg-hint'
            }`}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Введите сообщение..."
            disabled={isLoading}
            className="input-field flex-1"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-3 rounded-full bg-tg-button text-tg-button-text disabled:opacity-50 transition-opacity"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};
