import { ProcessedCandle, TechnicalIndicators, TradingSignal, MarketAnalysis, TradingSymbol } from '../types/trading';

export class TechnicalAnalyzer {
    // Simple Moving Average
    static calculateSMA(data: number[], period: number): number {
        if (data.length < period) return 0;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    // Exponential Moving Average
    static calculateEMA(data: number[], period: number): number {
        if (data.length < period) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(data.slice(0, period), period);
        
        for (let i = period; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    // Relative Strength Index
    static calculateRSI(closes: number[], period: number = 14): number {
        if (closes.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        // Calculate RSI using Wilder's smoothing
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;

            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // MACD (Moving Average Convergence Divergence)
    static calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
        if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };

        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const macd = ema12 - ema26;

        // Calculate MACD line for signal calculation
        const macdLine: number[] = [];
        for (let i = 25; i < closes.length; i++) {
            const slice = closes.slice(0, i + 1);
            const ema12_i = this.calculateEMA(slice, 12);
            const ema26_i = this.calculateEMA(slice, 26);
            macdLine.push(ema12_i - ema26_i);
        }

        const signal = macdLine.length >= 9 ? this.calculateEMA(macdLine, 9) : 0;
        const histogram = macd - signal;

        return { macd, signal, histogram };
    }

    // Average True Range
    static calculateATR(candles: ProcessedCandle[], period: number = 14): number {
        if (candles.length < period + 1) return 0;

        const trueRanges: number[] = [];
        
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }

        return this.calculateSMA(trueRanges, period);
    }

    // Bollinger Bands
    static calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2) {
        if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };

        const sma = this.calculateSMA(closes, period);
        const slice = closes.slice(-period);
        
        // Calculate standard deviation
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);

        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    // Stochastic Oscillator
    static calculateStochastic(candles: ProcessedCandle[], kPeriod: number = 14, dPeriod: number = 3) {
        if (candles.length < kPeriod) return { k: 50, d: 50 };

        const slice = candles.slice(-kPeriod);
        const currentClose = candles[candles.length - 1].close;
        const lowestLow = Math.min(...slice.map(c => c.low));
        const highestHigh = Math.max(...slice.map(c => c.high));

        const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
        
        // Calculate %D (SMA of %K)
        const kValues: number[] = [];
        for (let i = candles.length - dPeriod; i < candles.length; i++) {
            if (i >= kPeriod - 1) {
                const sliceForK = candles.slice(i - kPeriod + 1, i + 1);
                const closeForK = candles[i].close;
                const lowForK = Math.min(...sliceForK.map(c => c.low));
                const highForK = Math.max(...sliceForK.map(c => c.high));
                kValues.push(((closeForK - lowForK) / (highForK - lowForK)) * 100);
            }
        }

        const d = kValues.length > 0 ? kValues.reduce((a, b) => a + b, 0) / kValues.length : k;

        return { k, d };
    }

    // Get all technical indicators
    static getTechnicalIndicators(candles: ProcessedCandle[]): TechnicalIndicators {
        if (candles.length < 50) {
            return {
                sma20: 0, sma50: 0, ema12: 0, ema26: 0, rsi: 50,
                macd: 0, macdSignal: 0, macdHistogram: 0, atr: 0,
                volume: 0, avgVolume: 0,
                trend: 'UNDEFINED', momentum: 'UNDEFINED'
            };
        }

        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);
        const currentPrice = closes[closes.length - 1];

        // Calculate indicators
        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const rsi = this.calculateRSI(closes);
        const macdData = this.calculateMACD(closes);
        const atr = this.calculateATR(candles);
        const bollinger = this.calculateBollingerBands(closes);
        const stochastic = this.calculateStochastic(candles);

        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = this.calculateSMA(volumes, 20);

        // Determine trend
        let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED' = 'SIDEWAYS';
        
