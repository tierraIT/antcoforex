"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, AlertTriangle, Wifi, WifiOff } from "lucide-react";

// --- TYPE DEFINITIONS (from @/types/trading) ---
interface Candlestick {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

interface TradingSymbol {
  id: string;
  displayName: string;
  binanceSymbol: string;
  interval: string;
  minCandles: number;
}

interface TradingSignal {
  action: "BUY" | "SELL" | "HOLD" | "WAIT";
  strength: "STRONG" | "MODERATE" | "WEAK";
  confidence: number;
  probability: number;
  reason: string;
  timestamp: number;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
}

interface MarketAnalysis {
  symbol: TradingSymbol;
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  volatility: "HIGH" | "MEDIUM" | "LOW";
  summary: string;
  signals: TradingSignal[];
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface TechnicalIndicators {
    rsi: number | null;
    macd: { macd: number; signal: number; histogram: number; } | null;
    bollingerBands: { upper: number; middle: number; lower: number; } | null;
    stochastic: { k: number; d: number; } | null;
    volume: number;
}


// --- CONFIG (from @/config/symbols) ---
const SYMBOLS: TradingSymbol[] = [
    { id: 'BTCUSDT_1m', displayName: 'BTC/USDT (1m)', binanceSymbol: 'BTCUSDT', interval: '1m', minCandles: 30 },
    { id: 'ETHUSDT_1m', displayName: 'ETH/USDT (1m)', binanceSymbol: 'ETHUSDT', interval: '1m', minCandles: 30 },
    { id: 'XAUUSD_1m', displayName: 'GOLD/USD (1m)', binanceSymbol: 'XAUUSDT', interval: '1m', minCandles: 30 },
    { id: 'BTCUSDT_5m', displayName: 'BTC/USDT (5m)', binanceSymbol: 'BTCUSDT', interval: '5m', minCandles: 30 },
    { id: 'ETHUSDT_5m', displayName: 'ETH/USDT (5m)', binanceSymbol: 'ETHUSDT', interval: '5m', minCandles: 30 },
];
const DEFAULT_SYMBOL = SYMBOLS[0];


// --- UTILITIES (from @/utils/technicalAnalysis) ---
class TechnicalAnalyzer {
    private static calculateSMA(data: number[], period: number): number[] {
        let result: number[] = [];
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }
        return result;
    }

    private static calculateEMA(data: number[], period: number): number[] {
        const k = 2 / (period + 1);
        let emaArray = [data.slice(0, period).reduce((a, b) => a + b, 0) / period];
        for (let i = period; i < data.length; i++) {
            emaArray.push(data[i] * k + emaArray[emaArray.length - 1] * (1 - k));
        }
        return emaArray;
    }
    
    public static getTechnicalIndicators(candles: Candlestick[]): TechnicalIndicators {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        const rsi = this.calculateRSI(closes, 14);
        const macd = this.calculateMACD(closes, 12, 26, 9);
        const bb = this.calculateBollingerBands(closes, 20, 2);
        const stoch = this.calculateStochastic(closes, highs, lows, 14, 3, 3);
        
        return {
            rsi: rsi ? rsi[rsi.length - 1] : null,
            macd: macd ? { macd: macd.macd[macd.macd.length - 1], signal: macd.signal[macd.signal.length -1], histogram: macd.histogram[macd.histogram.length - 1] } : null,
            bollingerBands: bb ? { upper: bb.upper[bb.upper.length - 1], middle: bb.middle[bb.middle.length - 1], lower: bb.lower[bb.lower.length - 1] } : null,
            stochastic: stoch ? { k: stoch.k[stoch.k.length - 1], d: stoch.d[stoch.d.length-1] } : null,
            volume: candles[candles.length - 1].volume,
        };
    }

