import { Home, Search, MessageCircle, Calculator, User } from 'lucide-react';

export type TabType = 'home' | 'search' | 'chat' | 'tools' | 'profile';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Главная', icon: <Home size={20} /> },
  { id: 'search', label: 'Поиск', icon: <Search size={20} /> },
  { id: 'chat', label: 'AI Чат', icon: <MessageCircle size={20} /> },
  { id: 'tools', label: 'Инструменты', icon: <Calculator size={20} /> },
  { id: 'profile', label: 'Профиль', icon: <User size={20} /> },
];

export const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-hint/20 px-2 pb-safe">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
              activeTab === tab.id
                ? 'text-tg-button'
                : 'text-tg-hint'
            }`}
          >
            {tab.icon}
            <span className="text-xs mt-1">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
