# MT5 Auto Trading System

Hệ thống tự động giao dịch kết nối website với MetaTrader 5.

## Cài đặt

### 1. Cài đặt Python packages:
```bash
pip install -r requirements.txt
```

### 2. Cấu hình MetaTrader 5:
- Mở MT5
- Vào Tools → Options → Expert Advisors
- Tick "Allow algorithmic trading"
- Tick "Allow DLL imports"
- Restart MT5

### 3. Chạy script:
```bash
python mt5_auto_trader.py
```

## Cách hoạt động

### Website (Signal Generation):
1. Phân tích kỹ thuật theo thời gian thực
2. Tạo tín hiệu STRONG có chứa "Doji" trong phân tích
3. Đẩy tín hiệu lên API endpoint `/api/trading-signals`

### Python Script (Order Execution):
1. **Polling**: Kiểm tra API mỗi 5 giây
2. **Signal Filter**: Chỉ xử lý tín hiệu STRONG có "Doji"
3. **Order Placement**: Đặt lệnh BUY/SELL tại giá hiện tại
4. **Position Management**: Tự động đóng lệnh khi:
   - Profit > $1 VÀ
   - Profit ≥ 20% số dư ban đầu

## Tính năng

### ✅ Signal Processing:
- Chỉ xử lý tín hiệu STRONG
- Phải có "Doji" trong analysis
- Tự động clear signal sau khi xử lý

### ✅ Risk Management:
- Lot size tự động (1% risk)
- Không set TP/SL
- Auto close theo điều kiện profit

### ✅ Monitoring:
- Real-time position tracking
- Detailed logging
- Error handling

### ✅ Safety Features:
- Connection validation
- Order confirmation
- Position verification

## Cấu hình

### API URL:
```python
API_URL = "https://your-domain.netlify.app/api/trading-signals"
```

### Trading Parameters:
- **Symbol**: EURUSD (có thể thay đổi)
- **Risk**: 1% per trade
- **Close Conditions**: Profit > $1 AND ≥20% balance
- **Monitoring**: Every 10 seconds

## Log Files:
- `mt5_trader.log`: Chi tiết hoạt động
- Console output: Real-time status

## Lưu ý quan trọng:
1. **Kiểm tra kết nối MT5** trước khi chạy
2. **Test trên demo account** trước
3. **Monitor log files** thường xuyên
4. **Backup settings** MT5 trước khi sử dụng

## Troubleshooting:

### MT5 Connection Issues:
- Kiểm tra "Allow algorithmic trading"
- Restart MT5
- Check account login

### API Connection Issues:
- Verify URL
- Check internet connection
- Monitor website status

### Order Issues:
- Check symbol availability
- Verify account balance
- Check market hours