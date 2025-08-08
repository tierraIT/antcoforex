import React, { useState, useEffect } from 'react';
import { TelegramConfig } from '../types/trading';
import { Send, Settings, Eye, EyeOff } from 'lucide-react';

interface TelegramSettingsProps {
  config: TelegramConfig;
  onConfigChange: (config: TelegramConfig) => void;
  onTestMessage: () => void;
}

export const TelegramSettings: React.FC<TelegramSettingsProps> = ({
  config,
  onConfigChange,
  onTestMessage
}) => {
  const [showToken, setShowToken] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-set defaults when component mounts
  useEffect(() => {
    let updatedConfig: TelegramConfig = { ...config };
    let changed = false;

    if (updatedConfig.enabled === undefined) {
      updatedConfig.enabled = true;
      changed = true;
    }

    if (!updatedConfig.botToken || updatedConfig.botToken === 'YOUR_BOT_TOKEN_HERE') {
      updatedConfig.botToken = '7578707048:AAG5Vr667I-3LerfhO1YzYbgTinXJwuHmAA';
      changed = true;
    }

    if (!updatedConfig.chatId || updatedConfig.chatId === 'YOUR_CHAT_ID_HERE') {
      updatedConfig.chatId = '-1002577959257';
      changed = true;
    }

    if (changed) {
      onConfigChange(updatedConfig);
    }
  }, [config, onConfigChange]);

  const handleInputChange = (field: keyof TelegramConfig, value: string | boolean) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Telegram Alerts</span>
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="telegram-enabled"
              checked={config.enabled}
              onChange={(e) => handleInputChange('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="telegram-enabled" className="text-white">
              Enable Telegram Alerts
            </label>
          </div>

          {config.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bot Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={config.botToken || ''}
                    onChange={(e) => handleInputChange('botToken', e.target.value)}
                    placeholder="Enter your Telegram bot token"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={config.chatId || ''}
                  onChange={(e) => handleInputChange('chatId', e.target.value)}
                  placeholder="Enter your chat ID or group ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={onTestMessage}
                disabled={!config.botToken || !config.chatId}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Test Message</span>
              </button>

            <div className="mt-4 p-3 bg-gray-900/50 rounded">
    <h4 className="text-sm font-medium text-gray-300 mb-2">📋 Điều kiện gửi tự động</h4>
    <div className="text-xs text-gray-400 space-y-1">
      <div>• <strong>Tín hiệu:</strong> Chỉ STRONG signals</div>
      <div>• <strong>Chất lượng:</strong> Xác suất ≥40% VÀ Độ tin cậy ≥65%</div>
      <div>• <strong>Phân tích:</strong> Dựa trên chỉ số kỹ thuật chuẩn Forex</div>
      <div>• <strong>Cooldown:</strong> 1 phút giữa các tín hiệu</div>
      <div>• <strong>Độ tin cậy:</strong> Tín hiệu phân tích kỹ thuật thuần túy</div>
    </div>
  </div>

  <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded">
    <h4 className="text-sm font-medium text-green-300 mb-2">📊 Quy trình phân tích</h4>
    <div className="text-xs text-green-200 space-y-1">
      <div>1. <strong>RSI (25%):</strong> Xác định vùng quá mua/quá bán</div>
      <div>2. <strong>MACD (25%):</strong> Tín hiệu crossover và momentum</div>
      <div>3. <strong>Moving Averages (35%):</strong> Xu hướng và alignment</div>
      <div>4. <strong>Bollinger Bands (10%):</strong> Volatility và extremes</div>
      <div>5. <strong>Stochastic (5%):</strong> Xác nhận overbought/oversold</div>
      <div>6. <strong>Volume:</strong> Xác nhận độ mạnh của tín hiệu</div>
    </div>
  </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};