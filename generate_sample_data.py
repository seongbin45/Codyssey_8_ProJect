import json
import random
from datetime import datetime, timedelta

def generate_sample_data(num_days=100):
    data = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=num_days - 1)
    
    base_value = 5000000
    
    for i in range(num_days):
        current_date = start_date + timedelta(days=i)
        
        # Add some random fluctuation (-20% to +20%)
        fluctuation = random.uniform(0.8, 1.2)
        
        # Add a slight upward trend over time
        trend_multiplier = 1.0 + (i / num_days) * 0.3
        
        # Weekend bump
        if current_date.weekday() >= 5:  # Saturday or Sunday
            fluctuation *= 1.3
            
        value = int(base_value * fluctuation * trend_multiplier)
        
        memo_opts = ["", "평소와 비슷함", "주말 매출 호조", "특가 이벤트 진행", "비 오는 날"]
        memo = random.choice(memo_opts)
        
        data.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "value": value,
            "memo": memo
        })
        
    return data

if __name__ == "__main__":
    sample_data = generate_sample_data(120)
    with open("data/sample_data.json", "w", encoding="utf-8") as f:
        json.dump(sample_data, f, ensure_ascii=False, indent=2)
    print(f"Generated {len(sample_data)} data points in data/sample_data.json")
