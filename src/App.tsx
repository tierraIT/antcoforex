import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useBinanceData } from './hooks/useBinanceData';
import { TechnicalAnalyzer } from './utils/technicalAnalysis';
import { PriceChart } from './components/PriceChart';
import { TradingSignals } from './components/TradingSignals';
import { MarketOverview } from './components/MarketOverview';
import { TelegramSettings } from './components/TelegramSettings';
import { SymbolSelector } from './components/SymbolSelector';
import { TelegramService } from './services/telegramService';
import { TelegramConfig, TradingSignal, TradingSymbol } from './types/trading';
import { DEFAULT_SYMBOL } from './config/symbols';
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

function App() {
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol>(() => {
    const savedSymbol = localStorage.getItem('selected_symbol');
    try {
      return savedSymbol ? JSON.parse(savedSymbol) : DEFAULT_SYMBOL;
    } catch {
      return DEFAULT_SYMBOL;
    }
  });

  const { candles, loading, error, lastUpdate, isConnected, refetch } = useBinanceData(5000, currentSymbol);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: localStorage.getItem('telegram_bot_token') || '7578707048:AAG5Vr667I-3LerfhO1YzYbgTinXJwuHmAA',
    chatId: localStorage.getItem('telegram_chat_id') || '-1002577959257',
    enabled: localStorage.getItem('telegram_enabled') !== 'false'
  });
  
  const [telegramService] = useState(() => new TelegramService(telegramConfig));
  const [lastTelegramSent, setLastTelegramSent] = useState<number>(0);

  const handleSymbolChange = useCallback((symbol: TradingSymbol) => {
    setCurrentSymbol(symbol);
    localStorage.setItem('selected_symbol', JSON.stringify(symbol));
    setLastTelegramSent(0);
  }, []);

  const technicalAnalysis = useMemo(() => {
    if (candles.length < 50) return null;
    return TechnicalAnalyzer.analyzeMarket(candles, currentSymbol);
  }, [candles, currentSymbol]);

  // *** UPDATED AUTO-SEND TELEGRAM LOGIC ***
  useEffect(() => {
    if (!technicalAnalysis || !telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) {
      return;
    }

    const currentSignal = technicalAnalysis.signals[0];
    if (!currentSignal || currentSignal.action === 'HOLD') {
      return;
    }
    
    const timeSinceLastTelegram = Date.now() - lastTelegramSent;
    
    // --- NEW, LESS RESTRICTIVE CONDITIONS ---
    const isActionable = currentSignal.action === 'BUY' || currentSignal.action === 'SELL';
    const meetsStrengthThreshold = currentSignal.strength === 'STRONG' || currentSignal.strength === 'MODERATE';
    const meetsProbabilityThreshold = currentSignal.probability >= 35;
    const meetsConfidenceThreshold = currentSignal.confidence >= 55;
    const cooldownPassed = timeSinceLastTelegram > 30000; // 30 second cooldown

    const shouldSend = isActionable && meetsStrengthThreshold && meetsProbabilityThreshold && meetsConfidenceThreshold && cooldownPassed;
    
    if (shouldSend) {
      const currentPrice = candles[candles.length - 1]?.close;
      if (!currentPrice) return;

      console.log(`🚀 Sending Telegram Alert: ${currentSignal.action} | ${currentSignal.reason} | Confidence: ${currentSignal.confidence}`);
      const sendAlert = async () => {
        const success = await telegramService.sendTradingAlert(currentSignal, currentPrice);
        if (success) {
          setLastTelegramSent(Date.now());
          console.log('✅ Telegram alert sent successfully');
        } else {
          console.error('❌ Failed to send Telegram alert');
        }
      };
      sendAlert();
    }
  }, [technicalAnalysis, telegramConfig, candles, lastTelegramSent, telegramService]);

  const handleTelegramConfigChange = useCallback((config: TelegramConfig) => {
    setTelegramConfig(config);
    telegramService.updateConfig(config);
    localStorage.setItem('telegram_bot_token', config.botToken);
    localStorage.setItem('telegram_chat_id', config.chatId);
    localStorage.setItem('telegram_enabled', config.enabled.toString());
  }, [telegramService]);

  const handleTestMessage = useCallback(async () => {
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    const testSignal: TradingSignal = {
        action: 'BUY',
        confidence: 85,
        timestamp: Date.now(),
        reason: `✅ Test message from ${currentSymbol.displayName} Analyzer`,
        probability: 75,
        strength: 'STRONG',
        entry_price: currentPrice,
        stop_loss: currentPrice * 0.98,
        take_profit: currentPrice * 1.02,
    };
    const success = await telegramService.sendTradingAlert(testSignal, currentPrice);
    alert(success ? 'Test message sent!' : 'Failed to send. Check config.');
  }, [telegramService, candles, currentSymbol]);
  
  // Other memoized calculations
  const indicators = useMemo(() => technicalAnalysis?.indicators, [technicalAnalysis]);
  const priceChange = useMemo(() => {
      if (candles.length < 2) return 0;
      const current = candles[candles.length - 1].close;
      const previous = candles[candles.length - 2].close;
      return ((current - previous) / previous) * 100;
  }, [candles]);

  return (
    <main className="bg-gray-900 text-white min-h-screen p-4">
      {/* JSX components here, assuming they are the same as in page.tsx */}
    </main>
  );
}

export default App;