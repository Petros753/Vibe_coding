import { Building2, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import type { UserData } from '../types/api';

interface HomeProps {
  user: UserData | null;
  onNavigate: (tab: 'search' | 'chat' | 'tools' | 'profile') => void;
}

const quickActions = [
  {
    id: 'search',
    title: 'Найти квартиру',
    description: 'Поиск по ЖК Астрахани',
    icon: <Building2 className="text-tg-button" size={24} />,
    tab: 'search' as const,
  },
  {
    id: 'chat',
    title: 'Спросить AI',
    description: 'Консультация по недвижимости',
    icon: <TrendingUp className="text-tg-button" size={24} />,
    tab: 'chat' as const,
  },
];

export const Home = ({ user, onNavigate }: HomeProps) => {
  const { user: tgUser } = useTelegram();

  const displayName = user?.first_name || tgUser?.first_name || 'Риелтор';

  return (
    <div className="flex-1 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-tg-button to-tg-link p-6 text-white">
        <h1 className="text-xl font-bold mb-1">
          Привет, {displayName}!
        </h1>
        <p className="text-white/80 text-sm">
          AI Жилфонд Астрахань - ваш умный помощник
        </p>
      </div>

      {/* Subscription Status */}
      {user && (
        <div className="mx-4 -mt-4 relative z-10">
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                user.subscription_status === 'paid'
                  ? 'bg-green-100 text-green-600'
                  : user.subscription_status === 'demo'
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-red-100 text-red-600'
              }`}>
                <Clock size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-tg-text">
                  {user.subscription_status === 'paid' ? 'Активная подписка' :
                   user.subscription_status === 'demo' ? 'Демо-режим' : 'Подписка истекла'}
                </p>
                <p className="text-xs text-tg-hint">
                  {user.days_left > 0
                    ? `Осталось ${user.days_left} дней`
                    : 'Продлите подписку'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('profile')}
              className="text-tg-button"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-4 mt-4">
        <h2 className="text-lg font-semibold mb-3 text-tg-text">Быстрые действия</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.tab)}
              className="card text-left hover:shadow-md transition-shadow"
            >
              <div className="mb-2">{action.icon}</div>
              <h3 className="font-medium text-tg-text text-sm">{action.title}</h3>
              <p className="text-xs text-tg-hint mt-1">{action.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3 text-tg-text">Полезные функции</h2>
        <div className="space-y-3">
          <button
            onClick={() => onNavigate('tools')}
            className="card w-full flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-lg bg-tg-button/10 flex items-center justify-center">
              <TrendingUp className="text-tg-button" size={24} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium text-tg-text">Ипотечный калькулятор</h3>
              <p className="text-xs text-tg-hint">Рассчитайте платёж по ипотеке</p>
            </div>
            <ChevronRight className="text-tg-hint" size={20} />
          </button>

          <button
            onClick={() => onNavigate('search')}
            className="card w-full flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-lg bg-tg-button/10 flex items-center justify-center">
              <Building2 className="text-tg-button" size={24} />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium text-tg-text">Каталог ЖК</h3>
              <p className="text-xs text-tg-hint">Все жилые комплексы Астрахани</p>
            </div>
            <ChevronRight className="text-tg-hint" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
