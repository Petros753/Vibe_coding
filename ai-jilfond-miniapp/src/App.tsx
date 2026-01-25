import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { Navigation, type TabType } from './components/Navigation';
import { Home } from './components/Home';
import { PropertySearch } from './components/PropertySearch';
import { Chat } from './components/Chat';
import { Calculator } from './components/Calculator';
import { Profile } from './components/Profile';
import apiClient from './api/n8n';
import type { UserData } from './types/api';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { chatId, initData, isReady } = useTelegram();

  useEffect(() => {
    if (initData) {
      apiClient.setInitData(initData);
    }
  }, [initData]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!chatId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.getUser(chatId);
        setUserData(response.user);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        // Set demo user data for development
        setUserData({
          chat_id: chatId,
          first_name: 'Демо',
          subscription_status: 'demo',
          days_left: 7,
          end_sub: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_free: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [chatId]);

  const handleRefreshUser = async () => {
    if (!chatId) return;

    try {
      const response = await apiClient.getUser(chatId);
      setUserData(response.user);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  const handleNavigate = (tab: TabType) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-tg-button border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-tg-hint">Загрузка...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'home':
        return <Home user={userData} onNavigate={handleNavigate} />;
      case 'search':
        return <PropertySearch />;
      case 'chat':
        return <Chat chatId={chatId} />;
      case 'tools':
        return <Calculator />;
      case 'profile':
        return <Profile user={userData} onRefreshUser={handleRefreshUser} />;
      default:
        return <Home user={userData} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-tg-bg">
      {/* Development mode indicator */}
      {!isReady && (
        <div className="bg-yellow-100 text-yellow-800 text-xs text-center py-1">
          Режим разработки (Telegram WebApp не обнаружен)
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
