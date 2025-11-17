# FedGrid - Blockchain-Based Federated Learning Platform

A privacy-preserving federated learning platform that enables secure collaboration between energy prosumers while maintaining data privacy through blockchain technology. The system leverages Ethereum smart contracts deployed on the Sepolia testnet for transparent and immutable model weight management.

## Overview

FedGrid AI Innovation is a comprehensive blockchain-based solution that combines federated learning with energy grid optimization. The platform allows prosumers (producers + consumers) to collaboratively train machine learning models without sharing sensitive data, while maintaining complete transparency and auditability through Ethereum smart contracts.

## Key Features

- **Blockchain Integration**: Smart contracts deployed on Ethereum Sepolia testnet for transparent model weight management
- **MetaMask Wallet Authentication**: Secure Web3 authentication using MetaMask wallet
- **Privacy-Preserving Federated Learning**: Train models locally without sharing raw data
- **Decentralized Model Aggregation**: Smart contract-based weight aggregation on-chain
- **Real-time Dashboard**: Live updates showing system status and model performance
- **Role-Based Access Control**: User and Operator access levels
- **Immutable Audit Trail**: All model updates recorded on blockchain

## Technologies Used

### Blockchain & Web3

- **Ethereum Sepolia Testnet** - Production blockchain network for deployment
- **Ganache** - Local blockchain for development and testing
- **Web3.py** - Python library for blockchain interaction
- **Ethers.js** - JavaScript library for wallet integration
- **Smart Contracts** - Solidity contracts for model weight management
- **MetaMask** - Web3 wallet for authentication

### Frontend

- **React** - Modern UI framework
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Chart.js** - Data visualization
- **Leaflet** - Interactive maps

### Backend & ML

- **Python** - ML operations and blockchain interaction
- **TensorFlow** - Deep learning framework
- **Flask** - API server
- **NumPy** - Numerical computations

## Blockchain Architecture

### Smart Contract Deployment

The system uses Ethereum smart contracts to manage federated learning:

1. **Development & Testing**: Ganache local blockchain

   - Fast iteration and testing
   - No gas costs
   - Complete control over network

2. **Production Deployment**: Sepolia Testnet
   - Public Ethereum test network
   - Real blockchain environment
   - Free test ETH from faucets

### Smart Contract Functions

- `postLocalWeights()` - Prosumers submit locally trained model weights
- `getGlobalModel()` - Retrieve current global model weights
- `updateGlobalModel()` - Aggregate and update global model (owner only)
- `getParticipants()` - List all participating prosumers

### Contract Address

- **Sepolia Testnet**: `0x8eaa1ceea2629d42765cbf9032981cef419a2a39`

## System Architecture

### Federated Learning Flow

1. **Local Training**: Each prosumer trains a model on their private energy data
2. **Weight Submission**: Model weights are submitted to the smart contract via `submit_weights.py`
3. **Blockchain Storage**: Weights are stored immutably on Sepolia testnet
4. **Aggregation**: Operator runs `aggregate.py` to compute federated average
5. **Global Update**: Aggregated weights are pushed back to the smart contract
6. **Distribution**: All prosumers retrieve updated global model from blockchain

### Data Privacy

- Raw energy consumption data never leaves local devices
- Only model weights (mathematical parameters) are shared
- Blockchain provides transparency without compromising privacy
- Each transaction is cryptographically signed and verified

## Installation & Setup

### Prerequisites

- **Node.js** (v14 or higher)
- **Python** (v3.8 or higher)
- **MetaMask** browser extension
- **Ethereum Wallet** with Sepolia testnet ETH

### 1. Clone the Repository

```bash
git clone https://github.com/YourUsername/MajorProject.git
cd MajorProject
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Create a `.env` file with your blockchain configuration:

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
CONTRACT_ADDRESS=0x8eaa1ceea2629d42765cbf9032981cef419a2a39
PRIVATE_KEY=your_private_key_here
```

### 5. Get Sepolia Test ETH

Visit a Sepolia faucet to get free test ETH:

- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

## Running the Application

### Start Frontend Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Start Backend API Server

```bash
python api.py
```

API server runs on `http://localhost:5000`

### Train Local Models

Train models for each prosumer:

```bash
python train_local_model.py
```

This generates local model weights stored in `.npz` files.

### Submit Weights to Blockchain

Submit trained weights to the Sepolia smart contract:

```bash
python submit_weights.py
```

This creates blockchain transactions for each prosumer's weights.

### Aggregate Global Model

Run the aggregation script (requires contract owner privileges):

```bash
python aggregate.py
```

This computes the federated average and updates the global model on-chain.

## Testing with Ganache

For local development and testing:

1. **Install Ganache**: Download from https://trufflesuite.com/ganache/
2. **Start Ganache**: Launch the application and create a new workspace
3. **Update Configuration**: Point `SEPOLIA_RPC_URL` to `http://127.0.0.1:7545`
4. **Deploy Contract**: Deploy your smart contract to the local network
5. **Test Locally**: Run all scripts against Ganache for fast iteration

## Project Structure

```
FedGrid-AIINNOVATION/
├── src/                          # React frontend source
│   ├── App.jsx                   # Main application component
│   ├── WalletConnect.jsx         # MetaMask wallet integration
│   ├── ModelDashboard.jsx        # ML model dashboard
│   └── BillPayment.jsx           # Energy billing interface
├── public/                       # Static assets
├── train_local_model.py          # Local model training script
├── submit_weights.py             # Blockchain weight submission
├── aggregate.py                  # Federated aggregation script
├── api.py                        # Flask API server
├── household_*_dataset.csv       # Sample energy datasets
├── package.json                  # Node.js dependencies
├── requirements.txt              # Python dependencies
└── README.md                     # This file
```

## Wallet Authentication

### Connecting Your Wallet

1. **Install MetaMask**: Download from https://metamask.io/
2. **Add Sepolia Network**: Configure MetaMask for Sepolia testnet
3. **Get Test ETH**: Use a faucet to get free Sepolia ETH
4. **Connect**: Click "Connect MetaMask Wallet" in the application
5. **Select Role**: Choose User or Operator access level

### User Roles

- **User**: View personal energy data, participate in federated learning
- **Operator**: Manage grid operations, run aggregation, monitor system

## Security Considerations

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Keep MetaMask wallet secure with strong password
- Verify contract addresses before transactions
- Test thoroughly on Ganache before Sepolia deployment

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Test on Ganache local network
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Ethereum Foundation for Sepolia testnet
- Truffle Suite for Ganache
- MetaMask for Web3 wallet integration
- OpenAI for federated learning research

## Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ using Blockchain & Federated Learning**
