import { ProcessedCandle, TechnicalIndicators, TradingSignal, MarketAnalysis, TradingSymbol } from '../types/trading';

export class TechnicalAnalyzer {
    static calculateSMA(data: number[], period: number): number {
        if (data.length < period) return 0;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    static calculateEMA(data: number[], period: number): number {
        if (data.length < period) return 0;

        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(data.slice(0, period), period);
        if (ema === 0) return 0;

        for (let i = period; i < data.length; i++) {
            ema = (data[i] * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    static calculateRSI(closes: number[], period: number = 14): number {
        if (closes.length < period + 1) return 50;

        let gains: number[] = [];
        let losses: number[] = [];

        for (let i = closes.length - period; i < closes.length; i++) {
            if (i < 1) continue;
            const change = closes[i] - closes[i - 1];
            if (change > 0) {
                gains.push(change);
                losses.push(0);
            } else {
                gains.push(0);
                losses.push(Math.abs(change));
            }
        }

        if (gains.length === 0) return 50;

        let avgGain = gains.reduce((sum, gain) => sum + gain, 0) / period;
        let avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / period;

        if (avgLoss === 0) return 100;
        if (avgGain === 0) return 0;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    static calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
        if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };

        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);

        if (ema12 === 0 || ema26 === 0) return { macd: 0, signal: 0, histogram: 0 };

        const macd = ema12 - ema26;

        const macdLine: number[] = [];
        for (let i = 25; i < closes.length; i++) {
            const slice = closes.slice(0, i + 1);
            const ema12_i = this.calculateEMA(slice, 12);
            const ema26_i = this.calculateEMA(slice, 26);
            if (!isNaN(ema12_i) && !isNaN(ema26_i) && ema12_i !== 0 && ema26_i !== 0) {
                macdLine.push(ema12_i - ema26_i);
            }
        }

        const signal = macdLine.length >= 9 ? this.calculateEMA(macdLine, 9) : macd;
        const histogram = macd - signal;

        return { macd, signal, histogram };
    }

    static calculateATR(candles: ProcessedCandle[], period: number = 14): number {
        if (candles.length < period) return 0;

        let trueRanges: number[] = [];
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

        if (trueRanges.length === 0) return 0;
        return this.calculateEMA(trueRanges, period);
    }

    static getTechnicalIndicators(candles: ProcessedCandle[]): TechnicalIndicators {
        if (candles.length === 0) {
            return {
                sma20: 0, sma50: 0, ema12: 0, ema26: 0, rsi: 50,
                macd: 0, macdSignal: 0, macdHistogram: 0, atr: 0,
                volume: 0, avgVolume: 0,
                trend: 'UNDEFINED', momentum: 'NEUTRAL'
            };
        }

        const currentPrice = candles[candles.length - 1].close;
        const closes = candles.map(c => c.close);
        const volumes = candles.map(c => c.volume);

        const sma20 = this.calculateSMA(closes, 20);
        const sma50 = this.calculateSMA(closes, 50);
        const ema12 = this.calculateEMA(closes, 12);
        const ema26 = this.calculateEMA(closes, 26);
        const rsi = this.calculateRSI(closes);
        const macdData = this.calculateMACD(closes);
        const atr = this.calculateATR(candles, 14);

        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = volumes.length >= 20 ? volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20 : 0;

        let trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED' = 'SIDEWAYS';
        if (!isNaN(ema12) && !isNaN(ema26) && !isNaN(sma20) && sma50 !== 0) {
            if (ema12 > ema26 && currentPrice > sma20 && currentPrice > sma50) {
                trend = 'BULLISH';
            } else if (ema12 < ema26 && currentPrice < sma20 && currentPrice < sma50) {
                trend = 'BEARISH';
            }
        } else {
            trend = 'UNDEFINED';
        }

        let momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED' = 'NEUTRAL';
        const priceChange = ((currentPrice - candles[candles.length - 2]?.close) / candles[candles.length - 2]?.close) * 100 || 0;

        const macdHistThresholdStrong = 0.00005;
        const macdHistThresholdWeak = 0.00001;

        if (macdData.histogram > macdHistThresholdStrong && priceChange > 0) {
            momentum = 'STRONG_UP';
        } else if (macdData.histogram > macdHistThresholdWeak) {
            momentum = 'UP';
        } else if (macdData.histogram < -macdHistThresholdStrong && priceChange < 0) {
            momentum = 'STRONG_DOWN';
        } else if (macdData.histogram < -macdHistThresholdWeak) {
            momentum = 'DOWN';
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

    static analyzeMarket(candles: ProcessedCandle[], symbol?: TradingSymbol): MarketAnalysis {
        const currentCandle = candles[candles.length - 1];

        if (candles.length < 50 || !currentCandle) {
            return {
                trend: 'SIDEWAYS',
                momentum: 'NEUTRAL',
                volatility: 'MEDIUM',
                signals: [{
                    action: 'HOLD',
                    confidence: 25,
                    timestamp: Date.now(),
                    reason: 'Insufficient data for analysis',
                    probability: 50,
                    strength: 'WEAK',
                    entry_price: currentCandle ? currentCandle.close : 0,
                    stop_loss: currentCandle ? currentCandle.close : 0,
                    take_profit: currentCandle ? currentCandle.close : 0
                }]
            };
        }

        const indicators = this.getTechnicalIndicators(candles);
        if (!indicators || isNaN(indicators.ema12) || isNaN(indicators.ema26)) {
            return {
                trend: 'UNDEFINED',
                momentum: 'NEUTRAL',
                volatility: 'MEDIUM',
                signals: [{
                    action: 'HOLD',
                    confidence: 25,
                    timestamp: Date.now(),
                    reason: 'Failed to calculate indicators.',
                    probability: 50,
                    strength: 'WEAK',
                    entry_price: currentCandle.close,
                    stop_loss: currentCandle.close,
                    take_profit: currentCandle.close
                }]
            };
        }

        const currentPrice = currentCandle.close;
        const trend = indicators.trend;
        const momentum = indicators.momentum;

        const volatility = this.calculateVolatility(candles);
        let volatilityLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (volatility > 0.005) volatilityLevel = 'HIGH';
        else if (volatility < 0.001) volatilityLevel = 'LOW';

        const signals = this.generateTradingSignals(candles, indicators, currentPrice, trend, momentum, symbol);

        return {
            trend,
            momentum,
            volatility: volatilityLevel,
            signals
        };
    }

    static calculateVolatility(candles: ProcessedCandle[]): number {
        if (candles.length < 2) return 0;
        const returns = [];
        for (let i = 1; i < candles.length; i++) {
            const ret = Math.log(candles[i].close / candles[i - 1].close);
            returns.push(ret);
        }

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

        return Math.sqrt(variance) * 100;
    }

    static generateTradingSignals(
        candles: ProcessedCandle[],
        indicators: TechnicalIndicators,
        currentPrice: number,
        trend: string,
        momentum: string,
        symbol?: TradingSymbol
    ): TradingSignal[] {
        const signal = this.calculateCurrentTickSignal(candles, indicators, currentPrice, trend, momentum, symbol);
        return [signal];
    }
    
    static calculateCurrentTickSignal(
        candles: ProcessedCandle[],
        indicators: TechnicalIndicators,
        currentPrice: number,
        trend: string,
        momentum: string,
        symbol?: TradingSymbol
    ): TradingSignal {
        let score = 0;
        let reasons: string[] = [];

        const isForex = symbol?.category === 'FOREX';
        const isCrypto = symbol?.category === 'CRYPTO';

        const macdThreshold = isForex ? 0.00005 : (isCrypto ? 0.05 : 0.0005);
        const volumeMultiplier = isForex ? 2.0 : (isCrypto ? 1.8 : 1.5);

        // RSI Analysis
        if (indicators.rsi < 35) {
            score += 3;
            reasons.push('RSI oversold (buy signal)');
        } else if (indicators.rsi < 45) {
            score += 1;
            reasons.push('RSI approaching oversold');
        }

        if (indicators.rsi > 65) {
            score -= 3;
            reasons.push('RSI overbought (sell signal)');
        } else if (indicators.rsi > 55) {
            score -= 1;
            reasons.push('RSI approaching overbought');
        }

        // MACD Analysis
        if (indicators.macdHistogram > macdThreshold && indicators.macd > indicators.macdSignal) {
            score += 2;
            reasons.push('MACD bullish crossover with strong momentum');
        } else if (indicators.macdHistogram > macdThreshold * 0.5) {
            score += 1;
            reasons.push('MACD histogram positive');
        }

        if (indicators.macdHistogram < -macdThreshold && indicators.macd < indicators.macdSignal) {
            score -= 2;
            reasons.push('MACD bearish crossover with strong momentum');
        } else if (indicators.macdHistogram < -macdThreshold * 0.5) {
            score -= 1;
            reasons.push('MACD histogram negative');
        }

        // Price vs Moving Averages
        if (currentPrice > indicators.sma20) {
            score += 2;
            reasons.push('Price above SMA20 (bullish)');
        } else {
            score -= 2;
            reasons.push('Price below SMA20 (bearish)');
        }

        if (indicators.ema12 > indicators.ema26) {
            score += 2;
            reasons.push('EMA bullish cross');
        } else {
            score -= 2;
            reasons.push('EMA bearish cross');
        }

        // Trend confirmation
        if (trend === 'BULLISH') {
            score += 2;
            reasons.push('Bullish trend');
        } else if (trend === 'BEARISH') {
            score -= 2;
            reasons.push('Bearish trend');
        }

        // Volume analysis
        const currentVolume = candles[candles.length - 1].volume;
        const avgVolume = indicators.avgVolume > 0 ? indicators.avgVolume :
            (candles.length >= 20 ? candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20 : 1);

        if (currentVolume > avgVolume * volumeMultiplier) {
            score += Math.sign(score) * 1;
            reasons.push('High volume confirmation');
        }

        // Determine action and strength
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0;
        let probability = 50;
        let strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' = 'WEAK';

        if (score >= 6) {
            action = 'BUY';
            if (score >= 12) {
                strength = 'VERY_STRONG';
                probability = 60;
            } else if (score >= 9) {
                strength = 'STRONG';
                probability = 45;
            } else {
                strength = 'MODERATE';
                probability = 35;
            }
            confidence = Math.min(50 + score * 5, 95);
        } else if (score <= -6) {
            action = 'SELL';
            if (score <= -12) {
                strength = 'VERY_STRONG';
                probability = 60;
            } else if (score <= -9) {
                strength = 'STRONG';
                probability = 45;
            } else {
                strength = 'MODERATE';
                probability =35;
            }
            confidence = Math.min(50 + Math.abs(score) * 5, 95);
        } else {
            confidence = 25;
            probability = 35;
            strength = 'WEAK';
            reasons.push('Market is consolidating or lacking clear direction.');
        }

        const historicalAccuracy = this.calculateHistoricalAccuracy(candles, indicators);
        probability = Math.round(probability * historicalAccuracy);

        const atr = indicators.atr && !isNaN(indicators.atr) && indicators.atr > 0 ? indicators.atr : 0.00005;
        const riskRewardRatio = 1.5;
        const atrMultiplier = isForex ? 1.2 : (isCrypto ? 1.5 : 1.4);

        let stop_loss = 0;
        let take_profit = 0;

        if (action === 'BUY') {
            stop_loss = currentPrice - (atr * atrMultiplier);
            take_profit = currentPrice + (atr * atrMultiplier * riskRewardRatio);
        } else if (action === 'SELL') {
            stop_loss = currentPrice + (atr * atrMultiplier);
            take_profit = currentPrice - (atr * atrMultiplier * riskRewardRatio);
        } else {
            stop_loss = currentPrice;
            take_profit = currentPrice;
        }

        const priceDecimals = symbol?.priceDecimals || 5;
        return {
            action,
            confidence: Math.round(confidence),
            timestamp: Date.now(),
            reason: reasons.join(', ') || 'No clear signal based on current analysis.',
            probability: Math.round(probability),
            strength,
            entry_price: parseFloat(currentPrice.toFixed(priceDecimals)),
            stop_loss: parseFloat(stop_loss.toFixed(priceDecimals)),
            take_profit: parseFloat(take_profit.toFixed(priceDecimals))
        };
    }

    static calculateHistoricalAccuracy(candles: ProcessedCandle[], indicators: TechnicalIndicators): number {
        let accuracy = 0.85;

        if (indicators.rsi >= 65 || indicators.rsi <= 35) {
            accuracy += 0.1;
        }
        if (Math.abs(indicators.macdHistogram) > 0.00001) {
            accuracy += 0.05;
        }

        return Math.min(accuracy, 0.95);
    }
}