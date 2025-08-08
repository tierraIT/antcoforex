"use client";

import { useMemo, useState, useEffect, useCallback } from "react"
import { useBinanceData } from "@/hooks/useBinanceData"
import { TechnicalAnalyzer } from "@/utils/technicalAnalysis"
import type { TelegramConfig, TradingSignal, TradingSymbol } from "@/types/trading"
import { DEFAULT_SYMBOL } from "@/config/symbols"
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from "lucide-react"
import { TelegramService } from "@/services/telegramService"
import { SymbolSelector } from "@/components/SymbolSelector"
import { PriceChart } from "@/components/PriceChart"
import { MarketOverview } from "@/components/MarketOverview"
import { TradingSignals } from "@/components/TradingSignals"
import { TelegramSettings } from "@/components/TelegramSettings"

export default function Home() {
  const [currentSymbol, setCurrentSymbol] = useState<TradingSymbol>(() => {
    if (typeof window === "undefined") return DEFAULT_SYMBOL;
    const savedSymbol = localStorage.getItem('selected_symbol');
    try {
      return savedSymbol ? JSON.parse(savedSymbol) : DEFAULT_SYMBOL;
    } catch {
      return DEFAULT_SYMBOL;
    }
  });

  const { candles, loading, error, lastUpdate, isConnected, refetch } = useBinanceData(5000, currentSymbol)

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    botToken: "",
    chatId: "",
    enabled: false,
  })

  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);
  const [lastSignalSent, setLastSignalSent] = useState<number>(0)

  // Initialize Telegram Service and load config from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const config = {
        botToken: localStorage.getItem("telegram_bot_token") || "7578707048:AAG5Vr667I-3LerfhO1YzYbgTinXJwuHmAA",
        chatId: localStorage.getItem("telegram_chat_id") || "-1002577959257",
        enabled: localStorage.getItem("telegram_enabled") !== "false",
      };
      setTelegramConfig(config);
      setTelegramService(new TelegramService(config));
    }
  }, []);

  const handleSymbolChange = useCallback((symbol: TradingSymbol) => {
    setCurrentSymbol(symbol)
    localStorage.setItem("selected_symbol", JSON.stringify(symbol))
    setLastSignalSent(0); // Reset cooldown on symbol change
  }, [])

  const analysis = useMemo(() => {
    if (candles.length < 50) return null;
    return TechnicalAnalyzer.analyzeMarket(candles, currentSymbol);
  }, [candles, currentSymbol]);
  
  // *** FIXED: Added priceChange calculation ***
  const priceChange = useMemo(() => {
      if (candles.length < 2) return 0;
      const current = candles[candles.length - 1].close;
      const previous = candles[candles.length - 2].close;
      // Avoid division by zero if previous price is 0
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
  }, [candles]);

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
    if (!telegramService || candles.length === 0) {
        alert("Service not ready or no market data.");
        return;
    };

    const currentPrice = candles[candles.length - 1].close;
    const testSignal: TradingSignal = {
      action: "BUY",
      confidence: 85,
      timestamp: Date.now(),
      reason: `✅ Test message from ${currentSymbol.displayName} Analyzer`,
      probability: 75,
      strength: "STRONG",
      entry_price: currentPrice,
      stop_loss: currentPrice * 0.98,
      take_profit: currentPrice * 1.02,
    }

    const success = await telegramService.sendTradingAlert(testSignal, currentPrice)
    if (success) {
      alert("Test message sent successfully!")
    } else {
      alert("Failed to send test message. Check console for errors.")
    }
  }, [telegramService, candles, currentSymbol])

  // *** UPDATED AUTO-SEND TELEGRAM LOGIC ***
  useEffect(() => {
    if (!analysis || !telegramConfig.enabled || !telegramService || !candles.length) {
      return
    }

    const currentSignal = analysis.signals[0]
    if (!currentSignal || currentSignal.action === 'HOLD') {
      return
    }

    const timeSinceLastSignal = Date.now() - lastSignalSent;

    // --- NEW, LESS RESTRICTIVE CONDITIONS ---
    const isActionable = currentSignal.action === "BUY" || currentSignal.action === "SELL";
    const meetsStrengthThreshold = currentSignal.strength === 'STRONG' || currentSignal.strength === 'MODERATE';
    const meetsProbabilityThreshold = currentSignal.probability >= 35;
    const meetsConfidenceThreshold = currentSignal.confidence >= 55;
    const cooldownPassed = timeSinceLastSignal > 30000; // 30 second cooldown

    const shouldSend = isActionable && meetsStrengthThreshold && meetsProbabilityThreshold && meetsConfidenceThreshold && cooldownPassed;

    if (shouldSend) {
      const currentPrice = candles[candles.length - 1].close;
      console.log(`🚀 Sending Telegram Alert: ${currentSignal.action} | ${currentSignal.reason} | Confidence: ${currentSignal.confidence}`);
      telegramService.sendTradingAlert(currentSignal, currentPrice).then((success) => {
        if (success) {
          setLastSignalSent(Date.now());
          console.log('✅ Telegram alert sent successfully');
        } else {
          console.error('❌ Failed to send Telegram alert.');
        }
      });
    }
  }, [analysis, telegramConfig, candles, telegramService, lastSignalSent]);


  return (
    <main className="bg-gray-900 text-white min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h1 className="text-2xl font-bold">Scalping Assistant</h1>
            <div className="flex items-center gap-4">
                <SymbolSelector onSymbolChange={handleSymbolChange} defaultSymbol={currentSymbol} />
                <button onClick={() => refetch()} disabled={loading} className="p-2 bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50">
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                </button>
                <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                    {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>
        </header>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p><strong>Error:</strong> {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <PriceChart candles={candles} indicators={analysis?.indicators} loading={loading} />
            <MarketOverview analysis={analysis} lastUpdate={lastUpdate} priceChange={priceChange} />
          </div>
          <div className="space-y-4">
            <TradingSignals signals={analysis?.signals || []} symbol={currentSymbol} />
            <TelegramSettings 
              config={telegramConfig} 
              onConfigChange={handleTelegramConfigChange}
              onTestMessage={handleTestMessage}
            />
          </div>
        </div>
      </div>
    </main>
  )
}