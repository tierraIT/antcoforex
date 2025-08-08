import type React from "react"
import type { TradingSignal, TradingSymbol } from "../types/trading"
import { TrendingUp, TrendingDown, Minus, Target, Shield, DollarSign, Zap, Activity, AlertCircle } from "lucide-react"

interface TradingSignalsProps {
  signals: TradingSignal[]
  symbol: TradingSymbol
}

export const TradingSignals: React.FC<TradingSignalsProps> = ({ signals = [], symbol }) => {
  if (!signals || !Array.isArray(signals) || signals.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">⚡ Scalping Signal Analysis</h3>
        <div className="text-center text-gray-400 py-8">
          <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>No trading signals available at the moment.</p>
          <p className="text-sm mt-2">Analyzing market patterns...</p>
        </div>
      </div>
    )
  }

  const getSignalColor = (action: string, strength: string) => {
    if (action === "BUY") {
      if (strength === "STRONG") return "text-green-300 bg-green-900/30 border-green-600"
      if (strength === "MODERATE") return "text-green-400 bg-green-900/20 border-green-700"
      return "text-green-500 bg-green-900/10 border-green-800"
    } else if (action === "SELL") {
      if (strength === "STRONG") return "text-red-300 bg-red-900/30 border-red-600"
      if (strength === "MODERATE") return "text-red-400 bg-red-900/20 border-red-700"
      return "text-red-500 bg-red-900/10 border-red-800"
    }
    return "text-yellow-400 bg-yellow-900/20 border-yellow-700"
  }

  const getSignalIcon = (action: string, strength: string) => {
    if (action === "BUY") {
      return strength === "STRONG" ? <Zap className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />
    } else if (action === "SELL") {
      return strength === "STRONG" ? <Zap className="w-5 h-5 rotate-180" /> : <TrendingDown className="w-5 h-5" />
    }
    return <Minus className="w-5 h-5" />
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case "STRONG":
        return "text-purple-300 bg-purple-900/30 border-purple-600"
      case "MODERATE":
        return "text-blue-400 bg-blue-900/20 border-blue-700"
      default:
        return "text-gray-400 bg-gray-900/20 border-gray-700"
    }
  }

  const getConfidenceBar = (confidence: number) => {
    const width = Math.max(confidence || 0, 10)
    let colorClass = "bg-gray-500"
    let glowClass = ""
    
    if (confidence >= 80) {
      colorClass = "bg-gradient-to-r from-green-500 to-green-400"
      glowClass = "shadow-lg shadow-green-500/50"
    } else if (confidence >= 70) {
      colorClass = "bg-gradient-to-r from-blue-500 to-blue-400"
      glowClass = "shadow-md shadow-blue-500/30"
    } else if (confidence >= 60) {
      colorClass = "bg-gradient-to-r from-yellow-500 to-yellow-400"
    } else if (confidence >= 50) {
      colorClass = "bg-gradient-to-r from-orange-500 to-orange-400"
    } else {
      colorClass = "bg-gradient-to-r from-red-500 to-red-400"
    }

    return (
      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div 
          className={`h-3 rounded-full transition-all duration-500 ${colorClass} ${glowClass}`} 
          style={{ width: `${width}%` }} 
        />
      </div>
    )
  }

  const getProbabilityIndicator = (probability: number) => {
    if (probability >= 70) return { icon: "🎯", color: "text-green-400", label: "HIGH" }
    if (probability >= 55) return { icon: "📊", color: "text-blue-400", label: "GOOD" }
    if (probability >= 40) return { icon: "⚖️", color: "text-yellow-400", label: "FAIR" }
    return { icon: "⚠️", color: "text-red-400", label: "LOW" }
  }

  const getActionText = (action: string, strength: string) => {
    if (action === "BUY") {
      if (strength === "STRONG") return "🚀 STRONG BUY"
      if (strength === "MODERATE") return "📈 BUY"
      return "↗️ WEAK BUY"
    } else if (action === "SELL") {
      if (strength === "STRONG") return "💥 STRONG SELL"
      if (strength === "MODERATE") return "📉 SELL"
      return "↘️ WEAK SELL"
    }
    return "⏸️ HOLD"
  }

  const isSignalFresh = (timestamp: number) => {
    return Date.now() - timestamp < 300000 // 5 minutes
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <span>⚡ Scalping Signal Analysis</span>
        </h3>
        <div className="text-xs text-gray-400">
          Real-time • Auto-refresh
        </div>
      </div>
      
      <div className="space-y-4">
        {signals.map((signal, index) => {
          const probabilityInfo = getProbabilityIndicator(signal.probability || 0)
          const isFresh = isSignalFresh(signal.timestamp || Date.now())
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 relative overflow-hidden ${getSignalColor(signal.action, signal.strength)} ${
                isFresh ? 'animate-pulse-slow' : ''
              }`}
            >
              {/* Fresh signal indicator */}
              {isFresh && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {getSignalIcon(signal.action, signal.strength)}
                    <span className="font-bold text-lg">
                      {getActionText(signal.action, signal.strength)}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStrengthColor(signal.strength)}`}>
                    {signal.strength}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 text-sm">
                  <span className={probabilityInfo.color}>
                    {probabilityInfo.icon} {probabilityInfo.label}
                  </span>
                  <span className="text-gray-300">
                    {signal.probability || 0}%
                  </span>
                </div>
              </div>

              {/* Confidence bar with enhanced styling */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Signal Confidence</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-bold">{signal.confidence || 0}%</span>
                    {(signal.confidence || 0) >= 80 && <span className="text-green-400">🔥</span>}
                  </div>
                </div>
                {getConfidenceBar(signal.confidence)}
              </div>

              {/* Enhanced analysis section */}
              <div className="text-sm opacity-90 mb-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="text-white">Analysis:</strong>
                    <span className="ml-2">{signal.reason || "No analysis available"}</span>
                  </div>
                </div>
              </div>

              {/* Enhanced price levels */}
              {signal.action !== "HOLD" && (
                <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                  <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <div className="flex items-center space-x-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300 font-medium">Entry Point</span>
                    </div>
                    <div className="font-bold text-green-400">
                      ${(signal.entry_price || 0).toFixed(symbol?.priceDecimals || 5)}
                    </div>
                  </div>
                  
                  <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 hover:border-red-500 transition-colors">
                    <div className="flex items-center space-x-2 mb-1">
                      <Shield className="w-4 h-4 text-red-400" />
                      <span className="text-gray-300 font-medium">Stop Loss</span>
                    </div>
                    <div className="font-bold text-red-400">
                      ${(signal.stop_loss || 0).toFixed(symbol?.priceDecimals || 5)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Risk: {(((Math.abs(signal.entry_price - signal.stop_loss) / signal.entry_price) * 100) || 0).toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors">
                    <div className="flex items-center space-x-2 mb-1">
                      <Target className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300 font-medium">Take Profit</span>
                    </div>
                    <div className="font-bold text-blue-400">
                      ${(signal.take_profit || 0).toFixed(symbol?.priceDecimals || 5)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Reward: {(((Math.abs(signal.take_profit - signal.entry_price) / signal.entry_price) * 100) || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}

              {/* Risk/Reward ratio */}
              {signal.action !== "HOLD" && (
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3 p-2 bg-gray-900/40 rounded">
                  <span>Risk/Reward Ratio:</span>
                  <span className="font-bold text-white">
                    1:{(Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss) || 0).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Timestamp with enhanced styling */}
              <div className="flex items-center justify-between text-xs">
                <div className={`px-2 py-1 rounded-full ${isFresh ? 'bg-green-900/30 text-green-400' : 'bg-gray-900/30 text-gray-400'}`}>
                  {isFresh ? '🔴 LIVE' : '📅'} {new Date(signal.timestamp || Date.now()).toLocaleTimeString("vi-VN")}
                </div>
                
                {signal.action !== "HOLD" && (
                  <div className="text-gray-500">
                    Scalping • Quick Entry/Exit
                  </div>
                )}
              </div>

              {/* Action urgency indicator */}
              {signal.strength === "STRONG" && signal.confidence >= 75 && (
                <div className="mt-3 p-2 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded border border-purple-700/50">
                  <div className="flex items-center space-x-2 text-sm">
                    <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                    <span className="font-bold text-yellow-400">HIGH PRIORITY SIGNAL</span>
                    <span className="text-purple-300">• Act Fast</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}