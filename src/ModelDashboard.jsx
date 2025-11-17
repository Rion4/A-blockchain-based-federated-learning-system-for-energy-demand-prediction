import React, { useState, useEffect } from "react";

const ModelDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchModelData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:5000/get-global-model");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching model data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelData();
  }, []);

  const formatWeights = (weights) => {
    if (!weights) return "No weights available";

    if (Array.isArray(weights)) {
      return weights
        .map((weight) =>
          typeof weight === "number" ? weight.toFixed(6) : weight
        )
        .join(", ");
    }

    if (typeof weights === "object") {
      return JSON.stringify(
        weights,
        (key, value) =>
          typeof value === "number" ? parseFloat(value.toFixed(6)) : value,
        2
      );
    }

    return typeof weights === "number" ? weights.toFixed(6) : weights;
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-100">
          Global Model Dashboard
        </h2>
        <button
          onClick={fetchModelData}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-slate-300">Loading model data...</span>
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
            <span className="text-red-300 font-medium">
              Error loading model data
            </span>
          </div>
          <p className="text-red-200 mt-2">{error}</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {data.model_weights && (
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">
                Model Weights
              </h3>
              <pre className="bg-slate-900 border border-slate-600 rounded-lg p-4 text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap">
                {formatWeights(data.model_weights)}
              </pre>
            </div>
          )}

          {data.metadata && (
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-3">
                Metadata
              </h3>
              <div className="bg-slate-900 border border-slate-600 rounded-lg p-4">
                {Object.entries(data.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1">
                    <span className="text-slate-400 capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <span className="text-slate-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.timestamp && (
            <div className="text-sm text-slate-400">
              Last updated: {new Date(data.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="text-center py-8 text-slate-400">
          No model data available. Click refresh to fetch data.
        </div>
      )}
    </div>
  );
};

export default ModelDashboard;
