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
    setBaseAnalysis(null);
    setLastSignalSent(0);
    setLastAiSignal(null);
    setAnalysisConflict(false);
  }, []);

  // Base analysis from Technical Analysis only
  const [baseAnalysis, setBaseAnalysis] = useState<MarketAnalysis | null>(null);

  // Telegram-specific states (NEW LOGIC)
  const [telegramProcessing, setTelegramProcessing] = useState(false);
  const [lastSignalSent, setLastSignalSent] = useState<number>(0);
  const [lastAiSignal, setLastAiSignal] = useState<TradingSignal | null>(null);
  const [aiDecisionTimestamp, setAiDecisionTimestamp] = useState<number>(0);
  const [analysisConflict, setAnalysisConflict] = useState<{ ta: string; ai: string } | false>(false);

  // Update baseAnalysis whenever candles change
  useEffect(() => {
    if (candles.length === 0) {
      setBaseAnalysis(null);
      return;
    }
    setBaseAnalysis(TechnicalAnalyzer.analyzeMarket(candles));
  }, [candles]);

  // NEW LOGIC: AI chỉ được gọi khi quyết định gửi Telegram
  useEffect(() => {
    // Kiểm tra config Telegram
    if (!telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) {
      console.log('❌ Telegram not configured:', {
        enabled: telegramConfig.enabled,
        hasToken: !!telegramConfig.botToken,
        hasChatId: !!telegramConfig.chatId
      });
      return;
    }

    // Kiểm tra baseAnalysis
    if (!baseAnalysis || !baseAnalysis.signals[0]) {
      console.log('❌ No base analysis available');
      return;
    }

    const currentSignal = baseAnalysis.signals[0];
    const timeSinceLastSignal = Date.now() - lastSignalSent;
    const currentPrice = candles[candles.length - 1]?.close;

    if (!currentPrice) {
      console.log('❌ No current price available');
      return;
    }

    // BƯỚC 1: Quyết định có nên gửi Telegram không (dựa trên Technical Analysis)
    const isActionable = (currentSignal.action === 'BUY' || currentSignal.action === 'SELL');
    const isQualitySignal = currentSignal.probability >= 65 || currentSignal.confidence >= 60;
    const cooldownPassed = timeSinceLastSignal > 60000; // 1 phút
    
    const shouldConsiderSending = isActionable && isQualitySignal && cooldownPassed;

    console.log('🎯 Telegram Decision Step 1 - TA Analysis:', {
      signal: currentSignal.action,
      probability: currentSignal.probability,
      confidence: currentSignal.confidence,
      strength: currentSignal.strength,
      isActionable,
      isQualitySignal,
      cooldownPassed,
      timeSinceLastSignal: Math.round(timeSinceLastSignal / 1000) + 's',
      shouldConsiderSending
    });

    if (!shouldConsiderSending) {
      console.log('⏸️ Signal not worth sending - conditions not met');
      return;
    }

    // BƯỚC 2: Nếu quyết định gửi -> Gọi AI để xác nhận lần cuối
    const enhanceAndSend = async () => {
      if (telegramProcessing) {
        console.log('⏸️ AI already processing, skipping...');
        return;
      }

      setTelegramProcessing(true);
      
      try {
        console.log('🤖 AI Final Check - Enhancing signal before Telegram...');
        
        const indicators = TechnicalAnalyzer.getTechnicalIndicators(candles);
        const enhancedSignals = await TechnicalAnalyzer.generateEnhancedTradingSignals(
          candles,
          indicators,
          baseAnalysis.trend,
          baseAnalysis.momentum,
          currentSymbol
        );

        const aiEnhancedSignal = enhancedSignals[0];
        setLastAiSignal(aiEnhancedSignal);
        setAiDecisionTimestamp(Date.now());

        console.log('🤖 AI Final Decision:', {
          originalAction: currentSignal.action,
          aiAction: aiEnhancedSignal.action,
          originalProbability: currentSignal.probability,
          aiProbability: aiEnhancedSignal.probability,
          aiConfidence: aiEnhancedSignal.confidence,
          conflict: currentSignal.action !== aiEnhancedSignal.action
        });

        // BƯỚC 3: AI có thể từ chối gửi (nếu AI disagreement)
        const aiApproves = aiEnhancedSignal.action === currentSignal.action || 
                          aiEnhancedSignal.probability >= 70;

        if (!aiApproves) {
          console.log('🚫 AI rejected signal - not sending to Telegram');
          setAnalysisConflict({ 
            ta: currentSignal.action, 
            ai: aiEnhancedSignal.action 
          });
          return;
        }

        // BƯỚC 4: AI đồng ý -> Gửi Telegram
        console.log('✅ AI approved - sending to Telegram');
        setAnalysisConflict(false);
        
        const success = await telegramService.sendTradingAlert(aiEnhancedSignal, currentPrice);
        
        if (success) {
          setLastSignalSent(Date.now());
          console.log('📱 Telegram alert sent successfully');
        } else {
          console.log('❌ Failed to send Telegram alert');
        }

      } catch (error) {
        console.error('🤖 AI enhancement failed:', error);
        
        // Fallback: Gửi signal gốc nếu AI fail
        console.log('📱 Fallback: Sending original signal to Telegram');
        const success = await telegramService.sendTradingAlert(currentSignal, currentPrice);
        
        if (success) {
          setLastSignalSent(Date.now());
          console.log('📱 Fallback Telegram alert sent');
        }
      } finally {
        setTelegramProcessing(false);
      }
    };

    enhanceAndSend();

  }, [baseAnalysis, telegramConfig, candles, lastSignalSent, telegramService, currentSymbol, telegramProcessing]);

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

  // Use baseAnalysis as main analysis
  const displayAnalysis = baseAnalysis;
  const currentSignal = displayAnalysis?.signals[0];

  // Enhanced signal for display purposes only
  const displaySignal = lastAiSignal && 
                       (Date.now() - aiDecisionTimestamp < 30000) ? // Show AI result for 30s
                       lastAiSignal : currentSignal;

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
              
              {/* Telegram Processing Status */}
              {telegramProcessing && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-yellow-400">🤖 AI đang xác nhận trước khi gửi Telegram...</span>
                </div>
              )}
              
              {/* Conflict Warning */}
              {!telegramProcessing && analysisConflict && (
                <div className="flex items-center space-x-2 bg-red-900/50 border border-red-700 px-2 py-1 rounded">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-300 font-semibold">
                    AI từ chối: TA đề xuất {analysisConflict.ta} nhưng AI quyết định {analysisConflict.ai}
                  </span>
                </div>
              )}
              
              {/* Success Status */}
              {!telegramProcessing && lastAiSignal && (Date.now() - aiDecisionTimestamp < 10000) && !analysisConflict && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-green-400">✅ AI đã phê duyệt và gửi Telegram</span>
                </div>
              )}
              
              {/* Technical Analysis Only */}
              {!telegramProcessing && (!lastAiSignal || (Date.now() - aiDecisionTimestamp > 10000)) && displayAnalysis && (
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
