import { useState, useEffect } from 'react';
import { Calculator as CalcIcon, Percent, Calendar, Wallet } from 'lucide-react';
import { useTelegram } from '../hooks/useTelegram';

interface CalculationResult {
  monthlyPayment: number;
  totalPayment: number;
  overpayment: number;
}

export const Calculator = () => {
  const [propertyPrice, setPropertyPrice] = useState<number>(5000000);
  const [downPayment, setDownPayment] = useState<number>(1000000);
  const [interestRate, setInterestRate] = useState<number>(8);
  const [loanTerm, setLoanTerm] = useState<number>(20);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const { hapticFeedback } = useTelegram();

  const calculate = () => {
    const loanAmount = propertyPrice - downPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = loanTerm * 12;

    if (loanAmount <= 0 || monthlyRate <= 0 || numberOfPayments <= 0) {
      setResult(null);
      return;
    }

    // Annuity payment formula
    const monthlyPayment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayment = monthlyPayment * numberOfPayments;
    const overpayment = totalPayment - loanAmount;

    setResult({
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      overpayment: Math.round(overpayment),
    });
  };

  useEffect(() => {
    calculate();
  }, [propertyPrice, downPayment, interestRate, loanTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const downPaymentPercent = Math.round((downPayment / propertyPrice) * 100);

  const handleSliderChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(Number(e.target.value));
    hapticFeedback('light');
  };

  return (
    <div className="flex flex-col h-full pb-16 overflow-y-auto">
      {/* Header */}
      <div className="bg-tg-bg border-b border-tg-hint/20 p-4">
        <h1 className="text-lg font-semibold text-tg-text flex items-center gap-2">
          <CalcIcon size={24} className="text-tg-button" />
          Ипотечный калькулятор
        </h1>
        <p className="text-xs text-tg-hint mt-1">Рассчитайте ежемесячный платёж</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Property Price */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={18} className="text-tg-button" />
            <span className="font-medium text-tg-text">Стоимость недвижимости</span>
          </div>
          <input
            type="range"
            min={1000000}
            max={20000000}
            step={100000}
            value={propertyPrice}
            onChange={handleSliderChange(setPropertyPrice)}
            className="w-full h-2 bg-tg-secondary-bg rounded-lg appearance-none cursor-pointer accent-tg-button"
          />
          <div className="flex justify-between text-sm mt-2">
            <span className="text-tg-hint">1 млн</span>
            <span className="font-bold text-tg-button">{formatCurrency(propertyPrice)}</span>
            <span className="text-tg-hint">20 млн</span>
          </div>
        </div>

        {/* Down Payment */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Percent size={18} className="text-tg-button" />
              <span className="font-medium text-tg-text">Первоначальный взнос</span>
            </div>
            <span className="text-sm text-tg-hint">{downPaymentPercent}%</span>
          </div>
          <input
            type="range"
            min={propertyPrice * 0.1}
            max={propertyPrice * 0.9}
            step={50000}
            value={downPayment}
            onChange={handleSliderChange(setDownPayment)}
            className="w-full h-2 bg-tg-secondary-bg rounded-lg appearance-none cursor-pointer accent-tg-button"
          />
          <div className="flex justify-between text-sm mt-2">
            <span className="text-tg-hint">10%</span>
            <span className="font-bold text-tg-button">{formatCurrency(downPayment)}</span>
            <span className="text-tg-hint">90%</span>
          </div>
        </div>

        {/* Interest Rate */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Percent size={18} className="text-tg-button" />
            <span className="font-medium text-tg-text">Процентная ставка</span>
          </div>
          <input
            type="range"
            min={1}
            max={25}
            step={0.1}
            value={interestRate}
            onChange={handleSliderChange(setInterestRate)}
            className="w-full h-2 bg-tg-secondary-bg rounded-lg appearance-none cursor-pointer accent-tg-button"
          />
          <div className="flex justify-between text-sm mt-2">
            <span className="text-tg-hint">1%</span>
            <span className="font-bold text-tg-button">{interestRate}% годовых</span>
            <span className="text-tg-hint">25%</span>
          </div>

          {/* Quick rate buttons */}
          <div className="flex gap-2 mt-3">
            {[6, 8, 12, 18].map((rate) => (
              <button
                key={rate}
                onClick={() => {
                  setInterestRate(rate);
                  hapticFeedback('light');
                }}
                className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
                  interestRate === rate
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary-bg text-tg-hint'
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>

        {/* Loan Term */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-tg-button" />
            <span className="font-medium text-tg-text">Срок кредита</span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={loanTerm}
            onChange={handleSliderChange(setLoanTerm)}
            className="w-full h-2 bg-tg-secondary-bg rounded-lg appearance-none cursor-pointer accent-tg-button"
          />
          <div className="flex justify-between text-sm mt-2">
            <span className="text-tg-hint">1 год</span>
            <span className="font-bold text-tg-button">{loanTerm} лет</span>
            <span className="text-tg-hint">30 лет</span>
          </div>

          {/* Quick term buttons */}
          <div className="flex gap-2 mt-3">
            {[10, 15, 20, 25, 30].map((term) => (
              <button
                key={term}
                onClick={() => {
                  setLoanTerm(term);
                  hapticFeedback('light');
                }}
                className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
                  loanTerm === term
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary-bg text-tg-hint'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="card bg-gradient-to-br from-tg-button to-tg-link text-white">
            <h3 className="font-semibold mb-4">Результаты расчёта</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Сумма кредита</span>
                <span className="font-bold">{formatCurrency(propertyPrice - downPayment)}</span>
              </div>

              <div className="flex justify-between items-center text-xl">
                <span className="text-white/80">Ежемесячный платёж</span>
                <span className="font-bold">{formatCurrency(result.monthlyPayment)}</span>
              </div>

              <div className="border-t border-white/20 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Общая сумма выплат</span>
                  <span className="font-medium">{formatCurrency(result.totalPayment)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-white/80">Переплата</span>
                  <span className="font-medium text-yellow-200">{formatCurrency(result.overpayment)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Popular Programs */}
        <div className="card">
          <h3 className="font-semibold text-tg-text mb-3">Популярные программы</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                setInterestRate(6);
                hapticFeedback('medium');
              }}
              className="w-full p-3 bg-green-50 text-left rounded-lg hover:bg-green-100 transition-colors"
            >
              <p className="font-medium text-green-700">Семейная ипотека</p>
              <p className="text-xs text-green-600">от 6% годовых</p>
            </button>
            <button
              onClick={() => {
                setInterestRate(5);
                hapticFeedback('medium');
              }}
              className="w-full p-3 bg-blue-50 text-left rounded-lg hover:bg-blue-100 transition-colors"
            >
              <p className="font-medium text-blue-700">IT-ипотека</p>
              <p className="text-xs text-blue-600">от 5% годовых</p>
            </button>
            <button
              onClick={() => {
                setInterestRate(2);
                hapticFeedback('medium');
              }}
              className="w-full p-3 bg-purple-50 text-left rounded-lg hover:bg-purple-100 transition-colors"
            >
              <p className="font-medium text-purple-700">Военная ипотека</p>
              <p className="text-xs text-purple-600">от 2% годовых</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