        const emaAlignment = ema12 > ema26;
        const priceAboveSMA20 = currentPrice > sma20;
        const priceAboveSMA50 = currentPrice > sma50;
        const smaAlignment = sma20 > sma50;

        if (emaAlignment && priceAboveSMA20 && priceAboveSMA50 && smaAlignment) {
            trend = 'BULLISH';
        } else if (!emaAlignment && !priceAboveSMA20 && !priceAboveSMA50 && !smaAlignment) {
            trend = 'BEARISH';
        }

        // Determine momentum
        let momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED' = 'NEUTRAL';
        
        const macdBullish = macdData.macd > macdData.signal && macdData.histogram > 0;
        const macdBearish = macdData.macd < macdData.signal && macdData.histogram < 0;
        const rsiStrong = rsi > 60 || rsi < 40;

        if (macdBullish && rsi > 50) {
            momentum = rsiStrong ? 'STRONG_UP' : 'UP';
        } else if (macdBearish && rsi < 50) {
            momentum = rsiStrong ? 'STRONG_DOWN' : 'DOWN';
        }

        return {
            sma20,
            sma50,
            ema12,
            ema26,
            rsi,
            macd: macdData.macd,
            macdSignal: macdData.signal,
            macdHistogram: macdData.histogram,
            atr,
            volume: currentVolume,
            avgVolume,
            trend,
            momentum
        };
    }

    // Calculate market volatility
    static calculateVolatility(candles: ProcessedCandle[]): number {
        if (candles.length < 20) return 0;

        const returns = [];
        for (let i = 1; i < candles.length; i++) {
            const ret = Math.log(candles[i].close / candles[i - 1].close);
            returns.push(ret);
        }

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

        return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
    }

    // Main market analysis
    static analyzeMarket(candles: ProcessedCandle[], symbol?: TradingSymbol): MarketAnalysis {
        if (candles.length < 50) {
            return {
                trend: 'UNDEFINED',
                momentum: 'UNDEFINED',
                volatility: 'MEDIUM',
                signals: [{
                    action: 'HOLD',
                    confidence: 25,
                    timestamp: Date.now(),
                    reason: 'Insufficient data for analysis',
                    probability: 30,
                    strength: 'WEAK',
                    entry_price: candles[candles.length - 1]?.close || 0,
                    stop_loss: candles[candles.length - 1]?.close || 0,
                    take_profit: candles[candles.length - 1]?.close || 0
                }]
            };
        }

        const indicators = this.getTechnicalIndicators(candles);
        const volatility = this.calculateVolatility(candles);
        
        let volatilityLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (volatility > 15) volatilityLevel = 'HIGH';
        else if (volatility < 8) volatilityLevel = 'LOW';

        const signals = this.generateTradingSignals(candles, indicators, symbol);

        return {
            trend: indicators.trend,
            momentum: indicators.momentum,
            volatility: volatilityLevel,
            signals
        };
    }

    // Generate trading signals
    static generateTradingSignals(
        candles: ProcessedCandle[],
        indicators: TechnicalIndicators,
        symbol?: TradingSymbol
    ): TradingSignal[] {
        const currentPrice = candles[candles.length - 1].close;
        const bollinger = this.calculateBollingerBands(candles.map(c => c.close));
        const stochastic = this.calculateStochastic(candles);
        
        let score = 0;
        const reasons: string[] = [];
        
        // RSI Analysis (Weight: 25%)
        if (indicators.rsi < 40) {
            score += 25;
            reasons.push('RSI oversold (<30)');
        } else if (indicators.rsi < 45) {
            score += 15;
            reasons.push('RSI approaching oversold');
        } else if (indicators.rsi > 60) {
            score -= 25;
            reasons.push('RSI overbought (>70)');
        } else if (indicators.rsi > 55) {
            score -= 15;
            reasons.push('RSI approaching overbought');
        }

        // MACD Analysis (Weight: 25%)
        if (indicators.macd > indicators.macdSignal && indicators.macdHistogram > 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 5) {
                score += 25;
                reasons.push('Strong MACD bullish crossover');
            } else {
                score += 15;
                reasons.push('MACD bullish crossover');
            }
        } else if (indicators.macd < indicators.macdSignal && indicators.macdHistogram < 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 5) {
                score -= 25;
                reasons.push('Strong MACD bearish crossover');
            } else {
                score -= 15;
                reasons.push('MACD bearish crossover');
            }
        }

        // Moving Average Analysis (Weight: 20%)
        if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
            score += 20;
            reasons.push('Price above aligned SMAs');
        } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
            score -= 20;
            reasons.push('Price below aligned SMAs');
        }

        // EMA Analysis (Weight: 15%)
        if (indicators.ema12 > indicators.ema26) {
            score += 15;
            reasons.push('EMA bullish alignment');
        } else {
            score -= 15;
            reasons.push('EMA bearish alignment');
        }

        // Bollinger Bands Analysis (Weight: 10%)
        if (currentPrice < bollinger.lower) {
            score += 10;
            reasons.push('Price below Bollinger lower band');
        } else if (currentPrice > bollinger.upper) {
            score -= 10;
            reasons.push('Price above Bollinger upper band');
        }

        // Stochastic Analysis (Weight: 5%)
        if (stochastic.k < 20 && stochastic.d < 20) {
            score += 5;
            reasons.push('Stochastic oversold');
        } else if (stochastic.k > 80 && stochastic.d > 80) {
            score -= 5;
            reasons.push('Stochastic overbought');
        }

        // Volume confirmation
        const volumeRatio = indicators.volume / indicators.avgVolume;
        if (volumeRatio > 1.5) {
            score += Math.sign(score) * 5;
            reasons.push('High volume confirmation');
        }

        // Determine signal
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let strength: 'WEAK' | 'MODERATE' | 'STRONG' = 'WEAK';
        let confidence = Math.max(25, Math.min(95, 50 + Math.abs(score) * 0.5));
        let probability = Math.max(30, Math.min(85, 40 + Math.abs(score) * 0.4));

        if (score >= 60) {
            action = 'BUY';
            strength = 'STRONG';
            probability = Math.min(85, 60 + (score - 60) * 0.3);
        } else if (score >= 30) {
            action = 'BUY';
            strength = 'MODERATE';
            probability = Math.min(75, 50 + (score - 40) * 0.5);
        } else if (score <= -60) {
            action = 'SELL';
            strength = 'STRONG';
            probability = Math.min(85, 60 + (Math.abs(score) - 60) * 0.3);
        } else if (score <= -30) {
            action = 'SELL';
            strength = 'MODERATE';
            probability = Math.min(75, 50 + (Math.abs(score) - 40) * 0.5);
        }

        // Calculate entry, stop loss, and take profit
        const atr = indicators.atr || currentPrice * 0.001;
        const riskRewardRatio = 1.5;
        
        let entry_price = currentPrice;
        let stop_loss = currentPrice;
        let take_profit = currentPrice;

        if (action === 'BUY') {
            stop_loss = currentPrice - (atr * 1.5);
            take_profit = currentPrice + (atr * 1.5 * riskRewardRatio);
        } else if (action === 'SELL') {
            stop_loss = currentPrice + (atr * 1.5);
            take_profit = currentPrice - (atr * 1.5 * riskRewardRatio);
        }

        const priceDecimals = symbol?.priceDecimals || 5;

        return [{
            action,
            confidence: Math.round(confidence),
            timestamp: Date.now(),
            reason: reasons.length > 0 ? reasons.join(', ') : 'No clear directional bias',
            probability: Math.round(probability),
            strength,
            entry_price: parseFloat(entry_price.toFixed(priceDecimals)),
            stop_loss: parseFloat(stop_loss.toFixed(priceDecimals)),
            take_profit: parseFloat(take_profit.toFixed(priceDecimals))
        }];
    }
}