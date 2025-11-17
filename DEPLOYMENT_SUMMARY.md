# FedGrid - Deployment Summary

## Project Overview

FedGrid is a blockchain-based federated learning platform for energy grid optimization, deployed on Ethereum Sepolia testnet with local testing on Ganache.

## Recent Updates (Latest Commit)

### Removed Static Data - Now Fully API-Driven

All hardcoded/static values have been removed from the frontend. The application now fetches all data dynamically from the Flask API backend.

#### Changes Made:

1. **Bill Payment Component** (`src/BillPayment.jsx`)

   - Fetches personalized bill data based on user wallet address
   - Includes consumption, rates, breakdown, and due dates from API

2. **Operator Dashboard** (`src/App.jsx`)

   - Real-time regional metrics including:
     - User counts and consumption trends
     - Peak load and grid stability
     - Carbon intensity and new prosumers
     - Forecasts (daily, weekly, monthly)
     - Efficiency ratings

3. **User Predictions** (`src/App.jsx`)

   - Already implemented: Dynamic prediction fetching from `/get-prediction` API
   - Supports multiple time periods (24h, 7d, 30d)
   - Personalized predictions based on wallet address

4. \*\*Model Weights Dasrc/ModelDashboard.jsx`)
   - Already implemented: Fetches global model weights from blockchain via `/get-global-model` API
   - Displays real-time model weights from Sepolia smart contract

## API Endpoints

### Backend API Server (`api.py`)

All endpoints rttp://127.0.0.1:5000`

| Endpoint             | Method | Description                                                   | Parameters                                       |
| -------------------- | ------ | ------------------------------------------------------------- | ------------------------------------------------ |
| `/get-global-model`  | GET    | Fetch global federated learning model weights from blockchain | None                                             |
| `/get-prediction`    | GET    | Get energy consumption predictions                            | `period` (24h/7d/30d), `user_address` (optional) |
| `/get-regional-data` | GET    | Get regional grid data for all zones                          | `region` (optional)                              |
| `/get-bill`          | GET    | Generate electricity bill for user                            | `user_address` (required)                        |

### API Response Examples

#### `/get-prediction?period=24h&user_address=0x123...`

```json
{
  "timestamp": 1699999999.99,
  "period": "24h",
  "prediction": {
    "value": 35.42,
    "unit": "kWh",
    "confidence": 92.3,
    "accuracy_score": 94.1
  },
  "metadata": {
    "base_consumption": 35.0,
    "time_multiplier": 1,
    "user_personalized": true,
    "model_version": "2.1.3"
  },
  "breakdown": {
    "base_load": 21.25,
    "variable_load": 10.63,
    "peak_load": 3.54
  }
}
```

#### `/get-regional-data`

```json
{
  "regions": {
    "north_mangaluru": {
      "name": "North Mangalore",
      "trends": {
        "users": 1870,
        "avgConsumption": 29.8,
        "peakLoad": 56.2,
        "gridStability": 99.5,
        "carbonIntensity": 0.41,
        "newProsumers": 42,
        "consumptionTrend": 2.8,
        "peakTime": "7:30 PM"
      },
      "forecasts": {
        "day": {"value": 54.5, "unit": "MWh"},
        "week": {"value": 381.5, "unit": "MWh"},
        "month": {"value": 1.64, "unit": "GWh"}
      },
      "efficiency": 95
    },
    ...
  },
  "timestamp": 1699999999.99,
  "total_regions": 6
}
```

#### `/get-bill?user_address=0x123...`

```json
{
  "billId": "BILL-1699999999-456",
  "userAddress": "0x123...",
  "period": "November 2025",
  "consumption": 245.6,
  "rate": 0.0000004,
  "amount": 0.0001,
  "dueDate": "2025-11-30T00:00:00",
  "issueDate": "2025-11-15T00:00:00",
  "status": "pending",
  "breakdown": {
    "energyCharges": 0.000078,
    "gridCharges": 0.00001,
    "taxes": 0.000012
  },
  "utilityInfo": {
    "name": "FedGrid Energy Solutions",
    "address": "Mangalore Regional Grid, Karnataka, India",
    "contact": "+91-824-FEDGRID"
  },
  "paymentMethods": ["Sepolia ETH"],
  "timestamp": 1699999999.99
}
```

## Blockchain Integration

### Smart Contract Details

- **Network**: Ethereum Sepolia Testnet
- **Contract Address**: `0x8eaa1ceea2629d42765cbf9032981cef419a2a39`
- **RPC URL**: `https:h-sepolia.g.alchemy.com/v2/4XOe07lHUIlGXcd2xroEw`

### Contract Functions

