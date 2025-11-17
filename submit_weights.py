import json
import os
import numpy as np
from web3 import Web3
from eth_account import Account
import time

# --- CONFIGURATION ---
SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/4XOe07lHUIlGXcd2xroEw"
CONTRACT_ADDRESS = "0x8eaa1ceea2629d42765cbf9032981cef419a2a39"

# Contract ABI 
CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "int256[]", "name": "weights", "type": "int256[]"}],
        "name": "postLocalWeights",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# --- PASTE YOUR 2 PRIVATE KEYS HERE ---
PROSUMER_PRIVATE_KEYS = [
    "70e6397afcf08eca3a9ba76d77e4f3a755f977adc7e697c7660101bcc7a0bc25",  # Prosumer 1 (your main account)
    "a2ba1d15ad9916ad40ddc864c2a563d758b6bbb5b4405e1e4fac3a1abfa5cd75"   # Prosumer 2 (second account)
]

# --- LIST YOUR 2 NPZ FILES HERE ---
NPZ_FILES = [
    "local_model_weights_mlp_1.npz",
    "local_model_weights_mlp_2.npz",
]

def create_minimal_signature(weights):
    """Creates the 11-weight signature from a full model (must match global model length)."""
    signature = []
    
    # Get 5 key stats for the first (largest) layer, W1
    w1 = weights['W1'].flatten()
    signature.append(np.mean(w1))
    signature.append(np.std(w1))
    signature.append(np.min(w1))
    signature.append(np.max(w1))
    signature.append(np.median(w1))
    
    # Get the mean for 6 other layers (total = 11 weights)
    layer_keys = ['b1', 'W2', 'b2', 'W3', 'b3', 'W4']  # Only 6 more layers
    for key in layer_keys:
        layer = weights[key].flatten()
        signature.append(np.mean(layer))
        
    # Scale to integer
    SCALING_FACTOR = 1000000
    signature_int = (np.array(signature) * SCALING_FACTOR).astype(np.int64)
    
    # Ensure exactly 11 weights
    if len(signature_int) != 11:
        print(f"⚠️  Warning: Expected 11 weights, got {len(signature_int)}")
        signature_int = signature_int[:11]  # Truncate if too long
    
    return signature_int.tolist()



def main():
    print(" Federated Learning: Submitting 2 Prosumer Weights")
    print("=" * 50)
    
 
    
    print(" Connecting to Sepolia testnet...")
    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
    if not w3.is_connected():
        print(" Connection failed.")
        return

    contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
    print(f" Connected to contract at {CONTRACT_ADDRESS}")

    # --- Process both prosumers ---
    for i in range(2):
        print(f"\n{'='*20} PROSUMER {i+1} {'='*20}")
        
        # 1. Load Account and File
        private_key = "0x" + PROSUMER_PRIVATE_KEYS[i] if not PROSUMER_PRIVATE_KEYS[i].startswith("0x") else PROSUMER_PRIVATE_KEYS[i]
        npz_file = NPZ_FILES[i]
        
        try:
            account = Account.from_key(private_key)
            weights_data = np.load(npz_file)
            print(f" Account: {account.address}")
            print(f" Model: {npz_file}")
            print(f" Layers: {weights_data.files}")
        except Exception as e:
            print(f" Error loading data: {e}")
            continue

        # 2. Create Signature
        model_signature = create_minimal_signature(weights_data)
        print(f" Signature: {len(model_signature)} weights")

        # 3. Check balance
        balance = w3.eth.get_balance(account.address)
        balance_eth = w3.from_wei(balance, 'ether')
        print(f" Balance: {balance_eth:.6f} ETH")
        
        if balance_eth < 0.001:
            print(f"  Low balance! Send Sepolia ETH to {account.address}")
            continue

        # 4. Build and Send Transaction
        try:
            print(f" Submitting to blockchain...")
            
            nonce = w3.eth.get_transaction_count(account.address)
            gas_price = w3.eth.gas_price
            
            transaction = contract.functions.postLocalWeights(
                model_signature
            ).build_transaction({
                'chainId': 11155111,
                'from': account.address,
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': gas_price,
            })

            signed_txn = account.sign_transaction(transaction)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            print(f" Transaction sent: {tx_hash.hex()}")
            print(" Waiting for confirmation...")
            
            tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if tx_receipt.status == 1:
                print(f" SUCCESS! Block: {tx_receipt.blockNumber}")
                print(f" Etherscan: https://sepolia.etherscan.io/tx/{tx_hash.hex()}")
            else:
                print(f" Transaction failed!")

        except Exception as e:
            print(f" Error: {e}")
            
        # Wait between transactions
        if i < 1:  # Don't wait after last transaction
            print("⏸  Waiting 5 seconds...")
            time.sleep(5)

    print(f"\n FEDERATED LEARNING COMPLETE!")
    print(f"Both prosumers have submitted their weights to the blockchain.")
    print(f"The network can now aggregate these contributions!")

if __name__ == "__main__":
    main()