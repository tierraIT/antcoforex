import { ProcessedCandle, TechnicalIndicators, TradingSignal, MarketAnalysis, TradingSymbol } from '../types/trading';

// Helper class for array calculations
class ArrayHelper {
    static last<T>(arr: T[], index: number = 1): T | undefined {
        return arr[arr.length - index];
    }
}

export class TechnicalAnalyzer {

    // Calculate Simple Moving Average
    static calculateSMA(data: number[], period: number): number {
        if (data.length < period) return 0;
        const slice = data.slice(-period);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / period;
    }

    // Calculate Exponential Moving Average
    static calculateEMA(data: number[], period: number): number {
        if (data.length < period) return 0;
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(data.slice(0, period), period); // Initial EMA is an SMA
        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        return ema;
    }

    // Calculate Volume-Weighted Average Price (VWAP)
    static calculateVWAP(candles: ProcessedCandle[], period: number = 20): number {
        if (candles.length < period) return 0;
        const slice = candles.slice(-period);
        let cumulativeTPV = 0;
        let cumulativeVolume = 0;
        slice.forEach(c => {
            const typicalPrice = (c.high + c.low + c.close) / 3;
            cumulativeTPV += typicalPrice * c.volume;
            cumulativeVolume += c.volume;
        });
        return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
    }


    // Calculate Relative Strength Index (RSI)
    static calculateRSI(closes: number[], period: number = 14): number {
        if (closes.length <= period) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff >= 0) {
                gains += diff;
            } else {
                losses -= diff;
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // Detect RSI Divergence
    static detectRSIDivergence(candles: ProcessedCandle[], rsiHistory: number[]): 'BULLISH' | 'BEARISH' | 'NONE' {
        if (candles.length < 15 || rsiHistory.length < 15) return 'NONE';

        const lastCandle = ArrayHelper.last(candles, 1)!;
        const prevCandle = ArrayHelper.last(candles, 5)!; // Look back 5 candles
        const lastRSI = ArrayHelper.last(rsiHistory, 1)!;
        const prevRSI = ArrayHelper.last(rsiHistory, 5)!;

        // Bullish Divergence: Lower low in price, but higher low in RSI
        if (lastCandle.low < prevCandle.low && lastRSI > prevRSI) {
            return 'BULLISH';
        }

        // Bearish Divergence: Higher high in price, but lower high in RSI
        if (lastCandle.high > prevCandle.high && lastRSI < prevRSI) {
            return 'BEARISH';
        }

        return 'NONE';
    }


    // Calculate MACD
    static calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
        if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macdLine = ema12 - ema26;

        const macdHistory = [];
        for (let i = 26; i <= closes.length; i++) {
            const slice = closes.slice(0, i);
            const ema12_i = this.calculateEMA(slice, 12);
            const ema26_i = this.calculateEMA(slice, 26);
            macdHistory.push(ema12_i - ema26_i);
        }

        const signalLine = this.calculateEMA(macdHistory, 9);
        const histogram = macdLine - signalLine;
        return { macd: macdLine, signal: signalLine, histogram };
    }

    // Calculate Average True Range
    static calculateATR(candles: ProcessedCandle[], period: number = 14): number {
        if (candles.length < period + 1) return 0;
        const trueRanges: number[] = [];
        for (let i = candles.length - period; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;
            const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
            trueRanges.push(tr);
        }
        return this.calculateSMA(trueRanges, period);
    }