    private static calculateRSI(data: number[], period: number) {
        if (data.length < period + 1) return null;
        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const diff = data[i] - data[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rsi = [100 - (100 / (1 + avgGain / avgLoss))];

        for (let i = period + 1; i < data.length; i++) {
            const diff = data[i] - data[i - 1];
            let currentGain = 0;
            let currentLoss = 0;

            if (diff > 0) currentGain = diff;
            else currentLoss = -diff;

            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
            
            if (avgLoss === 0) {
              rsi.push(100);
            } else {
              const rs = avgGain / avgLoss;
              rsi.push(100 - (100 / (1 + rs)));
            }
        }
        return rsi;
    }

    private static calculateMACD(data: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) {
        if (data.length < slowPeriod) return null;
        const emaFast = this.calculateEMA(data, fastPeriod);
        const emaSlow = this.calculateEMA(data, slowPeriod);
        const macd = emaFast.slice(emaSlow.length - emaFast.length).map((f, i) => f - emaSlow[i]);
        const signal = this.calculateEMA(macd, signalPeriod);
        const histogram = macd.slice(signal.length - macd.length).map((m, i) => m - signal[i]);
        return { macd, signal, histogram };
    }

    private static calculateBollingerBands(data: number[], period: number, stdDev: number) {
        if (data.length < period) return null;
        const middle = this.calculateSMA(data, period);
        const stdDevs = [];
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const mean = middle[i - period + 1];
            const sqDiff = slice.map(d => Math.pow(d - mean, 2)).reduce((a, b) => a + b, 0);
            stdDevs.push(Math.sqrt(sqDiff / period));
        }
        const upper = middle.map((m, i) => m + stdDevs[i] * stdDev);
        const lower = middle.map((m, i) => m - stdDevs[i] * stdDev);
        return { upper, middle, lower };
    }

    private static calculateStochastic(closes: number[], highs: number[], lows: number[], kPeriod: number, kSlowing: number, dPeriod: number) {
        if (closes.length < kPeriod) return null;
        const percentK = [];
        for (let i = kPeriod - 1; i < closes.length; i++) {
            const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
            const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
            const lowestLow = Math.min(...sliceLows);
            const highestHigh = Math.max(...sliceHighs);
            percentK.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
        }
        const smoothedK = this.calculateSMA(percentK, kSlowing);
        const d = this.calculateSMA(smoothedK, dPeriod);
        return { k: smoothedK, d };
    }

    public static analyzeMarket(candles: Candlestick[], symbol: TradingSymbol): MarketAnalysis {
        if (candles.length < symbol.minCandles) {
            return {
                symbol,
                trend: "SIDEWAYS",
                volatility: "LOW",
                summary: "Insufficient data for analysis.",
                signals: [{ action: "WAIT", strength: "WEAK", confidence: 0, probability: 0, reason: "Waiting for more data.", timestamp: Date.now() }]
            };
        }

        const indicators = this.getTechnicalIndicators(candles);
        const lastCandle = candles[candles.length - 1];
        let signals: TradingSignal[] = [];

        // Simple Trend Analysis
        const sma50 = this.calculateSMA(candles.map(c => c.close), 50);
        const sma200 = this.calculateSMA(candles.map(c => c.close), 200);
        let trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS" = "SIDEWAYS";
        if (sma50.length > 0 && sma200.length > 0) {
            if (sma50[sma50.length - 1] > sma200[sma200.length - 1]) trend = "UPTREND";
            else trend = "DOWNTREND";
        }

        // Signal Generation Logic (simplified example)
        let action: "BUY" | "SELL" | "HOLD" = "HOLD";
        let reason = "Market conditions are neutral.";
        let confidence = 50;
        let probability = 50;
        let strength: "STRONG" | "MODERATE" | "WEAK" = "WEAK";

        if (indicators.rsi !== null && indicators.macd !== null && indicators.bollingerBands !== null && indicators.stochastic !== null) {
            // Buy Signal
            if (indicators.rsi < 35 && indicators.stochastic.k < 25 && indicators.stochastic.k > indicators.stochastic.d && lastCandle.close > indicators.bollingerBands.lower) {
                action = "BUY";
                reason = "RSI and Stochastic are oversold, indicating a potential reversal.";
                confidence = 65;
                probability = 60;
                strength = "MODERATE";
            }
            // Sell Signal
            if (indicators.rsi > 65 && indicators.stochastic.k > 75 && indicators.stochastic.k < indicators.stochastic.d && lastCandle.close < indicators.bollingerBands.upper) {
                action = "SELL";
                reason = "RSI and Stochastic are overbought, indicating a potential reversal.";
                confidence = 65;
                probability = 60;
                strength = "MODERATE";
            }
            
            // Strong Buy
            if (action === "BUY" && indicators.macd.histogram > 0 && trend === "UPTREND") {
                strength = "STRONG";
                confidence = 80;
                probability = 75;
                reason += " MACD confirms upward momentum in an uptrend.";
            }

            // Strong Sell
            if (action === "SELL" && indicators.macd.histogram < 0 && trend === "DOWNTREND") {
                strength = "STRONG";
                confidence = 80;
                probability = 75;
                reason += " MACD confirms downward momentum in a downtrend.";
            }
        }
        
        // Doji Detection
        const bodySize = Math.abs(lastCandle.open - lastCandle.close);
        const range = lastCandle.high - lastCandle.low;
        if (range > 0 && bodySize / range < 0.1) {
            reason = "Doji pattern detected, potential reversal. " + reason;
            confidence = Math.min(100, confidence + 10);
        }

        const stopLoss = action === "BUY" ? lastCandle.close * 0.98 : lastCandle.close * 1.02;
        const takeProfit = action === "BUY" ? lastCandle.close * 1.02 : lastCandle.close * 0.98;

        signals.push({ action, strength, confidence, probability, reason, timestamp: Date.now(), entry_price: lastCandle.close, stop_loss: stopLoss, take_profit: takeProfit });

        return {
            symbol,
            trend,
            volatility: "MEDIUM", // Simplified
            summary: reason,
            signals: signals.sort((a, b) => b.timestamp - a.timestamp)
        };
    }
}


// --- SERVICES (from @/services/telegramService) ---
class TelegramService {
  private config: TelegramConfig;
  private baseUrl: string;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
  }

