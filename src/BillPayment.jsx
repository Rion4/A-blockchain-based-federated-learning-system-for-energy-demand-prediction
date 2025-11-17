import { useState, useEffect } from "react";

const BillPayment = ({ walletInfo, onPaymentSuccess }) => {
  const [billData, setBillData] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Utility company wallet address - your second account for receiving payments
  const UTILITY_WALLET_ADDRESS = "0x6f2558fFf985c3396cBC0218F603E3acfCA09962"; // Your utility account address

  // Fetch bill data from API
  const fetchBillData = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get-bill?user_address=${walletInfo.address}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setBillData(data);
    } catch (err) {
      console.error("Error fetching bill data:", err);
      setError("Failed to load bill data. Please try again.");
    }
  };

  useEffect(() => {
    fetchBillData();

    // Load payment history from localStorage
    const savedHistory = localStorage.getItem(
      `payment_history_${walletInfo.address}`
    );
    if (savedHistory) {
      setPaymentHistory(JSON.parse(savedHistory));
    }
  }, [walletInfo.address]);

  const handlePayment = async () => {
    if (!billData || !window.ethereum) {
      setError("MetaMask not available or bill data missing");
      return;
    }

    setPaymentLoading(true);
    setError(null);

    try {
      // Request account access
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Convert amount to Wei (ETH has 18 decimals)
      const amountInWei = (billData.amount * Math.pow(10, 18)).toString();

      // Prepare transaction with optimized gas settings for Sepolia
      const transactionParameters = {
        to: UTILITY_WALLET_ADDRESS,
        from: walletInfo.address,
        value: "0x" + parseInt(amountInWei).toString(16),
        gas: "0x5208", // 21000 gas for simple transfer
        gasPrice: "0x3B9ACA00", // 1 gwei (much lower for testnet)
      };

      // Send transaction
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [transactionParameters],
      });

      // Create payment record
      const paymentRecord = {
        id: `PAY-${Date.now()}`,
        billId: billData.billId,
        amount: billData.amount,
        txHash: txHash,
        timestamp: new Date().toISOString(),
        status: "completed",
        period: billData.period,
      };

      // Update payment history
      const updatedHistory = [paymentRecord, ...paymentHistory];
      setPaymentHistory(updatedHistory);
      localStorage.setItem(
        `payment_history_${walletInfo.address}`,
        JSON.stringify(updatedHistory)
      );

      // Update bill status
      setBillData((prev) => ({ ...prev, status: "paid", txHash: txHash }));

      // Notify parent component
      if (onPaymentSuccess) {
        onPaymentSuccess(paymentRecord);
      }

      // Show success message
      alert(`Payment successful! Transaction Hash: ${txHash}`);
    } catch (err) {
      console.error("Payment failed:", err);
      setError(err.message || "Payment failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const formatETH = (amount) => {
    return parseFloat(amount).toFixed(6);
  };

  const formatUSD = (ethAmount) => {
    // Approximate ETH to USD conversion (you can make this dynamic)
    const ethToUsd = 2500; // Approximate ETH price
    return (ethAmount * ethToUsd).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Current Bill */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-100">Electricity Bill</h2>
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                billData?.status === "paid" ? "bg-blue-500" : "bg-yellow-500"
              }`}
            ></div>
            <span
              className={`text-sm font-medium ${
                billData?.status === "paid"
                  ? "text-blue-400"
                  : "text-yellow-400"
              }`}
            >
              {billData?.status === "paid" ? "Paid" : "Pending"}
            </span>
          </div>
        </div>

        {billData && (
          <div className="space-y-6">
            {/* Bill Header */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-700 rounded-lg">
              <div>
                <p className="text-sm text-slate-400">Bill ID</p>
                <p className="font-mono text-slate-200">{billData.billId}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Billing Period</p>
                <p className="text-slate-200">{billData.period}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Due Date</p>
                <p className="text-slate-200">
                  {new Date(billData.dueDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Consumption</p>
                <p className="text-slate-200">{billData.consumption} kWh</p>
              </div>
            </div>

            {/* Bill Breakdown */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-200">
                Bill Breakdown
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-slate-600">
                  <span className="text-slate-300">
                    Energy Charges ({billData.consumption} kWh ×{" "}
                    {formatETH(billData.rate)} ETH)
                  </span>
                  <span className="text-slate-200">
                    {formatETH(billData.breakdown.energyCharges)} ETH
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-600">
                  <span className="text-slate-300">Grid Maintenance</span>
                  <span className="text-slate-200">
                    {formatETH(billData.breakdown.gridCharges)} ETH
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-600">
                  <span className="text-slate-300">Taxes & Fees</span>
                  <span className="text-slate-200">
                    {formatETH(billData.breakdown.taxes)} ETH
                  </span>
                </div>
                <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-blue-500">
                  <span className="text-slate-100">Total Amount</span>
                  <div className="text-right">
                    <div className="text-blue-400">
                      {formatETH(billData.amount)} ETH
                    </div>
                    <div className="text-sm text-slate-400">
                      ≈ ${formatUSD(billData.amount)} USD
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            {billData.status !== "paid" && (
              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-slate-200 mb-4">
                  Blockchain Payment Transaction
                </h4>

                {/* Transaction Flow Visualization */}
                <div className="bg-slate-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    {/* From Account */}
                    <div className="text-center flex-1">
                      <div className="text-sm text-slate-400 mb-1">
                        From (Your Account)
                      </div>
                      <div className="bg-blue-600 text-white px-3 py-2 rounded-lg">
                        <div className="text-xs font-mono">
                          {walletInfo.address.slice(0, 6)}...
                          {walletInfo.address.slice(-4)}
                        </div>
                        <div className="text-xs opacity-75">
                          Connected Wallet
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="mx-4 flex flex-col items-center">
                      <svg
                        className="w-8 h-8 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                      <div className="text-xs text-blue-400 font-semibold mt-1">
                        {formatETH(billData.amount)} ETH
                      </div>
                    </div>

                    {/* To Account */}
                    <div className="text-center flex-1">
                      <div className="text-sm text-slate-400 mb-1">
                        To (Utility Company)
                      </div>
                      <div className="bg-slate-600 text-white px-3 py-2 rounded-lg">
                        <div className="text-xs font-mono">
                          {UTILITY_WALLET_ADDRESS.slice(0, 6)}...
                          {UTILITY_WALLET_ADDRESS.slice(-4)}
                        </div>
                        <div className="text-xs opacity-75">
                          FedGrid Utility
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <div className="text-xs text-slate-400">
                      Network:{" "}
                      <span className="text-blue-400">Sepolia Testnet</span> •
                      Gas:{" "}
                      <span className="text-yellow-400">~0.000021 ETH</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300 font-medium">
                      Ready to send payment via MetaMask
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "Pay Now" to open MetaMask and confirm transaction
                    </p>
                  </div>
                  <button
                    onClick={handlePayment}
                    disabled={paymentLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {paymentLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Pay Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Payment Success */}
            {billData.status === "paid" && billData.txHash && (
              <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <svg
                    className="w-6 h-6 text-blue-500 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <div>
                    <h4 className="text-blue-400 font-semibold text-lg">
                      Payment Successful!
                    </h4>
                    <p className="text-sm text-blue-300">
                      Blockchain transaction completed successfully
                    </p>
                  </div>
                </div>

                {/* Transaction Summary */}
                <div className="bg-blue-800/30 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-200">Amount Sent:</span>
                      <div className="font-mono text-blue-100">
                        {formatETH(billData.amount)} ETH
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-200">To Account:</span>
                      <div className="font-mono text-blue-100">
                        {UTILITY_WALLET_ADDRESS.slice(0, 8)}...
                        {UTILITY_WALLET_ADDRESS.slice(-6)}
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-200">From Account:</span>
                      <div className="font-mono text-blue-100">
                        {walletInfo.address.slice(0, 8)}...
                        {walletInfo.address.slice(-6)}
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-200">Network:</span>
                      <div className="text-blue-100">Sepolia Testnet</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-blue-200 text-sm">
                      Transaction Hash:
                    </span>
                    <div className="font-mono text-xs text-blue-300 break-all bg-blue-800/20 p-2 rounded mt-1">
                      {billData.txHash}
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${billData.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
                    >
                      View on Etherscan →
                    </a>
                    <a
                      href={`https://sepolia.etherscan.io/address/${UTILITY_WALLET_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded transition-colors"
                    >
                      View Utility Account →
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-red-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-red-300">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">
            Payment History
          </h3>
          <div className="space-y-3">
            {paymentHistory.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
              >
                <div>
                  <p className="text-slate-200 font-medium">{payment.period}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(payment.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-200">
                    {formatETH(payment.amount)} ETH
                  </p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${payment.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    View Transaction
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillPayment;
