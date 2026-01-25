import { useState } from 'react';
import { User, Crown, Calendar, CreditCard, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import apiClient from '../api/n8n';
import type { UserData } from '../types/api';

interface ProfileProps {
  user: UserData | null;
  onRefreshUser: () => void;
}

const SUBSCRIPTION_PRICE = 2990;
const SUBSCRIPTION_DAYS = 30;

export const Profile = ({ user, onRefreshUser }: ProfileProps) => {
  const { user: tgUser, hapticFeedback, openLink, showConfirm } = useTelegram();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const displayName = user?.first_name || tgUser?.first_name || 'Пользователь';
  const username = user?.username || tgUser?.username;

  const handlePayment = async () => {
    if (!user?.chat_id) return;

    const confirmed = await showConfirm(
      `Оформить подписку на ${SUBSCRIPTION_DAYS} дней за ${SUBSCRIPTION_PRICE}₽?`
    );

    if (!confirmed) return;

    setIsProcessingPayment(true);
    hapticFeedback('medium');

    try {
      const response = await apiClient.createPayment(user.chat_id);
      openLink(response.payment_url);
      // Refresh user data after returning from payment
      setTimeout(() => {
        onRefreshUser();
      }, 3000);
    } catch (error) {
      console.error('Payment error:', error);
      hapticFeedback('error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!user) return { color: 'gray', text: 'Загрузка...', icon: <Loader2 className="animate-spin" size={20} /> };

    switch (user.subscription_status) {
      case 'paid':
        return {
          color: 'green',
          text: 'Активная',
          icon: <CheckCircle size={20} />,
        };
      case 'demo':
        return {
          color: 'yellow',
          text: 'Демо-режим',
          icon: <AlertCircle size={20} />,
        };
      default:
        return {
          color: 'red',
          text: 'Истекла',
          icon: <AlertCircle size={20} />,
        };
    }
  };

  const status = getSubscriptionStatus();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col h-full pb-16 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-tg-button to-tg-link p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            {username && <p className="text-white/80">@{username}</p>}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Subscription Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="text-yellow-500" size={24} />
              <h2 className="font-semibold text-tg-text">Подписка</h2>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              status.color === 'green' ? 'bg-green-100 text-green-700' :
              status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {status.icon}
              <span>{status.text}</span>
            </div>
          </div>

          {user && (
            <div className="space-y-3">
              {user.subscription_status !== 'expired' && (
                <>
                  <div className="flex items-center gap-3 p-3 bg-tg-secondary-bg rounded-lg">
                    <Calendar className="text-tg-hint" size={20} />
                    <div>
                      <p className="text-sm text-tg-hint">Действует до</p>
                      <p className="font-medium text-tg-text">{formatDate(user.end_sub)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-tg-secondary-bg rounded-lg">
                    <Crown className="text-tg-hint" size={20} />
                    <div>
                      <p className="text-sm text-tg-hint">Осталось дней</p>
                      <p className="font-medium text-tg-text">{user.days_left}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Progress bar */}
              {user.days_left > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-tg-hint mb-1">
                    <span>Прогресс подписки</span>
                    <span>{Math.round((user.days_left / SUBSCRIPTION_DAYS) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-tg-secondary-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-tg-button rounded-full transition-all"
                      style={{ width: `${(user.days_left / SUBSCRIPTION_DAYS) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Button */}
          {(!user || user.subscription_status === 'expired' || user.days_left < 7) && (
            <button
              onClick={handlePayment}
              disabled={isProcessingPayment}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              {isProcessingPayment ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <CreditCard size={20} />
                  {user?.subscription_status === 'expired'
                    ? `Оформить подписку • ${SUBSCRIPTION_PRICE}₽`
                    : `Продлить подписку • ${SUBSCRIPTION_PRICE}₽`}
                </>
              )}
            </button>
          )}
        </div>

        {/* Subscription Benefits */}
        <div className="card">
          <h3 className="font-semibold text-tg-text mb-3">Преимущества подписки</h3>
          <ul className="space-y-2">
            {[
              'Безлимитный доступ к AI-консультанту',
              'Полная база ЖК Астрахани',
              'Актуальные финансовые инструменты',
              'Информация о KV агента',
              'Приоритетная поддержка',
            ].map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-tg-text">
                <CheckCircle className="text-green-500 flex-shrink-0" size={16} />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div className="card">
          <h3 className="font-semibold text-tg-text mb-3">Поддержка</h3>
          <p className="text-sm text-tg-hint mb-3">
            Если у вас есть вопросы по подписке или работе сервиса, свяжитесь с нами.
          </p>
          <button
            onClick={() => openLink('https://t.me/jilfond_support')}
            className="w-full p-3 bg-tg-secondary-bg rounded-lg flex items-center justify-center gap-2 text-tg-button"
          >
            <ExternalLink size={18} />
            Написать в поддержку
          </button>
        </div>

        {/* User ID for debugging */}
        {user && (
          <div className="text-center text-xs text-tg-hint">
            ID: {user.chat_id}
          </div>
        )}
      </div>
    </div>
  );
};