  updateConfig(config: TelegramConfig) {
    this.config = config;
    this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
  }

  async sendTradingAlert(signal: TradingSignal, currentPrice: number): Promise<boolean> {
    if (!this.config.enabled || !this.config.botToken || !this.config.chatId) {
      return false;
    }
    
    const { action, strength, confidence, probability, reason, entry_price, stop_loss, take_profit } = signal;
    
    const icon = action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '⚪️';
    const strengthIcon = strength === 'STRONG' ? '🚀' : strength === 'MODERATE' ? '📈' : '⚠️';
    
    const message = `
*${strengthIcon} ${strength} ${action} SIGNAL*
*Symbol:* ${DEFAULT_SYMBOL.displayName}
*Action:* ${icon} *${action}*
*Price:* ${currentPrice.toFixed(2)}
*Confidence:* ${confidence.toFixed(1)}%
*Probability:* ${probability.toFixed(1)}%
*Reason:* _${reason}_

*Entry:* ${entry_price?.toFixed(2)}
*Stop Loss:* ${stop_loss?.toFixed(2)}
*Take Profit:* ${take_profit?.toFixed(2)}
`;

    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error("Telegram API Error:", error);
      return false;
    }
  }
}

// --- HOOKS (from @/hooks/useBinanceData) ---
const useBinanceData = (refreshInterval: number, symbol: TradingSymbol) => {
    const [candles, setCandles] = useState<Candlestick[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [isConnected, setIsConnected] = useState(true);
    const [fetchCount, setFetchCount] = useState(0);

    const refetch = () => setFetchCount(prev => prev + 1);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.binanceSymbol}&interval=${symbol.interval}&limit=250`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch data from Binance API: ${response.statusText}`);
                }
                const data = await response.json();
                const formattedCandles: Candlestick[] = data.map((d: any) => ({
                    openTime: d[0],
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5]),
                    closeTime: d[6],
                }));
                setCandles(formattedCandles);
                setError(null);
                setIsConnected(true);
                setLastUpdate(new Date());
            } catch (e: any) {
                setError(e.message);
                setIsConnected(false);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const intervalId = setInterval(fetchData, refreshInterval);

        return () => clearInterval(intervalId);
    }, [symbol, refreshInterval, fetchCount]);

    return { candles, loading, error, lastUpdate, isConnected, refetch };
};


