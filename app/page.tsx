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

// Các components cần import
// import { PriceChart } from "@/components/PriceChart"
// import { TradingSignals } from "@/components/TradingSignals"
// import { MarketOverview } from "@/components/MarketOverview"
// import { TelegramSettings } from "@/components/TelegramSettings"
// import { SymbolSelector } from "@/components/SymbolSelector"
// import { TelegramService } from "@/services/telegramService"

export default function Home() {
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol>(DEFAULT_SYMBOL)

  const { candles, loading, error, lastUpdate, isConnected, refetch } = useBinanceData(5000, currentSymbol)

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: "",
    chatId: "",
    enabled: false,
  })

  const [lastSignalSent, setLastSignalSent] = useState<number>(0)

  const handleSymbolChange = useCallback((symbol: TradingSymbol) => {
    setCurrentSymbol(symbol)
    localStorage.setItem("selected_symbol", JSON.stringify(symbol))
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

  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);

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
      reason: `Test message from ${currentSymbol.displayName} Trading Analyzer`,
      probability: 75,
      strength: "STRONG",
      entry_price: candles.length > 0 ? candles[candles.length - 1].close : 50000,
      stop_loss: candles.length > 0 ? candles[candles.length - 1].close * 0.98 : 49000,
      take_profit: candles.length > 0 ? candles[candles.length - 1].close * 1.02 : 51000,
    }

    const success = await telegramService.sendTradingAlert(testSignal, testSignal.entry_price)
    if (success) {
      alert("Test message sent successfully!")
    } else {
      alert("Failed to send test message. Please check your configuration.")
    }
  }, [telegramService, candles, currentSymbol])

  // Logic tự động gửi Telegram
  useEffect(() => {
    if (!analysis || !telegramConfig.enabled || !telegramService) {
      return
    }

    const currentSignal = analysis.signals[0]
    if (!currentSignal) {
      return
    }

    const timeSinceLastSignal = Date.now() - lastSignalSent
    const isHighProbability = currentSignal.probability >= 45
    const isActionable = currentSignal.action === "BUY" || currentSignal.action === "SELL"
    const cooldownPassed = timeSinceLastSignal > 60000

    const shouldSend = isHighProbability && isActionable && cooldownPassed

    if (shouldSend) {
      const currentPrice = candles[candles.length - 1].close
      telegramService.sendTradingAlert(currentSignal, currentPrice).then((success) => {
        if (success) {
          setLastSignalSent(Date.now())
        }
      })
    }
  }, [analysis, telegramConfig.enabled, telegramService, candles, lastSignalSent])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading market data...</p>
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
          <p className="text-white">Insufficient data for analysis or analysis is not ready.</p>
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
            <h1 className="text-2xl font-bold">Lụm lúa cùng Tiến Anh</h1>
            <div className="flex items-center space-x-2">
              <p className="text-gray-400 text-sm">Technical Analysis</p>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-xs text-blue-400">📊 Phân tích kỹ thuật</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <SymbolSelector currentSymbol={currentSymbol} onSymbolChange={handleSymbolChange} />
            </div>
            <div className="flex items-center space-x-2 mb-2">
              {isConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className={`text-xs ${isConnected ? "text-green-400" : "text-red-400"}`}>
                {isConnected ? "LIVE" : "DISCONNECTED"}
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
  )
}