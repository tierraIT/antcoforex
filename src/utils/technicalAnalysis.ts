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

    // Volume Weighted Average Price (VWAP) - Essential for scalping
    static calculateVWAP(candles: ProcessedCandle[]): number {
        if (candles.length === 0) return 0;
        
        let totalVolume = 0;
        let totalVolumePrice = 0;
        
        for (const candle of candles) {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            totalVolumePrice += typicalPrice * candle.volume;
            totalVolume += candle.volume;
        }
        
        return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
    }

    // Price Action: Detect Doji, Hammer, Engulfing patterns
    static detectCandlestickPatterns(candles: ProcessedCandle[]): {
        isDoji: boolean;
        isHammer: boolean;
        isBullishEngulfing: boolean;
        isBearishEngulfing: boolean;
        pattern: string;
    } {
        if (candles.length < 2) {
            return {
                isDoji: false, isHammer: false, isBullishEngulfing: false,
                isBearishEngulfing: false, pattern: 'NONE'
            };
        }

        const current = candles[candles.length - 1];
        const previous = candles[candles.length - 2];
        
        const bodySize = Math.abs(current.close - current.open);
        const totalSize = current.high - current.low;
        const upperShadow = current.high - Math.max(current.open, current.close);
        const lowerShadow = Math.min(current.open, current.close) - current.low;

        // Doji: Small body relative to shadows
        const isDoji = bodySize / totalSize < 0.1 && totalSize > 0;
        
        // Hammer: Small body at top, long lower shadow
        const isHammer = bodySize / totalSize < 0.3 && lowerShadow > bodySize * 2 && upperShadow < bodySize;
        
        // Bullish Engulfing
        const isBullishEngulfing = previous.close < previous.open && // Previous bearish
                                   current.close > current.open && // Current bullish
                                   current.open < previous.close && // Engulfs previous
                                   current.close > previous.open;
        
        // Bearish Engulfing
        const isBearishEngulfing = previous.close > previous.open && // Previous bullish
                                   current.close < current.open && // Current bearish
                                   current.open > previous.close && // Engulfs previous
                                   current.close < previous.open;

        let pattern = 'NONE';
        if (isBullishEngulfing) pattern = 'BULLISH_ENGULFING';
        else if (isBearishEngulfing) pattern = 'BEARISH_ENGULFING';
        else if (isHammer) pattern = 'HAMMER';
        else if (isDoji) pattern = 'DOJI';

        return { isDoji, isHammer, isBullishEngulfing, isBearishEngulfing, pattern };
    }

    // Support/Resistance Levels Detection
    static findSupportResistance(candles: ProcessedCandle[], lookback: number = 20): {
        support: number;
        resistance: number;
        strength: number;
    } {
        if (candles.length < lookback) return { support: 0, resistance: 0, strength: 0 };

        const recentCandles = candles.slice(-lookback);
        const highs = recentCandles.map(c => c.high).sort((a, b) => b - a);
        const lows = recentCandles.map(c => c.low).sort((a, b) => a - b);

        const resistance = highs[Math.floor(highs.length * 0.1)]; // Top 10%
        const support = lows[Math.floor(lows.length * 0.1)]; // Bottom 10%
        
        // Calculate strength based on how many times price tested these levels
        let strengthCount = 0;
        const tolerance = (resistance - support) * 0.005; // 0.5% tolerance

        for (const candle of recentCandles) {
            if (Math.abs(candle.high - resistance) <= tolerance || 
                Math.abs(candle.low - support) <= tolerance) {
                strengthCount++;
            }
        }

        const strength = (strengthCount / recentCandles.length) * 100;

        return { support, resistance, strength };
    }

    // Volume Analysis
    static analyzeVolume(candles: ProcessedCandle[]): {
        volumeSpike: boolean;
        volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
        abnormalVolume: boolean;
    } {
        if (candles.length < 20) {
            return { volumeSpike: false, volumeTrend: 'STABLE', abnormalVolume: false };
        }

        const volumes = candles.map(c => c.volume);
        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = this.calculateSMA(volumes.slice(-20), 20);
        const recentAvgVolume = this.calculateSMA(volumes.slice(-5), 5);
        const olderAvgVolume = this.calculateSMA(volumes.slice(-20, -5), 15);

        const volumeSpike = currentVolume > avgVolume * 2;
        const abnormalVolume = currentVolume > avgVolume * 1.5;

        let volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
        const trendRatio = recentAvgVolume / olderAvgVolume;
        
        if (trendRatio > 1.2) volumeTrend = 'INCREASING';
        else if (trendRatio < 0.8) volumeTrend = 'DECREASING';

        return { volumeSpike, volumeTrend, abnormalVolume };
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

    // Enhanced Technical Indicators with Scalping focus
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
        
        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = this.calculateSMA(volumes, 20);

        // Enhanced trend detection with more sensitivity for scalping
        let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED' = 'SIDEWAYS';
        
        const ema8 = this.calculateEMA(closes, 8); // Faster EMA for scalping
        const ema21 = this.calculateEMA(closes, 21);
        const priceAboveEMA8 = currentPrice > ema8;
        const ema8AboveEMA21 = ema8 > ema21;
        const priceAboveSMA20 = currentPrice > sma20;

        // More sensitive trend detection
        if (priceAboveEMA8 && ema8AboveEMA21 && macdData.histogram > 0) {
            trend = 'BULLISH';
        } else if (!priceAboveEMA8 && !ema8AboveEMA21 && macdData.histogram < 0) {
            trend = 'BEARISH';
        } else if (priceAboveSMA20 && rsi > 55) {
            trend = 'BULLISH';
        } else if (!priceAboveSMA20 && rsi < 45) {
            trend = 'BEARISH';
        }

        // Enhanced momentum with more granular detection
        let momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED' = 'NEUTRAL';
        
        const macdBullish = macdData.macd > macdData.signal;
        const macdBearish = macdData.macd < macdData.signal;
        const strongRSI = rsi > 65 || rsi < 35;
        const moderateRSI = rsi > 55 || rsi < 45;

        if (macdBullish && rsi > 50) {
            momentum = strongRSI ? 'STRONG_UP' : (moderateRSI ? 'UP' : 'NEUTRAL');
        } else if (macdBearish && rsi < 50) {
            momentum = strongRSI ? 'STRONG_DOWN' : (moderateRSI ? 'DOWN' : 'NEUTRAL');
        }

        return {
            sma20, sma50, ema12, ema26, rsi,
            macd: macdData.macd, macdSignal: macdData.signal, macdHistogram: macdData.histogram,
            atr, volume: currentVolume, avgVolume, trend, momentum
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

    // Main market analysis with enhanced scalping logic
    static analyzeMarket(candles: ProcessedCandle[], symbol?: TradingSymbol): MarketAnalysis {
        if (candles.length < 30) { // Reduced minimum requirement for faster signals
            return {
                trend: 'UNDEFINED', momentum: 'UNDEFINED', volatility: 'MEDIUM',
                signals: [{
                    action: 'HOLD', confidence: 25, timestamp: Date.now(),
                    reason: 'Insufficient data for analysis', probability: 30, strength: 'WEAK',
                    entry_price: candles[candles.length - 1]?.close || 0,
                    stop_loss: candles[candles.length - 1]?.close || 0,
                    take_profit: candles[candles.length - 1]?.close || 0
                }]
            };
        }

        const indicators = this.getTechnicalIndicators(candles);
        const volatility = this.calculateVolatility(candles);
        
        let volatilityLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (volatility > 12) volatilityLevel = 'HIGH'; // Lowered threshold
        else if (volatility < 6) volatilityLevel = 'LOW'; // Lowered threshold

        const signals = this.generateTradingSignals(candles, indicators, symbol);

        return { trend: indicators.trend, momentum: indicators.momentum, volatility: volatilityLevel, signals };
    }

    // Enhanced signal generation with scalping optimization
    static generateTradingSignals(
        candles: ProcessedCandle[],
        indicators: TechnicalIndicators,
        symbol?: TradingSymbol
    ): TradingSignal[] {
        const currentPrice = candles[candles.length - 1].close;
        const bollinger = this.calculateBollingerBands(candles.map(c => c.close));
        const stochastic = this.calculateStochastic(candles);
        const patterns = this.detectCandlestickPatterns(candles);
        const vwap = this.calculateVWAP(candles.slice(-50)); // Last 50 candles for VWAP
        const supportResistance = this.findSupportResistance(candles);
        const volumeAnalysis = this.analyzeVolume(candles);
        
        let score = 0;
        const reasons: string[] = [];
        
        // RSI Analysis (Weight: 20%) - More sensitive for scalping
        if (indicators.rsi < 35) { // Lowered from 40
            score += 20;
            reasons.push('RSI oversold');
        } else if (indicators.rsi < 45) {
            score += 12;
            reasons.push('RSI approaching oversold');
        } else if (indicators.rsi > 65) { // Lowered from 70
            score -= 20;
            reasons.push('RSI overbought');
        } else if (indicators.rsi > 55) {
            score -= 12;
            reasons.push('RSI approaching overbought');
        }

        // MACD Analysis (Weight: 20%)
        if (indicators.macd > indicators.macdSignal && indicators.macdHistogram > 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 3) { // Lowered threshold
                score += 20;
                reasons.push('Strong MACD bullish crossover');
            } else {
                score += 12;
                reasons.push('MACD bullish crossover');
            }
        } else if (indicators.macd < indicators.macdSignal && indicators.macdHistogram < 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 3) { // Lowered threshold
                score -= 20;
                reasons.push('Strong MACD bearish crossover');
            } else {
                score -= 12;
                reasons.push('MACD bearish crossover');
            }
        }

        // Moving Average Analysis (Weight: 15%)
        if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.ema26) {
            score += 15;
            reasons.push('Price above key MAs');
        } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.ema26) {
            score -= 15;
            reasons.push('Price below key MAs');
        }

        // EMA Analysis (Weight: 15%)
        if (indicators.ema12 > indicators.ema26) {
            score += 15;
            reasons.push('EMA bullish alignment');
        } else {
            score -= 15;
            reasons.push('EMA bearish alignment');
        }

        // VWAP Analysis (Weight: 10%) - Critical for scalping
        if (currentPrice > vwap) {
            score += 10;
            reasons.push('Price above VWAP');
        } else {
            score -= 10;
            reasons.push('Price below VWAP');
        }

        // Bollinger Bands Analysis (Weight: 8%)
        const bbPosition = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
        if (bbPosition < 0.2) { // Near lower band
            score += 8;
            reasons.push('Price near BB lower band');
        } else if (bbPosition > 0.8) { // Near upper band
            score -= 8;
            reasons.push('Price near BB upper band');
        }

        // Stochastic Analysis (Weight: 7%)
        if (stochastic.k < 25 && stochastic.d < 25) { // More sensitive
            score += 7;
            reasons.push('Stochastic oversold');
        } else if (stochastic.k > 75 && stochastic.d > 75) { // More sensitive
            score -= 7;
            reasons.push('Stochastic overbought');
        }

        // Candlestick Pattern Analysis (Weight: 10%)
        if (patterns.isBullishEngulfing || (patterns.isHammer && indicators.trend !== 'BEARISH')) {
            score += 10;
            reasons.push(`Bullish pattern: ${patterns.pattern}`);
        } else if (patterns.isBearishEngulfing) {
            score -= 10;
            reasons.push(`Bearish pattern: ${patterns.pattern}`);
        } else if (patterns.isDoji) {
            score += Math.sign(score) * 3; // Amplify existing bias
            reasons.push('Doji - potential reversal');
        }

        // Support/Resistance Analysis (Weight: 8%)
        const distanceToSupport = Math.abs(currentPrice - supportResistance.support) / currentPrice;
        const distanceToResistance = Math.abs(currentPrice - supportResistance.resistance) / currentPrice;
        
        if (distanceToSupport < 0.002 && supportResistance.strength > 20) { // Near support
            score += 8;
            reasons.push('Price near strong support');
        } else if (distanceToResistance < 0.002 && supportResistance.strength > 20) { // Near resistance
            score -= 8;
            reasons.push('Price near strong resistance');
        }

        // Volume Confirmation (Weight: 7%)
        if (volumeAnalysis.volumeSpike) {
            score += Math.sign(score) * 7;
            reasons.push('Volume spike confirmation');
        } else if (volumeAnalysis.abnormalVolume) {
            score += Math.sign(score) * 4;
            reasons.push('Above average volume');
        }

        if (volumeAnalysis.volumeTrend === 'INCREASING' && Math.abs(score) > 10) {
            score += Math.sign(score) * 3;
            reasons.push('Increasing volume trend');
        }

        // Determine signal with more aggressive thresholds for scalping
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let strength: 'WEAK' | 'MODERATE' | 'STRONG' = 'WEAK';
        let confidence = Math.max(25, Math.min(95, 45 + Math.abs(score) * 0.6)); // Increased sensitivity
        let probability = Math.max(35, Math.min(85, 40 + Math.abs(score) * 0.5));

        // More aggressive signal generation for scalping
        if (score >= 45) { // Lowered from 60
            action = 'BUY';
            strength = 'STRONG';
            probability = Math.min(85, 55 + (score - 45) * 0.4);
        } else if (score >= 30) { // Lowered from 40
            action = 'BUY';
            strength = 'MODERATE';
            probability = Math.min(75, 45 + (score - 30) * 0.5);
        } else if (score >= 20) { // New threshold for weak signals
            action = 'BUY';
            strength = 'WEAK';
            probability = Math.min(65, 40 + (score - 20) * 0.5);
        } else if (score <= -45) { // Lowered from -60
            action = 'SELL';
            strength = 'STRONG';
            probability = Math.min(85, 55 + (Math.abs(score) - 45) * 0.4);
        } else if (score <= -30) { // Lowered from -40
            action = 'SELL';
            strength = 'MODERATE';
            probability = Math.min(75, 45 + (Math.abs(score) - 30) * 0.5);
        } else if (score <= -20) { // New threshold for weak signals
            action = 'SELL';
            strength = 'WEAK';
            probability = Math.min(65, 40 + (Math.abs(score) - 20) * 0.5);
        }

        // Enhanced risk management for scalping
        const atr = indicators.atr || currentPrice * 0.001;
        const riskRewardRatio = action === 'HOLD' ? 1 : (strength === 'STRONG' ? 2 : 1.5);
        
        let entry_price = currentPrice;
        let stop_loss = currentPrice;
        let take_profit = currentPrice;

        if (action === 'BUY') {
            const stopDistance = strength === 'STRONG' ? atr * 1.2 : atr * 1.5;
            stop_loss = currentPrice - stopDistance;
            take_profit = currentPrice + (stopDistance * riskRewardRatio);
        } else if (action === 'SELL') {
            const stopDistance = strength === 'STRONG' ? atr * 1.2 : atr * 1.5;
            stop_loss = currentPrice + stopDistance;
            take_profit = currentPrice - (stopDistance * riskRewardRatio);
        }

        const priceDecimals = symbol?.priceDecimals || 5;

        return [{
            action, confidence: Math.round(confidence), timestamp: Date.now(),
            reason: reasons.length > 0 ? reasons.join(', ') : 'Mixed signals - wait for clarity',
            probability: Math.round(probability), strength,
            entry_price: parseFloat(entry_price.toFixed(priceDecimals)),
            stop_loss: parseFloat(stop_loss.toFixed(priceDecimals)),
            take_profit: parseFloat(take_profit.toFixed(priceDecimals))
        }];
    }
}