    // Calculate Bollinger Bands
    static calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2) {
        if (closes.length < period) return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
        const middle = this.calculateSMA(closes, period);
        const slice = closes.slice(-period);
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        const upper = middle + (standardDeviation * stdDev);
        const lower = middle - (standardDeviation * stdDev);
        const bandwidth = (upper - lower) / middle;
        return { upper, middle, lower, bandwidth };
    }
    
    // Calculate Stochastic Oscillator
    static calculateStochastic(candles: ProcessedCandle[], kPeriod: number = 14, dPeriod: number = 3) {
        if (candles.length < kPeriod) return { k: 50, d: 50 };

        const kValues: number[] = [];
        for (let i = candles.length - kPeriod - dPeriod + 1; i < candles.length; i++) {
            const slice = candles.slice(i, i + kPeriod);
            const currentClose = slice[slice.length - 1].close;
            const lowestLow = Math.min(...slice.map(c => c.low));
            const highestHigh = Math.max(...slice.map(c => c.high));
            if (highestHigh === lowestLow) {
                 kValues.push(50);
            } else {
                 kValues.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
            }
        }
        
        const k = ArrayHelper.last(kValues, 1) || 50;
        const d = this.calculateSMA(kValues.slice(-dPeriod), dPeriod);

        return { k, d };
    }

    // Main analysis function to get all indicators
    static getTechnicalIndicators(candles: ProcessedCandle[]): TechnicalIndicators {
        if (candles.length < 50) {
             return {
                sma20: 0, sma50: 0, ema12: 0, ema26: 0, rsi: 50,
                macd: 0, macdSignal: 0, macdHistogram: 0, atr: 0,
                volume: 0, avgVolume: 0, trend: 'UNDEFINED', momentum: 'UNDEFINED',
                bollinger: { upper: 0, middle: 0, lower: 0, bandwidth: 0 },
                stochastic: { k: 50, d: 50 }, vwap: 0
            };
        }

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const currentPrice = ArrayHelper.last(closes)!;
        
        const rsiHistory = candles.map((_, i) => {
            if (i < 14) return 50;
            return this.calculateRSI(closes.slice(0, i + 1));
        });

        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const rsi = ArrayHelper.last(rsiHistory)!;
        const macdData = this.calculateMACD(closes);
        const atr = this.calculateATR(candles);
        const bollinger = this.calculateBollingerBands(closes);
        const stochastic = this.calculateStochastic(candles);
        const vwap = this.calculateVWAP(candles);

        const currentVolume = ArrayHelper.last(volumes)!;
        const avgVolume = this.calculateSMA(volumes, 20);

        let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED' = 'SIDEWAYS';
        if (currentPrice > sma50 && ema12 > ema26 && sma20 > sma50) {
            trend = 'BULLISH';
        } else if (currentPrice < sma50 && ema12 < ema26 && sma20 < sma50) {
            trend = 'BEARISH';
        }

        let momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED' = 'NEUTRAL';
        if (rsi > 60 && macdData.histogram > 0) momentum = 'UP';
        if (rsi > 70 && macdData.histogram > 0) momentum = 'STRONG_UP';
        if (rsi < 40 && macdData.histogram < 0) momentum = 'DOWN';
        if (rsi < 30 && macdData.histogram < 0) momentum = 'STRONG_DOWN';
        
        return {
            sma20, sma50, ema12, ema26, rsi, ...macdData, atr,
            volume: currentVolume,
            avgVolume,
            trend,
            momentum,
            bollinger,
            stochastic,
            vwap,
            rsiHistory
        };
    }

    // Analyze market to generate trading signals
    static analyzeMarket(candles: ProcessedCandle[], symbol: TradingSymbol): MarketAnalysis {
        const indicators = this.getTechnicalIndicators(candles);
        if (!indicators || indicators.trend === 'UNDEFINED') {
            return { indicators, signals: [{ action: 'HOLD', reason: 'Insufficient data', confidence: 0, probability: 0, strength: 'WEAK', timestamp: Date.now(), entry_price: 0, stop_loss: 0, take_profit: 0 }] };
        }

        const currentCandle = ArrayHelper.last(candles)!;
        const currentPrice = currentCandle.close;
        const atr = indicators.atr;
        const signals: TradingSignal[] = [];
        
        let confidence = 0;
        let probability = 0;
        let reasons: string[] = [];

        const rsiDivergence = this.detectRSIDivergence(candles, indicators.rsiHistory!);

        // --- SCALPING STRATEGIES ---

        // 1. Bollinger Band Reversal Strategy
        if (currentPrice > indicators.bollinger.upper && indicators.rsi > 70) {
            confidence += 30;
            probability += 35;
            reasons.push("BB Upper Hit & RSI Overbought");
        }
        if (currentPrice < indicators.bollinger.lower && indicators.rsi < 30) {
            confidence += 30;
            probability += 35;
            reasons.push("BB Lower Hit & RSI Oversold");
        }

        // 2. EMA Bounce Strategy (Trend Following)
        const pullBackLow = currentCandle.low < indicators.ema12 && currentPrice > indicators.ema12;
        if (indicators.trend === 'BULLISH' && pullBackLow && indicators.stochastic.k > indicators.stochastic.d) {
            confidence += 40;
            probability += 45;
            reasons.push("EMA12 Bounce in Uptrend");
        }
        const pullBackHigh = currentCandle.high > indicators.ema12 && currentPrice < indicators.ema12;
        if (indicators.trend === 'BEARISH' && pullBackHigh && indicators.stochastic.k < indicators.stochastic.d) {
            confidence += 40;
            probability += 45;
            reasons.push("EMA12 Rejection in Downtrend");
        }

        // 3. RSI Divergence Strategy
        if (rsiDivergence === 'BULLISH') {
            confidence += 50;
            probability += 50;
            reasons.push("Bullish RSI Divergence");
        }
        if (rsiDivergence === 'BEARISH') {
            confidence += 50;
            probability += 50;
            reasons.push("Bearish RSI Divergence");
        }

        // 4. VWAP Cross Strategy
        const prevPrice = ArrayHelper.last(candles, 2)!.close;
        if (prevPrice < indicators.vwap && currentPrice > indicators.vwap && indicators.volume > indicators.avgVolume) {
            confidence += 35;
            probability += 30;
            reasons.push("VWAP Cross Up w/ Volume");
        }
        if (prevPrice > indicators.vwap && currentPrice < indicators.vwap && indicators.volume > indicators.avgVolume) {
            confidence += 35;
            probability += 30;
            reasons.push("VWAP Cross Down w/ Volume");
        }
        
        // 5. Bollinger Band Squeeze Breakout
        const isSqueeze = indicators.bollinger.bandwidth < this.calculateSMA(candles.map((c,i) => this.calculateBollingerBands(candles.slice(0,i+1).map(c=>c.close)).bandwidth), 20) * 0.8;
        if(isSqueeze && currentPrice > indicators.bollinger.upper) {
            confidence += 60;
            probability += 55;
            reasons.push("Bollinger Squeeze Breakout Up");
        }
        if(isSqueeze && currentPrice < indicators.bollinger.lower) {
            confidence += 60;
            probability += 55;
            reasons.push("Bollinger Squeeze Breakout Down");
        }

        // --- DECISION LOGIC ---
        if (reasons.length > 0) {
            const isBuySignal = reasons.some(r => r.includes("Up") || r.includes("Bullish") || r.includes("Oversold"));
            const isSellSignal = reasons.some(r => r.includes("Down") || r.includes("Bearish") || r.includes("Overbought"));

            let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

            if (isBuySignal && !isSellSignal) action = 'BUY';
            if (isSellSignal && !isBuySignal) action = 'SELL';
            // If conflicting signals, remain neutral
            if (isBuySignal && isSellSignal) {
                action = 'HOLD';
                reasons.push("Conflicting Signals");
            }

            if (action !== 'HOLD') {
                const strength = confidence > 75 ? 'STRONG' : (confidence > 40 ? 'MODERATE' : 'WEAK');
                signals.push({
                    action,
                    confidence: Math.min(100, confidence),
                    probability: Math.min(100, probability),
                    strength,
                    reason: reasons.join(' | '),
                    timestamp: Date.now(),
                    entry_price: currentPrice,
                    stop_loss: action === 'BUY' ? currentPrice - (atr * 2) : currentPrice + (atr * 2),
                    take_profit: action === 'BUY' ? currentPrice + (atr * 3) : currentPrice - (atr * 3)
                });
            }
        }

        if (signals.length === 0) {
            signals.push({
                action: 'HOLD',
                reason: 'No clear setup',
                confidence: 0,
                probability: 0,
                strength: 'WEAK',
                timestamp: Date.now(),
                entry_price: currentPrice,
                stop_loss: 0,
                take_profit: 0
            });
        }

        return {
            indicators,
            signals: signals.sort((a, b) => b.confidence - a.confidence) // Strongest signal first
        };
    }
}