// --- UI COMPONENTS (from @/components/*) ---

const SymbolSelector: React.FC<{ currentSymbol: TradingSymbol; onSymbolChange: (symbol: TradingSymbol) => void; }> = ({ currentSymbol, onSymbolChange }) => (
  <select
    value={currentSymbol.id}
    onChange={(e) => {
      const selected = SYMBOLS.find(s => s.id === e.target.value);
      if (selected) onSymbolChange(selected);
    }}
    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    {SYMBOLS.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}
  </select>
);

const PriceChart: React.FC<{ candles: Candlestick[], symbol: TradingSymbol, signals: TradingSignal[] }> = ({ candles, symbol, signals }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);

    useEffect(() => {
        const lightweightChartsCdn = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";
        let script = document.querySelector(`script[src="${lightweightChartsCdn}"]`) as HTMLScriptElement;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const initializeChart = () => {
            if (!window.LightweightCharts || !chartContainerRef.current) return;
            
            chartRef.current = window.LightweightCharts.createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: 400,
                layout: { backgroundColor: '#1f2937', textColor: '#d1d5db' },
                grid: { vertLines: { color: '#2d3748' }, horzLines: { color: '#2d3748' } },
                crosshair: { mode: window.LightweightCharts.CrosshairMode.Normal },
                rightPriceScale: { borderColor: '#4b5563' },
                timeScale: { borderColor: '#4b5563' },
            });

            const candlestickSeries = chartRef.current.addCandlestickSeries({
                upColor: '#22c55e', downColor: '#ef4444', borderDownColor: '#ef4444', borderUpColor: '#22c55e',
                wickDownColor: '#ef4444', wickUpColor: '#22c55e',
            });

            const volumeSeries = chartRef.current.addHistogramSeries({
                color: '#2d3748', priceFormat: { type: 'volume' }, priceScaleId: 'volume_scale'
            });
            chartRef.current.priceScale('volume_scale').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
            
            window.addEventListener('resize', handleResize);
        }

        if (!script) {
            script = document.createElement('script');
            script.src = lightweightChartsCdn;
            script.async = true;
            script.onload = initializeChart;
            document.body.appendChild(script);
        } else {
            initializeChart();
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (chartRef.current && candles.length > 0) {
            const candlestickSeries = chartRef.current.serieses().find((s: any) => s.seriesType() === 'Candlestick');
            const volumeSeries = chartRef.current.serieses().find((s: any) => s.seriesType() === 'Histogram');
            
            if (candlestickSeries) {
                const data = candles.map(c => ({ time: c.closeTime / 1000, open: c.open, high: c.high, low: c.low, close: c.close }));
                candlestickSeries.setData(data);

                const markers = signals.filter(s => s.action === 'BUY' || s.action === 'SELL')
                    .map(s => {
                        const candle = candles.find(c => c.closeTime < s.timestamp)?.closeTime;
                        return {
                            time: (candle || s.timestamp) / 1000,
                            position: s.action === 'BUY' ? 'belowBar' : 'aboveBar',
                            color: s.action === 'BUY' ? '#22c55e' : '#ef4444',
                            shape: s.action === 'BUY' ? 'arrowUp' : 'arrowDown',
                            text: `${s.action} @ ${s.entry_price?.toFixed(2)}`
                        };
                    });
                candlestickSeries.setMarkers(markers);
            }
            if (volumeSeries) {
                const volData = candles.map(c => ({
                    time: c.closeTime / 1000,
                    value: c.volume,
                    color: c.close > c.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                }));
                volumeSeries.setData(volData);
            }
            chartRef.current.timeScale().fitContent();
        }
    }, [candles, signals]);

    return <div ref={chartContainerRef} className="w-full h-[400px]" />;
};