- `postLocalWeights(int256[] weights)` - Submit local model weights
- `getGlobalModel()` - Retrieve global aggregated model
- `obalModel(int256[] newWeights)` - Update global model (owner only)
- `getParticipants()` - List all participating nodes

### Testing with Ganache

For local development:

1. Install Ganache from https://trufflesuite.com/ganache/
2. Start Ganache and create a workspace
3. Update `SEPOLIA_RPC_URL` in Python scripts to `http://127.0.0.1:7545`
4. Deploy contract to local network
5. Test all functionality without using testnet ETH

## Running the Application

### Prerequisites

- Node.js v14+
- Python 3.8+
- MetaMask browser extension
- Sepolia testnet ETH (from faucet)

### Start Backend API

```bash
python api.py
```

Server runs on `http://127.0.0.1:5000`

### Start Frontend

```bash
npm run dev
```

Application runs on `http://localhost:5173`

### Train and Submit Models

```bash
# Train local models
python train_local_model.py

# Submit weights to blockchain
python submit_weights.py

# Aggregate global model (requires owner privileges)
python aggregate.py
```

## Data Flow Architecture

```
┌─────────────────┐
│   User Wallet   │
│   (MetaMask)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         React Frontend (Vite)           │
│  ┌──────────────────────────────────┐   │
│  │  - WalletConnect.jsx             │   │
│  │  - App.jsx (User/Operator Views) │   │
│  │  - BillPayment.jsx               │   │
│  │  - ModelDashboard.jsx            │   │
│  └──────────────────────────────────┘   │
└────────┬────────────────────────────────┘
         │ HTTP Requests
         ▼
┌─────────────────────────────────────────┐
│       Flask API Server (api.py)         │
│  ┌──────────────────────────────────┐   │
│  │  /get-prediction                 │   │
│  │  /get-regional-data              │   │
│  │  /get-bill                       │   │
│  │  /get-global-model               │   │
│  └──────────────────────────────────┘   │
└────────┬────────────────────────────────┘
         │ Web3.py
         ▼
┌─────────────────────────────────────────┐
│    Ethereum Sepolia Testnet             │
│  ┌──────────────────────────────────┐   │
│  │  Smart Contract                  │   │
│  │  0x8eaa1ceea2629d42765cbf...     │   │
│  │                                  │   │
│  │  - Global Model Weights          │   │
│  │  - Local Weights Storage         │   │
│  │  - Participant Registry          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
         ▲
         │ Web3.py
         │
┌────────┴────────────────────────────────┐
│   Python ML Scripts                     │
│  ┌──────────────────────────────────┐   │
│  │  train_local_model.py            │   │
│  │  submit_weights.py               │   │
│  │  aggregate.py                    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Key Features

### 1. Dynamic Data Loading

- All data fetched from API in real-time
- No hardcoded values in frontend
- Personalized predictions based on wallet address
- Regional data updates from backend

### 2. Blockchain Integration

- Smart contract on Sepolia testnet
- Immutable model weight storage
- Transparent federated learning process
- Cryptographically signed transactions

### 3. Privacy-Preserving

- Local model training on private data
- Only weights shared, never raw data
- Federated averaging on blockchain
- Decentralized authentication via MetaMask

### 4. Real-Time Monitoring

- Live regional grid metrics
- Dynamic consumption predictions
- Operator dashboard with insights
- Heatmap visualization

## Security Considerations

1. **Never commit private keys** - Use environment variables
2. **API endpoints** - Currenst only, configure CORS for production
3. **Rate limiting** - Implement rate limiting on API endpoints
4. **Input validation** - Validate all user inputs on backend
5. **Smart contract** - Audit contract before mainnet deployment

## Future Enhancements

1. **WebSocket Support** - Real-time data streaming
2. **Caching Layer** - Redis for frequently accessed data
3. **Database Integration** - PostgreSQL for historical data
4. **Advanced Analytics** - ML model performance tracking
5. **Mobile App** - React Native mobile application
6. **Mainnet Deployment** - Production deployment on Ethereum mainnet

## Troubleshooting

### API Not Responding

```bash
# Check if Flask server is running
curl http://127.0.0.1:5000/get-prediction?period=24h

# Restart API server
python api.py
```

### Blockchain Connection Issues

```bash
# Test Web3 connection
python -c "from web3 import Web3; w3 = Web3(Web3.HTTPProvider('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY')); print(w3.is_connected())"
```

### Frontend Not Loading Data

1. Check browser console for errors
2. Verify API server is running on port 5000
3. Check CORS configuration in `api.py`
4. Ensure wallet is connected


## License

MIT License - See LICENSE file for details

---

**Last Updated**: November 17, 2025
**Version**: 2.0.0 - Fully API-Driven Release
