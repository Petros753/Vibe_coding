import { useState, useEffect } from 'react';
import { Search, Filter, MapPin, Building2, Phone, X } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';
import apiClient from '../api/n8n';
import type { Property, PropertySearchParams } from '../types/api';

const districts = [
  'Все районы',
  'Центр',
  'Кировский',
  'Ленинский',
  'Советский',
  'Трусовский',
];

export const PropertySearch = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<PropertySearchParams>({
    district: '',
    min_area: undefined,
    max_area: undefined,
    min_price: undefined,
    max_price: undefined,
  });
  const { hapticFeedback, openLink } = useTelegram();

  const fetchProperties = async (params?: PropertySearchParams) => {
    setIsLoading(true);
    try {
      const response = await apiClient.searchProperties(params || {});
      setProperties(response.properties);
    } catch (error) {
      console.error('Failed to fetch properties:', error);
      // Demo data for development
      setProperties([
        {
          id: '1',
          jk_name: 'ЖК Триумф',
          district: 'Центр',
          apartments: 120,
          floors: 17,
          ceiling_height: '2.7м',
          mortgage_programs: ['Семейная', 'IT-ипотека'],
          agent_kv: '3%',
          curator_phone: '+7 (851) 123-45-67',
          price_from: 3500000,
          address: 'ул. Кирова, 15',
          deadline: 'Q4 2025',
        },
        {
          id: '2',
          jk_name: 'ЖК Волга',
          district: 'Кировский',
          apartments: 85,
          floors: 12,
          ceiling_height: '2.8м',
          mortgage_programs: ['Стандартная', 'Семейная'],
          discounts: ['Скидка 5% до конца месяца'],
          agent_kv: '2.5%',
          curator_phone: '+7 (851) 987-65-43',
          price_from: 2800000,
          address: 'ул. Набережная, 28',
          deadline: 'Q2 2025',
        },
        {
          id: '3',
          jk_name: 'ЖК Астра',
          district: 'Советский',
          apartments: 200,
          floors: 25,
          ceiling_height: '2.7м',
          mortgage_programs: ['IT-ипотека', 'Военная'],
          agent_kv: '3.5%',
          curator_phone: '+7 (851) 555-44-33',
          price_from: 4200000,
          address: 'пр. Губернатора Анатолия Гужвина, 10',
          deadline: 'Q1 2026',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleSearch = () => {
    hapticFeedback('light');
    const searchParams: PropertySearchParams = {
      ...filters,
      jk_name: searchQuery || undefined,
    };
    fetchProperties(searchParams);
    setShowFilters(false);
  };

  const handleCallCurator = (phone: string) => {
    hapticFeedback('medium');
    openLink(`tel:${phone.replace(/[^+\d]/g, '')}`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const filteredProperties = properties.filter((property) => {
    if (searchQuery && !property.jk_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filters.district && filters.district !== 'Все районы' && property.district !== filters.district) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full pb-16">
      {/* Header */}
      <div className="bg-tg-bg border-b border-tg-hint/20 p-4">
        <h1 className="text-lg font-semibold text-tg-text mb-3">Поиск недвижимости</h1>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tg-hint" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название ЖК..."
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-lg transition-colors ${
              showFilters ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary-bg text-tg-hint'
            }`}
          >
            <Filter size={20} />
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-tg-secondary-bg rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-tg-text">Фильтры</h3>
              <button onClick={() => setShowFilters(false)} className="text-tg-hint">
                <X size={20} />
              </button>
            </div>

            {/* District */}
            <div>
              <label className="text-sm text-tg-hint mb-1 block">Район</label>
              <select
                value={filters.district || ''}
                onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                className="input-field"
              >
                {districts.map((district) => (
                  <option key={district} value={district === 'Все районы' ? '' : district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-tg-hint mb-1 block">Площадь от, м²</label>
                <input
                  type="number"
                  value={filters.min_area || ''}
                  onChange={(e) => setFilters({ ...filters, min_area: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="30"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-tg-hint mb-1 block">Площадь до, м²</label>
                <input
                  type="number"
                  value={filters.max_area || ''}
                  onChange={(e) => setFilters({ ...filters, max_area: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="100"
                  className="input-field"
                />
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-tg-hint mb-1 block">Цена от, ₽</label>
                <input
                  type="number"
                  value={filters.min_price || ''}
                  onChange={(e) => setFilters({ ...filters, min_price: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="2000000"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-tg-hint mb-1 block">Цена до, ₽</label>
                <input
                  type="number"
                  value={filters.max_price || ''}
                  onChange={(e) => setFilters({ ...filters, max_price: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="10000000"
                  className="input-field"
                />
              </div>
            </div>

            <button onClick={handleSearch} className="btn-primary w-full">
              Применить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-tg-button border-t-transparent rounded-full" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-8 text-tg-hint">
            <Building2 size={48} className="mx-auto mb-3 opacity-50" />
            <p>Ничего не найдено</p>
            <p className="text-sm">Попробуйте изменить параметры поиска</p>
          </div>
        ) : (
          filteredProperties.map((property) => (
            <div key={property.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-tg-text">{property.jk_name}</h3>
                <span className="text-xs bg-tg-button/10 text-tg-button px-2 py-1 rounded-full">
                  KV {property.agent_kv}
                </span>
              </div>

              <div className="flex items-center gap-1 text-sm text-tg-hint mb-3">
                <MapPin size={14} />
                <span>{property.district}</span>
                {property.address && <span>• {property.address}</span>}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-tg-bg rounded-lg py-2">
                  <p className="text-xs text-tg-hint">Этажей</p>
                  <p className="font-medium text-tg-text">{property.floors}</p>
                </div>
                <div className="bg-tg-bg rounded-lg py-2">
                  <p className="text-xs text-tg-hint">Квартир</p>
                  <p className="font-medium text-tg-text">{property.apartments}</p>
                </div>
                <div className="bg-tg-bg rounded-lg py-2">
                  <p className="text-xs text-tg-hint">Потолки</p>
                  <p className="font-medium text-tg-text">{property.ceiling_height}</p>
                </div>
              </div>

              {property.price_from && (
                <p className="text-lg font-bold text-tg-button mb-2">
                  от {formatPrice(property.price_from)}
                </p>
              )}

              {/* Mortgage Programs */}
              <div className="flex flex-wrap gap-1 mb-3">
                {property.mortgage_programs.map((program, index) => (
                  <span
                    key={index}
                    className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full"
                  >
                    {program}
                  </span>
                ))}
              </div>

              {/* Discounts */}
              {property.discounts && property.discounts.length > 0 && (
                <div className="mb-3">
                  {property.discounts.map((discount, index) => (
                    <p key={index} className="text-xs text-red-500">
                      🔥 {discount}
                    </p>
                  ))}
                </div>
              )}

              {/* Deadline */}
              {property.deadline && (
                <p className="text-xs text-tg-hint mb-3">
                  Сдача: {property.deadline}
                </p>
              )}

              {/* Call Button */}
              <button
                onClick={() => handleCallCurator(property.curator_phone)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                Позвонить куратору
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