const MarketOverview: React.FC<{ analysis: MarketAnalysis | null, indicators: TechnicalIndicators | null, symbol: TradingSymbol, currentPrice: number, priceChange: number }> = ({ analysis, indicators, symbol, currentPrice, priceChange }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-full">
        <h2 className="text-xl font-bold mb-4">Market Overview</h2>
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Price ({symbol.displayName})</span>
                <span className={`text-lg font-bold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-gray-400">Trend</span>
                <span className="font-semibold">{analysis?.trend}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-gray-400">RSI (14)</span>
                <span className="font-semibold">{indicators?.rsi?.toFixed(2) ?? 'N/A'}</span>
            </div>
             <div className="flex justify-between items-center">
                <span className="text-gray-400">Stochastic %K</span>
                <span className="font-semibold">{indicators?.stochastic?.k.toFixed(2) ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-gray-400">MACD Hist</span>
                <span className="font-semibold">{indicators?.macd?.histogram.toFixed(4) ?? 'N/A'}</span>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold mb-2">AI Summary</h3>
                <p className="text-sm text-gray-300">{analysis?.summary}</p>
            </div>
        </div>
    </div>
);

const TradingSignals: React.FC<{ signals: TradingSignal[], symbol: TradingSymbol }> = ({ signals, symbol }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Latest Trading Signal</h2>
        {signals.length > 0 ? (
            <div className="space-y-4">
                {signals.slice(0, 1).map((signal, index) => (
                    <div key={index} className="bg-gray-900 p-4 rounded-md">
                        <div className="flex justify-between items-center">
                            <span className={`text-lg font-bold ${signal.action === 'BUY' ? 'text-green-400' : signal.action === 'SELL' ? 'text-red-400' : 'text-yellow-400'}`}>
                                {signal.strength} {signal.action}
                            </span>
                            <span className="text-sm text-gray-400">{new Date(signal.timestamp).toLocaleTimeString('vi-VN')}</span>
                        </div>
                        <p className="text-sm mt-2 text-gray-300">{signal.reason}</p>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                            <span>Confidence: <span className="font-semibold">{signal.confidence.toFixed(1)}%</span></span>
                            <span>Probability: <span className="font-semibold">{signal.probability.toFixed(1)}%</span></span>
                        </div>
                    </div>
                ))}
            </div>
        ) : <p>No signals generated yet.</p>}
    </div>
);

const TelegramSettings: React.FC<{ config: TelegramConfig, onConfigChange: (config: TelegramConfig) => void, onTestMessage: () => void }> = ({ config, onConfigChange, onTestMessage }) => (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-2">Telegram Notifications</h2>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bot Token</label>
                <input type="password" value={config.botToken} onChange={e => onConfigChange({ ...config, botToken: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Chat ID</label>
                <input type="text" value={config.chatId} onChange={e => onConfigChange({ ...config, chatId: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={config.enabled} onChange={e => onConfigChange({ ...config, enabled: e.target.checked })} className="form-checkbox h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                    <span className="text-gray-300">Enable Notifications</span>
                </label>
                <button onClick={onTestMessage} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm">Send Test</button>
            </div>
        </div>
    </div>
);


// --- MAIN PAGE COMPONENT ---
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
    if (success) {
      alert("🎯 Test message sent successfully! Check your Telegram.")
    } else {
      alert("❌ Failed to send test message. Please check your configuration.")
    }
  }, [telegramService, candles, currentSymbol])

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

    const isStrongSignal = currentSignal.strength === 'STRONG'
    const isModerateSignal = currentSignal.strength === 'MODERATE'
    const isWeakButHighConfidence = currentSignal.strength === 'WEAK' && currentSignal.confidence >= 70
    const isActionable = currentSignal.action === "BUY" || currentSignal.action === "SELL"
    
    const meetsProbabilityThreshold = currentSignal.probability >= 35
    const meetsConfidenceThreshold = currentSignal.confidence >= 55
    
    const cooldownPassed = timeSinceLastSignal > 45000
    const quickCooldownPassed = timeSinceLastSignal > 15000

    if (telegramConfig.enabled) {
        const shouldSendStrong = isStrongSignal && isActionable && meetsProbabilityThreshold && meetsConfidenceThreshold && cooldownPassed
        const shouldSendModerate = isModerateSignal && isActionable && currentSignal.probability >= 45 && currentSignal.confidence >= 65 && cooldownPassed
        const shouldSendWeakHigh = isWeakButHighConfidence && isActionable && meetsProbabilityThreshold && cooldownPassed
        const shouldSendSignalChange = signalChanged && isActionable && currentSignal.confidence >= 60 && quickCooldownPassed
        
        const shouldSend = shouldSendStrong || shouldSendModerate || shouldSendWeakHigh || shouldSendSignalChange

        if (shouldSend) {
            let enhancedSignal = { ...currentSignal }
            if (shouldSendSignalChange) enhancedSignal.reason = `🔄 SIGNAL CHANGE: ${currentSignal.reason}`
            else if (shouldSendStrong) enhancedSignal.reason = `🚀 STRONG SIGNAL: ${currentSignal.reason}`
            else if (shouldSendModerate) enhancedSignal.reason = `📈 MODERATE SIGNAL: ${currentSignal.reason}`
            else if (shouldSendWeakHigh) enhancedSignal.reason = `⚡ HIGH CONFIDENCE: ${currentSignal.reason}`

            telegramService.sendTradingAlert(enhancedSignal, currentPrice).then((success) => {
                if (success) {
                    setLastSignalSent(Date.now())
                    setLastSignalHash(currentSignalHash)
                }
            })
        } else {
            if(currentSignalHash !== lastSignalHash) setLastSignalHash(currentSignalHash)
        }
    }

    if (isStrongSignal && isActionable && currentSignal.reason && currentSignal.reason.toLowerCase().includes('doji')) {
        fetch('/api/trading-signals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSignal),
        }).then(response => {
            if (response.ok) console.log('🎯 STRONG Doji signal sent to MT5 API');
            else console.error('Failed to send signal to MT5 API, status:', response.status);
        }).catch(error => console.error('Failed to send signal to API:', error));
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
          <button onClick={refetch} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto">
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

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">⚡ Lụm lúa cùng Tiến Anh - Scalping Pro</h1>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-gray-400 text-sm">Enhanced Scalping AI</p>
              {telegramConfig.enabled && (
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-xs text-blue-400">Telegram Active</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <SymbolSelector currentSymbol={currentSymbol} onSymbolChange={handleSymbolChange} />
            </div>
            <div className="flex items-center justify-end space-x-2 mb-2">
              {isConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className={`text-xs ${isConnected ? "text-green-400" : "text-red-400"}`}>{isConnected ? "LIVE" : "OFFLINE"}</span>
            </div>
            <div className="text-sm text-gray-400">Last Update: {lastUpdate.toLocaleTimeString('vi-VN')}</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700">
            <PriceChart candles={candles.slice(-100)} symbol={currentSymbol} signals={analysis?.signals || []} />
          </div>
          <div>
            <MarketOverview analysis={analysis} indicators={indicators} symbol={currentSymbol} currentPrice={currentPrice} priceChange={priceChange} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <TradingSignals signals={analysis?.signals || []} symbol={currentSymbol} />
          <TelegramSettings config={telegramConfig} onConfigChange={handleTelegramConfigChange} onTestMessage={handleTestMessage} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <div className="text-2xl flex-shrink-0 mt-0.5">🚀</div>
                    <div>
                        <h3 className="text-blue-400 font-semibold mb-2">Enhanced Scalping Notifications</h3>
                        <div className="text-blue-100 text-sm leading-relaxed space-y-1">
                            <p>• 🔥 <strong>STRONG signals</strong>: Confidence ≥55%, Probability ≥35%</p>
                            <p>• 📈 <strong>MODERATE signals</strong>: Confidence ≥65%, Probability ≥45%</p>
                            <p>• ⚡ <strong>HIGH CONFIDENCE</strong>: Weak signals with 70%+ confidence</p>
                            <p>• 🔄 <strong>SIGNAL CHANGES</strong>: Quick alerts on direction shifts (15s cooldown)</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-yellow-400 font-semibold mb-2">Scalping Risk Warning</h3>
                        <div className="text-yellow-100 text-sm leading-relaxed space-y-1">
                            <p>🎯 <strong>Strategy</strong>: Quick in, quick out - set tight stops!</p>
                            <p>💰 <strong>Position Size</strong>: Never risk more than 1-2% per trade.</p>
                            <p>🚫 <strong>Tham Lam Warning</strong>: Lương của mày chỉ được 500 cành / ngày...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}
