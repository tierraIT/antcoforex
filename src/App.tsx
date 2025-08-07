import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useBinanceData } from './hooks/useBinanceData';
import { TechnicalAnalyzer } from './utils/technicalAnalysis';
import { PriceChart } from './components/PriceChart';
import { TradingSignals } from './components/TradingSignals';
import { MarketOverview } from './components/MarketOverview';
import { TelegramSettings } from './components/TelegramSettings';
import { SymbolSelector } from './components/SymbolSelector';
import { TelegramService } from './services/telegramService';
import { TelegramConfig, TradingSignal, MarketAnalysis, TradingSymbol } from './types/trading';
import { DEFAULT_SYMBOL } from './config/symbols';
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from 'lucide-react';

function App() {
  // Symbol state
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol>(() => {
    const savedSymbol = localStorage.getItem('selected_symbol');
    if (savedSymbol) {
      try {
        return JSON.parse(savedSymbol);
      } catch {
        return DEFAULT_SYMBOL;
      }
    }
    return DEFAULT_SYMBOL;
  });

  const { candles, loading, error, lastUpdate, isConnected, refetch } = useBinanceData(5000, currentSymbol);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: localStorage.getItem('telegram_bot_token') || '7578707048:AAG5Vr667I-3LerfhO1YzYbgTinXJwuHmAA',
    chatId: localStorage.getItem('telegram_chat_id') || '-1002577959257',
    enabled: localStorage.getItem('telegram_enabled') !== 'false' // Default to true
  });

  const [telegramService] = useState(() => new TelegramService(telegramConfig));

  // Handle symbol change
  const handleSymbolChange = useCallback((symbol: TradingSymbol) => {
    setCurrentSymbol(symbol);
    localStorage.setItem('selected_symbol', JSON.stringify(symbol));
    setTechnicalAnalysis(null);
    setLastTelegramSent(0);
    setGeminiProcessing(false);
  }, []);

  // Technical analysis from indicators only
  const [technicalAnalysis, setTechnicalAnalysis] = useState<MarketAnalysis | null>(null);

  // Gemini and Telegram states
  const [geminiProcessing, setGeminiProcessing] = useState(false);
  const [lastTelegramSent, setLastTelegramSent] = useState<number>(0);
  const [lastGeminiSignal, setLastGeminiSignal] = useState<TradingSignal | null>(null);

  // Update technical analysis whenever candles change
  useEffect(() => {
    if (candles.length === 0) {
      setTechnicalAnalysis(null);
      return;
    }
    setTechnicalAnalysis(TechnicalAnalyzer.analyzeMarket(candles));
  }, [candles]);

  // NEW FLOW: Detect strong signals -> Gemini final decision -> Telegram
  useEffect(() => {
    // Check Telegram config
    if (!telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) {
      return;
    }

    // Check technical analysis
    if (!technicalAnalysis || !technicalAnalysis.signals[0]) {
      return;
    }

    const technicalSignal = technicalAnalysis.signals[0];
    const timeSinceLastTelegram = Date.now() - lastTelegramSent;
    const currentPrice = candles[candles.length - 1]?.close;

    if (!currentPrice) {
      return;
    }

    // STEP 1: Detect strong signals from technical analysis
    const isStrongSignal = (
      (technicalSignal.action === 'BUY' || technicalSignal.action === 'SELL') &&
      technicalSignal.strength === 'STRONG' || technicalSignal.strength === 'VERY_STRONG'
    ) && (
      technicalSignal.probability >= 45 && technicalSignal.confidence >= 65
    );
    
    const cooldownPassed = timeSinceLastTelegram > 120000; // 2 minutes cooldown
    const shouldProcessWithGemini = isStrongSignal && cooldownPassed && !geminiProcessing;

    console.log('🔍 Strong Signal Detection:', {
      signal: technicalSignal.action,
      strength: technicalSignal.strength,
      probability: technicalSignal.probability,
      confidence: technicalSignal.confidence,
      isStrongSignal,
      cooldownPassed,
      shouldProcessWithGemini
    });

    if (!shouldProcessWithGemini) {
      return;
    }


    // STEP 2: Use Gemini for final decision and send to Telegram
    const processWithGemini = async () => {
      setGeminiProcessing(true);
      
      try {
        console.log('🤖 Gemini Final Decision - Processing strong signal...');
        
        const indicators = TechnicalAnalyzer.getTechnicalIndicators(candles);
        const geminiSignal = await TechnicalAnalyzer.getGeminiFinalDecision(
          candles,
          indicators,
          technicalSignal,
          currentSymbol
        );

        setLastGeminiSignal(geminiSignal);

        console.log('🤖 Gemini Decision:', {
          technicalAction: technicalSignal.action,
          geminiAction: geminiSignal.action,
          geminiConfidence: geminiSignal.confidence,
          geminiProbability: geminiSignal.probability
        });

        // STEP 3: Send to Telegram if Gemini confirms
        if (geminiSignal.action === 'BUY' || geminiSignal.action === 'SELL') {
          const success = await telegramService.sendTradingAlert(geminiSignal, currentPrice);
          
          if (success) {
            setLastTelegramSent(Date.now());
            console.log('📱 Telegram alert sent successfully');
          } else {
            console.log('❌ Failed to send Telegram alert');
          }
        } else {
          console.log('🚫 Gemini decided HOLD - not sending to Telegram');
        }



      } catch (error) {
        console.error('🤖 Gemini processing failed:', error);
        
        // Fallback: Send technical signal if Gemini fails
        console.log('📱 Fallback: Sending technical signal to Telegram');
        const success = await telegramService.sendTradingAlert(technicalSignal, currentPrice);
        
        if (success) {
          setLastTelegramSent(Date.now());
          console.log('📱 Fallback Telegram alert sent');
        }
      } finally {
        setGeminiProcessing(false);
      }
    };

    processWithGemini();

  }, [technicalAnalysis, telegramConfig, candles, lastTelegramSent, telegramService, currentSymbol, geminiProcessing]);

  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    return TechnicalAnalyzer.getTechnicalIndicators(candles);
  }, [candles]);

  const priceChange = useMemo(() => {
    if (candles.length < 2) return 0;
    const current = candles[candles.length - 1].close;
    const previous = candles[candles.length - 2].close;
    return ((current - previous) / previous) * 100;
  }, [candles]);

  // Handle Telegram config changes
  const handleTelegramConfigChange = useCallback((config: TelegramConfig) => {
    setTelegramConfig(config);
    telegramService.updateConfig(config);

    // Save to localStorage
    localStorage.setItem('telegram_bot_token', config.botToken);
    localStorage.setItem('telegram_chat_id', config.chatId);
    localStorage.setItem('telegram_enabled', config.enabled.toString());
  }, [telegramService]);

  // Send test message
  const handleTestMessage = useCallback(async () => {
    const testSignal: TradingSignal = {
      action: 'BUY',
      confidence: 85,
      timestamp: Date.now(),
      reason: `Test message from ${currentSymbol.displayName} Trading Analyzer`,
      probability: 75,
      strength: 'STRONG',
      entry_price: candles.length > 0 ? candles[candles.length - 1].close : 50000,
      stop_loss: candles.length > 0 ? candles[candles.length - 1].close * 0.98 : 49000,
      take_profit: candles.length > 0 ? candles[candles.length - 1].close * 1.02 : 51000
    };

    const success = await telegramService.sendTradingAlert(testSignal, testSignal.entry_price);
    if (success) {
      alert('Test message sent successfully!');
    } else {
      alert('Failed to send test message. Please check your configuration.');
    }
  }, [telegramService, candles, currentSymbol]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading market data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center bg-red-900/20 border border-red-700 rounded-lg p-6">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">Error loading data: {error}</p>
          <button
            onClick={refetch}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // Use technical analysis as main display
  const displayAnalysis = technicalAnalysis;
  const currentSignal = displayAnalysis?.signals[0];

  // Show Gemini signal for display if recent
  const displaySignal = lastGeminiSignal && 
                       (Date.now() - (lastGeminiSignal.timestamp || 0) < 60000) ? // Show Gemini result for 1 minute
                       lastGeminiSignal : currentSignal;

  // If displayAnalysis or indicators are still null, show insufficient data message
  if (!displayAnalysis || !indicators) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Insufficient data for analysis or analysis is not ready.</p>
        </div>
      </div>
    );
  }

  const currentPrice = candles[candles.length - 1].close;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lụm lúa cùng Tiến Anh</h1>
            <div className="flex items-center space-x-2">
              <p className="text-gray-400 text-sm">Antco AI</p>
              
              {/* Gemini Processing Status */}
              {geminiProcessing && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-yellow-400">🤖 Gemini đang phân tích tín hiệu mạnh...</span>
                </div>
              )}
              
              {/* Gemini Decision Status */}
              {!geminiProcessing && lastGeminiSignal && (Date.now() - (lastGeminiSignal.timestamp || 0) < 30000) && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-green-400">✅ Gemini đã quyết định: {lastGeminiSignal.action}</span>
                </div>
              )}
              
              {/* Technical Analysis Only */}
              {!geminiProcessing && (!lastGeminiSignal || (Date.now() - (lastGeminiSignal.timestamp || 0) > 30000)) && displayAnalysis && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-xs text-blue-400">📊 Phân tích kỹ thuật</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <SymbolSelector
                currentSymbol={currentSymbol}
                onSymbolChange={handleSymbolChange}
              />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected ? 'LIVE' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="text-sm text-gray-400">Last Updated</div>
            <div className="text-sm">{lastUpdate.toLocaleTimeString()}</div>
            <button
              onClick={refetch}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart */}
          <div className="lg:col-span-2">
            <PriceChart
              candles={candles.slice(-100)}
              symbol={currentSymbol}
              width={800}
              height={400}
              signals={displayAnalysis.signals}
            />
          </div>

          {/* Right Column - Market Overview */}
          <div>
            <MarketOverview
              analysis={displayAnalysis}
              indicators={indicators}
              symbol={currentSymbol}
              currentPrice={currentPrice}
              priceChange={priceChange}
            />
          </div>
        </div>

        {/* Trading Signals */}
        <div className="mt-6">
          <TradingSignals 
            signals={displaySignal ? [displaySignal] : displayAnalysis.signals} 
            symbol={currentSymbol} 
          />
        </div>

        {/* Telegram Settings */}
        <div className="mt-6">
          <TelegramSettings
            config={telegramConfig}
            onConfigChange={handleTelegramConfigChange}
            onTestMessage={handleTestMessage}
          />
        </div>

        {/* Risk Warning */}
        <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-400 font-semibold mb-2">Risk Warning</h3>
              <p className="text-yellow-100 text-sm leading-relaxed">
                Đừng tham lam. Lương của mày chỉ được 500 cành / ngày...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
