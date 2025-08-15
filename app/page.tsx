"use client";

import { useMemo, useState, useEffect, useCallback } from "react"
import { useBinanceData } from "@/hooks/useBinanceData"
import { TechnicalAnalyzer } from "@/utils/technicalAnalysis"
import type { TelegramConfig, TradingSignal, MarketAnalysis, TradingSymbol } from "@/types/trading"
import { DEFAULT_SYMBOL } from "@/config/symbols"
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from "lucide-react"
import { TelegramService } from "@/services/telegramService"
import { SymbolSelector } from "@/components/SymbolSelector"
import { PriceChart } from "@/components/PriceChart"
import { MarketOverview } from "@/components/MarketOverview"
import { TradingSignals } from "@/components/TradingSignals"
import { TelegramSettings } from "@/components/TelegramSettings"

export default function Home() {
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol>(DEFAULT_SYMBOL)
  const [lastSignalHash, setLastSignalHash] = useState<string>('')
  const [lastSignalSent, setLastSignalSent] = useState<number>(0)

  const { candles, loading, error, lastUpdate, isConnected, refetch } = useBinanceData(5000, currentSymbol)

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: "",
    chatId: "",
    enabled: false,
  })

  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);

  const handleSymbolChange = useCallback((symbol: TradingSymbol) => {
    setCurrentSymbol(symbol)
    localStorage.setItem("selected_symbol", JSON.stringify(symbol))
    setLastSignalSent(0)
    setLastSignalHash('') // Reset signal hash when changing symbols
  }, [])

  const analysis = useMemo(() => {
    if (candles.length === 0) return null;
    return TechnicalAnalyzer.analyzeMarket(candles, currentSymbol);
  }, [candles, currentSymbol]);

  const indicators = useMemo(() => {
    if (candles.length === 0) return null
    return TechnicalAnalyzer.getTechnicalIndicators(candles)
  }, [candles])

  const priceChange = useMemo(() => {
    if (candles.length < 2) return 0
    const current = candles[candles.length - 1].close
    const previous = candles[candles.length - 2].close
    return ((current - previous) / previous) * 100
  }, [candles])

  // Create a hash of the current signal to detect changes
  const createSignalHash = useCallback((signal: TradingSignal): string => {
    if (!signal) return '';
    return `${signal.action}_${signal.strength}_${Math.floor(signal.confidence/5)*5}_${Math.floor(signal.probability/5)*5}`;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const config = {
        botToken: localStorage.getItem("telegram_bot_token") || "",
        chatId: localStorage.getItem("telegram_chat_id") || "",
        enabled: localStorage.getItem("telegram_enabled") === "true",
      };
      setTelegramConfig(config);
      setTelegramService(new TelegramService(config));
    }
  }, []);

  const handleTelegramConfigChange = useCallback(
    (config: TelegramConfig) => {
      setTelegramConfig(config)
      if (telegramService) {
        telegramService.updateConfig(config);
      }

      localStorage.setItem("telegram_bot_token", config.botToken)
      localStorage.setItem("telegram_chat_id", config.chatId)
      localStorage.setItem("telegram_enabled", config.enabled.toString())
    },
    [telegramService],
  )

  const handleTestMessage = useCallback(async () => {
    if (!telegramService) return;
    
    const testSignal: TradingSignal = {
      action: "BUY",
      confidence: 85,
      timestamp: Date.now(),
      reason: `🧪 TEST: ${currentSymbol.displayName} Scalping System Active`,
      probability: 75,
      strength: "STRONG",
      entry_price: candles.length > 0 ? candles[candles.length - 1].close : 50000,
      stop_loss: candles.length > 0 ? candles[candles.length - 1].close * 0.98 : 49000,
      take_profit: candles.length > 0 ? candles[candles.length - 1].close * 1.02 : 51000,
    }

    const success = await telegramService.sendTradingAlert(testSignal, testSignal.entry_price)
    // NOTE: Using a custom modal/toast notification system is better than alert() in production apps.
    if (success) {
      alert("🎯 Test message sent successfully! Check your Telegram.")
    } else {
      alert("❌ Failed to send test message. Please check your configuration.")
    }
  }, [telegramService, candles, currentSymbol])

  // Enhanced auto-send Telegram signals with more notifications
  useEffect(() => {
    if (!analysis || !telegramService || !candles.length) {
      return
    }

    const currentSignal = analysis.signals[0]
    if (!currentSignal) {
      return
    }

    const currentPrice = candles[candles.length - 1].close
    const timeSinceLastSignal = Date.now() - lastSignalSent
    const currentSignalHash = createSignalHash(currentSignal)
    const signalChanged = currentSignalHash !== lastSignalHash && lastSignalHash !== ''

    // Enhanced conditions for more notifications:
    const isStrongSignal = currentSignal.strength === 'STRONG'
    const isModerateSignal = currentSignal.strength === 'MODERATE'
    const isWeakButHighConfidence = currentSignal.strength === 'WEAK' && currentSignal.confidence >= 70
    const isActionable = currentSignal.action === "BUY" || currentSignal.action === "SELL"
    
    // Lowered thresholds for more signals
    const meetsProbabilityThreshold = currentSignal.probability >= 35 // Lowered from 40
    const meetsConfidenceThreshold = currentSignal.confidence >= 55 // Lowered from 65
    
    // Reduced cooldown and added signal change detection
    const cooldownPassed = timeSinceLastSignal > 45000 // 45 seconds (reduced from 60)
    const quickCooldownPassed = timeSinceLastSignal > 15000 // 15 seconds for signal changes

    // --- Telegram Sending Logic ---
    if (telegramConfig.enabled) {
        const shouldSendStrong = isStrongSignal && isActionable && meetsProbabilityThreshold && meetsConfidenceThreshold && cooldownPassed
        const shouldSendModerate = isModerateSignal && isActionable && currentSignal.probability >= 45 && currentSignal.confidence >= 65 && cooldownPassed
        const shouldSendWeakHigh = isWeakButHighConfidence && isActionable && meetsProbabilityThreshold && cooldownPassed
        const shouldSendSignalChange = signalChanged && isActionable && currentSignal.confidence >= 60 && quickCooldownPassed
        
        const shouldSend = shouldSendStrong || shouldSendModerate || shouldSendWeakHigh || shouldSendSignalChange

        console.log('🔍 Enhanced Telegram send check:', {
            signal: currentSignal.action,
            strength: currentSignal.strength,
            probability: currentSignal.probability,
            confidence: currentSignal.confidence,
            signalHash: currentSignalHash,
            lastHash: lastSignalHash,
            signalChanged,
            timeSince: Math.floor(timeSinceLastSignal / 1000),
            conditions: {
                isStrongSignal,
                isModerateSignal,
                isWeakButHighConfidence,
                isActionable,
                meetsProbabilityThreshold,
                meetsConfidenceThreshold,
                cooldownPassed,
                quickCooldownPassed,
                shouldSendStrong,
                shouldSendModerate,
                shouldSendWeakHigh,
                shouldSendSignalChange
            },
            shouldSend
        })

        if (shouldSend) {
            let enhancedSignal = { ...currentSignal }
            if (shouldSendSignalChange) {
                enhancedSignal.reason = `🔄 SIGNAL CHANGE: ${currentSignal.reason}`
            } else if (shouldSendStrong) {
                enhancedSignal.reason = `🚀 STRONG SIGNAL: ${currentSignal.reason}`
            } else if (shouldSendModerate) {
                enhancedSignal.reason = `📈 MODERATE SIGNAL: ${currentSignal.reason}`
            } else if (shouldSendWeakHigh) {
                enhancedSignal.reason = `⚡ HIGH CONFIDENCE: ${currentSignal.reason}`
            }

            telegramService.sendTradingAlert(enhancedSignal, currentPrice).then((success) => {
                if (success) {
                    setLastSignalSent(Date.now())
                    setLastSignalHash(currentSignalHash)
                    console.log('✅ Enhanced Telegram alert sent successfully')
                } else {
                    console.log('❌ Failed to send Telegram alert')
                }
            })
        } else {
            // Update signal hash even if not sending to track changes
            if(currentSignalHash !== lastSignalHash) {
                setLastSignalHash(currentSignalHash)
            }
        }
    }

    // --- MT5 API Integration Logic (FIXED) ---
    // This logic is now correctly placed inside the useEffect hook.
    const isStrongSignal = currentSignal.strength === 'STRONG';
    if (isStrongSignal && isActionable && currentSignal.reason &&
        currentSignal.reason.toLowerCase().includes('doji')) {
        
        fetch('/api/trading-signals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSignal),
        }).then(response => {
            if (response.ok) {
                console.log('🎯 STRONG Doji signal sent to MT5 API');
            } else {
                console.error('Failed to send signal to MT5 API, status:', response.status);
            }
        }).catch(error => {
            console.error('Failed to send signal to API:', error);
        });
    }

  }, [analysis, telegramConfig.enabled, telegramService, candles, lastSignalSent, lastSignalHash, createSignalHash])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading market data...</p>
          <p className="text-gray-400 text-sm mt-2">Initializing scalping analysis...</p>
        </div>
      </div>
    )
  }

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
    )
  }

  if (!analysis || !indicators) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white">Insufficient data for analysis.</p>
          <p className="text-gray-400 text-sm mt-2">Need at least 30 candles for scalping signals.</p>
        </div>
      </div>
    )
  }

  const currentPrice = candles[candles.length - 1].close

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">⚡ Lụm lúa cùng Tiến Anh - Scalping Pro</h1>
            <div className="flex items-center space-x-2">
              <p className="text-gray-400 text-sm">Enhanced Scalping AI</p>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-400">🔥 Ultra-Fast Signals</span>
              </div>
              {telegramConfig.enabled && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-xs text-blue-400">📱 Telegram Active</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <SymbolSelector currentSymbol={currentSymbol} onSymbolChange={handleSymbolChange} />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              {isConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className={`text-xs ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? "LIVE DATA" : "DISCONNECTED"}
              </span>
            </div>
            <div className="text-sm text-gray-400">Last Updated</div>
            <div className="text-sm">{lastUpdate.toLocaleTimeString('vi-VN')}</div>
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

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart */}
          <div className="lg:col-span-2">
            <PriceChart
              candles={candles.slice(-100)}
              symbol={currentSymbol}
              width={800}
              height={400}
              signals={analysis?.signals || []}
            />
          </div>

          {/* Right Column - Market Overview */}
          <div>
            <MarketOverview
              analysis={analysis}
              indicators={indicators}
              symbol={currentSymbol}
              currentPrice={currentPrice}
              priceChange={priceChange}
            />
          </div>
        </div>

        {/* Trading Signals */}
        <div className="mt-6">
          <TradingSignals signals={analysis?.signals || []} symbol={currentSymbol} />
        </div>

        {/* Telegram Settings */}
        <div className="mt-6">
          <TelegramSettings
            config={telegramConfig}
            onConfigChange={handleTelegramConfigChange}
            onTestMessage={handleTestMessage}
          />
        </div>

        {/* Enhanced notification info */}
        <div className="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl flex-shrink-0 mt-0.5">🚀</div>
            <div>
              <h3 className="text-blue-400 font-semibold mb-2">Enhanced Scalping Notifications</h3>
              <div className="text-blue-100 text-sm leading-relaxed space-y-1">
                <p>• 🔥 <strong>STRONG signals</strong>: Confidence ≥55%, Probability ≥35%</p>
                <p>• 📈 <strong>MODERATE signals</strong>: Confidence ≥65%, Probability ≥45%</p>
                <p>• ⚡ <strong>HIGH CONFIDENCE</strong>: Weak signals with 70%+ confidence</p>
                <p>• 🔄 <strong>SIGNAL CHANGES</strong>: Quick alerts on direction shifts (15s cooldown)</p>
                <p>• ⏱️ <strong>Reduced cooldown</strong>: 45 seconds between regular signals</p>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Warning */}
        <div className="mt-6 bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-yellow-400 font-semibold mb-2">Scalping Risk Warning</h3>
              <div className="text-yellow-100 text-sm leading-relaxed space-y-1">
                <p>🎯 <strong>Scalping Strategy</strong>: Quick in, quick out - set tight stops!</p>
                <p>💰 <strong>Position Size</strong>: Never risk more than 1-2% per trade</p>
                <p>⏰ <strong>Time Management</strong>: Best during high liquidity hours</p>
                <p>🚫 <strong>Tham Lam Warning</strong>: Lương của mày chỉ được 500 cành / ngày...</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
