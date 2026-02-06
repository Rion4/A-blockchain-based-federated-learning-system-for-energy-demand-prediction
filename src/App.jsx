import React, { useState, useEffect, useRef } from "react";
//import ChatBot from "./chatbot.jsx";
import ChatBot from "./chatbot";
import WalletConnect from "./WalletConnect";
import BillPayment from "./BillPayment";
// Supabase import is removed and will be loaded from a CDN.
import L from 'leaflet';
import 'leaflet.heat';

// --- PREDICTION DATA SERVICE ---
const fetchLatestPrediction = async () => {
  try {
    // Try to find the latest prediction file by checking in reverse order
    for (let i = 100; i >= 1; i--) {
      const fileNumber = i.toString().padStart(3, "0");
      try {
        const fileResponse = await fetch(
          `/frontend_data/prediction_${fileNumber}.json`
        );
        if (fileResponse.ok) {
          return await fileResponse.json();
        }
      } catch (e) {
        // File doesn't exist, continue to next
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching prediction data:", error);
    return null;
  }
};

// --- Third-party Library Imports for Local Development ---
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
// Leaflet imports are removed and will be loaded from a CDN.

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- HELPER DATA & FUNCTIONS ---

const initialRegionalData = {
  north_mangaluru: {
    name: "North Mangalore",
    trends: { users: 1850, avgConsumption: 29.1 },
    forecasts: {
      day: { value: 285.4, unit: "MWh" },
      week: { value: 1997.8, unit: "MWh" },
      month: { value: 8.6, unit: "GWh" },
    },
    efficiency: 94,
  },
  north_east_mangaluru: {
    name: "North East Mangalore",
    trends: { users: 1450, avgConsumption: 28.5 },
    forecasts: {
      day: { value: 218.9, unit: "MWh" },
      week: { value: 1532.3, unit: "MWh" },
      month: { value: 6.6, unit: "GWh" },
    },
    efficiency: 92,
  },
  east_mangaluru: {
    name: "East Mangalore",
    trends: { users: 1675, avgConsumption: 30.5 },
    forecasts: {
      day: { value: 271.2, unit: "MWh" },
      week: { value: 1898.4, unit: "MWh" },
      month: { value: 8.1, unit: "GWh" },
    },
    efficiency: 91,
  },
  south_east_mangaluru: {
    name: "South East Mangalore",
    trends: { users: 2105, avgConsumption: 31.2 },
    forecasts: {
      day: { value: 348.6, unit: "MWh" },
      week: { value: 2440.2, unit: "MWh" },
      month: { value: 10.5, unit: "GWh" },
    },
    efficiency: 88,
  },
  south_mangaluru: {
    name: "South Mangalore",
    trends: { users: 1950, avgConsumption: 32.8 },
    forecasts: {
      day: { value: 339.2, unit: "MWh" },
      week: { value: 2374.4, unit: "MWh" },
      month: { value: 10.2, unit: "GWh" },
    },
    efficiency: 89,
  },
  west_mangaluru: {
    name: "West Mangalore",
    trends: { users: 2350, avgConsumption: 27.8 },
    forecasts: {
      day: { value: 346.1, unit: "MWh" },
      week: { value: 2422.7, unit: "MWh" },
      month: { value: 10.4, unit: "GWh" },
    },
    efficiency: 95,
  },
};

// Helper function to calculate total Mangalore consumption intelligently
const calculateTotalMangaloreConsumption = (regionalData, liveData = null) => {
  // Base calculation from regional data
  let totalConsumption = Object.values(regionalData).reduce((total, region) => {
    return total + region.forecasts.day.value;
  }, 0);

  // If we have live federated data, use it to adjust the total more intelligently
  if (liveData && liveData.predicted_24h_sum_kw) {
    // Scale the federated prediction to city-level (multiply by appropriate factor)
    // Since federated data is typically for smaller areas, scale it up for entire city
    totalConsumption = (liveData.predicted_24h_sum_kw / 1000) * 500; // Scale factor for city-wide consumption
  } else {
    // Add some intelligent variation based on time of day and regional factors
    const currentHour = new Date().getHours();
    let timeMultiplier = 1.0;

    // Peak hours adjustment (7-9 AM and 6-9 PM)
    if (
      (currentHour >= 7 && currentHour <= 9) ||
      (currentHour >= 18 && currentHour <= 21)
    ) {
      timeMultiplier = 1.25; // 25% increase during peak hours
    } else if (currentHour >= 22 || currentHour <= 5) {
      timeMultiplier = 0.7; // 30% decrease during night hours
    } else if (currentHour >= 10 && currentHour <= 17) {
      timeMultiplier = 1.1; // 10% increase during business hours
    }

    totalConsumption *= timeMultiplier;

    // Add seasonal variation (Mangalore climate consideration)
    const currentMonth = new Date().getMonth();
    let seasonalMultiplier = 1.0;

    // Summer months (March-May) - higher AC usage
    if (currentMonth >= 2 && currentMonth <= 4) {
      seasonalMultiplier = 1.3;
    }
    // Monsoon months (June-September) - moderate usage
    else if (currentMonth >= 5 && currentMonth <= 8) {
      seasonalMultiplier = 1.1;
    }
    // Winter months (December-February) - lower usage
    else if (currentMonth >= 11 || currentMonth <= 1) {
      seasonalMultiplier = 0.95;
    }

    totalConsumption *= seasonalMultiplier;
  }

  return totalConsumption;
};

// Regional heatmap data with detailed sub-areas for zoom levels
const regionalHeatmapData = {
  north_mangaluru: {
    center: [12.9659, 74.8295],
    baseIntensity: 0.95, // Critical - Industrial area with high consumption
    consumptionLevel: "critical",
    subAreas: [
      [12.9659, 74.8295, 0.95], // Surathkal Main - Critical
      [12.972, 74.835, 0.3], // Surathkal Beach - Economical
      [12.96, 74.825, 0.88], // NITK Area - High
      [12.968, 74.832, 0.98], // Industrial Zone - Critical
      [12.964, 74.828, 0.45], // Residential Area - Moderate
    ],
  },
  north_east_mangaluru: {
    center: [12.935, 74.8455],
    baseIntensity: 0.6, // Moderate consumption
    consumptionLevel: "moderate",
    subAreas: [
      [12.935, 74.8455, 0.65], // Kavoor Main - Moderate
      [12.938, 74.848, 0.85], // Kavoor Junction - High
      [12.932, 74.843, 0.25], // Residential Kavoor - Economical
      [12.937, 74.847, 0.75], // Commercial Area - High
      [12.934, 74.844, 0.4], // Kavoor Extension - Moderate
    ],
  },
  east_mangaluru: {
    center: [12.9178, 74.8737],
    baseIntensity: 0.35, // Economical - Residential area
    consumptionLevel: "economical",
    subAreas: [
      [12.9178, 74.8737, 0.35], // Derebail Main - Economical
      [12.92, 74.876, 0.55], // Derebail East - Moderate
      [12.915, 74.871, 0.2], // Derebail West - Very Economical
      [12.919, 74.875, 0.7], // Market Area - High
      [12.916, 74.872, 0.3], // Residential Zone - Economical
    ],
  },
  south_east_mangaluru: {
    center: [12.87, 74.88],
    baseIntensity: 0.9, // Critical - Commercial hub
    consumptionLevel: "critical",
    subAreas: [
      [12.87, 74.88, 0.92], // Kankanady Main - Critical
      [12.872, 74.882, 0.95], // Kankanady Market - Critical
      [12.868, 74.878, 0.4], // Kankanady Residential - Moderate
      [12.871, 74.881, 0.88], // Commercial Hub - High
      [12.869, 74.879, 0.85], // Industrial Area - High
    ],
  },
  south_mangaluru: {
    center: [12.8223, 74.8485],
    baseIntensity: 0.5, // Moderate - Coastal residential area
    consumptionLevel: "moderate",
    subAreas: [
      [12.8223, 74.8485, 0.55], // Ullal Main - Moderate
      [12.825, 74.851, 0.25], // Ullal Beach - Economical
      [12.82, 74.846, 0.45], // Ullal Town - Moderate
      [12.824, 74.85, 0.3], // Coastal Area - Economical
      [12.821, 74.847, 0.4], // Residential Ullal - Moderate
    ],
  },
  west_mangaluru: {
    center: [12.8797, 74.8433],
    baseIntensity: 0.92, // Critical - Major commercial district
    consumptionLevel: "critical",
    subAreas: [
      [12.8797, 74.8433, 0.92], // Bejai Main - Critical
      [12.882, 74.845, 0.98], // Attavar Junction - Critical
      [12.877, 74.841, 0.5], // Bejai Residential - Moderate
      [12.881, 74.844, 0.95], // Commercial District - Critical
      [12.878, 74.842, 0.7], // Bejai Extension - High
    ],
  },
};

// Generate dynamic heatmap data based on regional predictions
const generateHeatmapData = (regionalData, liveData) => {
  const baseData = [];

  Object.keys(regionalHeatmapData).forEach((regionKey) => {
    const region = regionalHeatmapData[regionKey];
    const regionInfo = regionalData[regionKey];

    // Use predefined base intensity with slight dynamic variation
    let baseIntensity = region.baseIntensity;

    // Add small time-based variation to make it more dynamic (±10%)
    const timeVariation = Math.sin(Date.now() / 50000 + regionKey.length) * 0.1;
    baseIntensity = Math.min(
      1.0,
      Math.max(0.05, baseIntensity + timeVariation)
    );

    // Optional: Use live data if available, but keep within reasonable bounds
    if (liveData && liveData.federated_nodes) {
      const matchingNode = liveData.federated_nodes.find(
        (node) =>
          node.node_name.toLowerCase().includes(regionKey.split("_")[0]) ||
          node.node_name.toLowerCase().includes(regionKey.split("_")[1])
      );

      if (matchingNode) {
        const predictionRatio = matchingNode.local_prediction_kw / 1500; // Adjusted for better range
        const liveIntensity = Math.min(1.0, Math.max(0.1, predictionRatio));
        // Blend with predefined intensity (70% predefined, 30% live)
        baseIntensity = baseIntensity * 0.7 + liveIntensity * 0.3;
      }
    }

    // Create multiple data points around the center for smoother heatmap
    const center = region.center;
    const radius = 0.008; // Approximately 800m radius
    const numPoints = 12; // Number of points around center

    // Add center point with full intensity
    baseData.push([center[0], center[1], baseIntensity]);

    // Add surrounding points with consumption-level appropriate variations
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const pointRadius = radius * (0.4 + Math.random() * 0.6);

      // Create variations based on consumption level
      let variation;
      if (region.consumptionLevel === "critical") {
        variation = 0.7 + Math.random() * 0.3; // High variation (70-100%)
      } else if (region.consumptionLevel === "moderate") {
        variation = 0.4 + Math.random() * 0.4; // Medium variation (40-80%)
      } else {
        // economical
        variation = 0.1 + Math.random() * 0.4; // Low variation (10-50%)
      }

      const lat = center[0] + Math.cos(angle) * pointRadius;
      const lng = center[1] + Math.sin(angle) * pointRadius;
      const intensity = Math.min(1.0, Math.max(0.05, variation));

      baseData.push([lat, lng, intensity]);
    }

    // Add additional random points with diverse consumption patterns
    for (let i = 0; i < 15; i++) {
      const randomLat = center[0] + (Math.random() - 0.5) * radius * 2;
      const randomLng = center[1] + (Math.random() - 0.5) * radius * 2;

      // Create diverse consumption spots
      const spotType = Math.random();
      let spotIntensity;

      if (spotType < 0.15) {
        // 15% - Critical consumption spots (factories, malls, etc.)
        spotIntensity = 0.85 + Math.random() * 0.15;
      } else if (spotType < 0.35) {
        // 20% - High consumption spots (offices, apartments)
        spotIntensity = 0.6 + Math.random() * 0.25;
      } else if (spotType < 0.65) {
        // 30% - Moderate consumption spots (homes, small businesses)
        spotIntensity = 0.3 + Math.random() * 0.3;
      } else {
        // 35% - Low consumption spots (parks, low-density residential)
        spotIntensity = 0.05 + Math.random() * 0.25;
      }

      baseData.push([randomLat, randomLng, spotIntensity]);
    }
  });

  return baseData;
};

// Generate detailed heatmap data for zoomed view with enhanced density
const generateDetailedHeatmapData = (regionalData, liveData, zoomLevel) => {
  const detailedData = [];

  Object.keys(regionalHeatmapData).forEach((regionKey) => {
    const region = regionalHeatmapData[regionKey];
    const regionInfo = regionalData[regionKey];

    // Use predefined base intensity for this region
    let baseIntensity = region.baseIntensity;

    // Add small dynamic variation
    const timeVariation =
      Math.sin(Date.now() / 60000 + regionKey.length) * 0.08;
    baseIntensity = Math.min(
      1.0,
      Math.max(0.05, baseIntensity + timeVariation)
    );

    // Add sub-areas with enhanced detail and realistic consumption variations
    region.subAreas.forEach((subArea, index) => {
      const subAreaRadius = 0.003; // Smaller radius for detailed view
      const numMicroPoints = 12; // More points for better coverage

      // Use the specific sub-area intensity (3rd element) for more accurate representation
      let subAreaIntensity = subArea[2]; // Use predefined sub-area intensity

      // Add some time-based variation to simulate real consumption patterns
      const timeVariation = Math.sin(Date.now() / 100000 + index) * 0.15;
      subAreaIntensity = Math.min(
        1.0,
        Math.max(0.05, subAreaIntensity + timeVariation)
      );

      // Main sub-area point with its specific intensity
      detailedData.push([subArea[0], subArea[1], subAreaIntensity]);

      // Add micro-points around each sub-area with realistic variations
      for (let i = 0; i < numMicroPoints; i++) {
        const angle = (i / numMicroPoints) * 2 * Math.PI;
        const microRadius = subAreaRadius * (0.2 + Math.random() * 0.8);

        // Create more realistic intensity variations based on sub-area type
        let intensityVariation;
        if (subAreaIntensity > 0.8) {
          // Critical areas - high variation (0.7-1.0)
          intensityVariation = 0.7 + Math.random() * 0.3;
        } else if (subAreaIntensity > 0.6) {
          // High areas - moderate-high variation (0.5-0.9)
          intensityVariation = 0.5 + Math.random() * 0.4;
        } else if (subAreaIntensity > 0.4) {
          // Moderate areas - medium variation (0.3-0.7)
          intensityVariation = 0.3 + Math.random() * 0.4;
        } else {
          // Economical areas - low variation (0.1-0.5)
          intensityVariation = 0.1 + Math.random() * 0.4;
        }

        const lat = subArea[0] + Math.cos(angle) * microRadius;
        const lng = subArea[1] + Math.sin(angle) * microRadius;
        const microIntensity = Math.min(
          1.0,
          Math.max(0.05, intensityVariation)
        );

        detailedData.push([lat, lng, microIntensity]);
      }

      // Add grid-like distribution for very detailed view with realistic building-level variations
      if (zoomLevel >= 14) {
        const gridSize = 0.001; // Smaller grid for building-level detail
        for (let x = -2; x <= 2; x++) {
          for (let y = -2; y <= 2; y++) {
            if (x === 0 && y === 0) continue; // Skip center (already added)

            const gridLat = subArea[0] + x * gridSize;
            const gridLng = subArea[1] + y * gridSize;

            // Create building-level consumption patterns
            const distance = Math.sqrt(x * x + y * y);
            const distanceFactor = Math.max(0.3, 1 - distance * 0.2);

            // Simulate different building types
            const buildingType = Math.random();
            let buildingIntensity;

            if (buildingType < 0.1) {
              // 10% - Industrial/Commercial buildings (high consumption)
              buildingIntensity = 0.8 + Math.random() * 0.2;
            } else if (buildingType < 0.3) {
              // 20% - Office buildings (moderate-high consumption)
              buildingIntensity = 0.5 + Math.random() * 0.3;
            } else if (buildingType < 0.7) {
              // 40% - Residential buildings (moderate consumption)
              buildingIntensity = 0.2 + Math.random() * 0.4;
            } else {
              // 30% - Low consumption buildings (economical)
              buildingIntensity = 0.05 + Math.random() * 0.25;
            }

            const finalIntensity = Math.min(
              1.0,
              Math.max(
                0.05,
                buildingIntensity * distanceFactor * (subArea[2] / 0.5)
              )
            );

            detailedData.push([gridLat, gridLng, finalIntensity]);
          }
        }
      }
    });
  });

  return detailedData;
};

const generateUserData = (period) => {
  const data = [],
    labels = [];
  let points;
  const now = new Date();
  const currentTime = now.getTime();

  switch (period) {
    case "day":
      points = 24;
      for (let i = 0; i < points; i++) {
        labels.push(`${i}:00`);

        // Realistic daily consumption pattern
        let baseConsumption;
        if (i >= 0 && i < 6) {
          // Night: low consumption
          baseConsumption = 0.8 + Math.random() * 0.4;
        } else if (i >= 6 && i < 9) {
          // Morning peak
          baseConsumption = 2.2 + Math.random() * 0.8;
        } else if (i >= 9 && i < 17) {
          // Day: moderate consumption
          baseConsumption = 1.5 + Math.random() * 0.6;
        } else if (i >= 17 && i < 22) {
          // Evening peak
          baseConsumption = 2.8 + Math.random() * 1.0;
        } else {
          // Late evening
          baseConsumption = 1.8 + Math.random() * 0.5;
        }

        data.push(baseConsumption);
      }
      break;

    case "week":
      points = 7;
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < points; i++) {
        const d = new Date();
        d.setDate(now.getDate() - (6 - i));
        labels.push(days[d.getDay()]);

        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const baseDaily = isWeekend ? 28 : 35; // Lower consumption on weekends
        const variation = (Math.random() - 0.5) * 8;
        data.push(baseDaily + variation);
      }
      break;

    case "month":
      points = 30;
      for (let i = 1; i <= points; i++) {
        labels.push(`${i}`);

        // Monthly pattern with some seasonal variation
        const dayOfMonth = i;
        const monthProgress = dayOfMonth / 30;

        // Simulate billing cycle effect (higher usage mid-month)
        const billingCycleEffect = Math.sin(monthProgress * Math.PI) * 5;
        const baseDaily = 32 + billingCycleEffect;
        const randomVariation = (Math.random() - 0.5) * 12;

        data.push(Math.max(15, baseDaily + randomVariation));
      }
      break;

    case "year":
      points = 12;
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      // Seasonal consumption patterns for Mangalore (tropical climate)
      const seasonalFactors = [
        1.15, // Jan - cooler, more heating
        1.1, // Feb - cooler
        1.05, // Mar - warming up
        1.2, // Apr - hot, AC usage starts
        1.35, // May - peak summer, high AC usage
        1.4, // Jun - peak summer + monsoon prep
        1.25, // Jul - monsoon, less AC but more indoor activities
        1.2, // Aug - monsoon continues
        1.15, // Sep - post-monsoon
        1.1, // Oct - pleasant weather
        1.05, // Nov - cool and pleasant
        1.1, // Dec - cooler, holiday season
      ];

      for (let i = 0; i < points; i++) {
        labels.push(months[i]);
        const baseMontly = 950; // Base monthly consumption in kWh
        const seasonalConsumption = baseMontly * seasonalFactors[i];
        const variation = (Math.random() - 0.5) * 150;

        data.push(Math.max(600, seasonalConsumption + variation));
      }
      break;

    default:
      return { labels: [], data: [] };
  }
  return { labels, data };
};

const generateOperatorChartData = (points, min, max) => {
  const data = [];
  for (let i = 0; i < points; i++) {
    data.push(min + Math.random() * (max - min));
  }
  return data;
};

// --- ICON COMPONENTS ---

const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-3"
  >
    <rect width="7" height="9" x="3" y="3" rx="1"></rect>
    <rect width="7" height="5" x="14" y="3" rx="1"></rect>
    <rect width="7" height="9" x="14" y="12" rx="1"></rect>
    <rect width="7" height="5" x="3" y="16" rx="1"></rect>
  </svg>
);
const HeatmapIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-3"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);
const ModelWeightsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-3"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" x2="12" y1="3" y2="15"></line>
  </svg>
);
const SignOutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-3"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" x2="9" y1="12" y2="12"></line>
  </svg>
);
const DailyForecastIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-2 text-blue-500"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);
const WeeklyForecastIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-2 text-blue-500"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" x2="16" y1="2" y2="6"></line>
    <line x1="8" x2="8" y1="2" y2="6"></line>
    <line x1="3" x2="21" y1="10" y2="10"></line>
  </svg>
);
const MonthlyForecastIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-2 text-blue-500"
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
    <path d="M18 12a2 2 0 0 1 0 4h-4a2 2 0 0 1 0-4h4z"></path>
  </svg>
);
const GridEfficiencyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-2 text-emerald-500"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);
const AlertTriangleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-6 w-6 text-red-500 mr-3"
  >
    <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
    <line x1="12" x2="12" y1="9" y2="13"></line>
    <line x1="12" x2="12.01" y1="17" y2="17"></line>
  </svg>
);
const ChatIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 mr-3"
  >
    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"></path>
    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
  </svg>
);

// --- GENERIC MODAL COMPONENT ---
const Modal = ({ show, onClose, title, children, type = "info" }) => {
  if (!show) {
    return null;
  }

  const getModalStyles = () => {
    switch (type) {
      case "critical":
        return {
          border: "border-red-500",
          bg: "bg-red-900/20",
          button: "bg-red-600 hover:bg-red-700",
        };
      case "warning":
        return {
          border: "border-yellow-500",
          bg: "bg-yellow-900/20",
          button: "bg-yellow-600 hover:bg-yellow-700",
        };
      case "success":
        return {
          border: "border-green-500",
          bg: "bg-green-900/20",
          button: "bg-green-600 hover:bg-green-700",
        };
      default:
        return {
          border: "border-blue-500",
          bg: "bg-blue-900/20",
          button: "bg-blue-600 hover:bg-blue-700",
        };
    }
  };

  const styles = getModalStyles();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
      <div
        className={`bg-slate-800 rounded-lg shadow-xl p-6 border ${styles.border} ${styles.bg} w-full max-w-md`}
      >
        <div className="flex items-center mb-4">
          <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        </div>
        <div className="text-slate-300 mb-6 whitespace-pre-line">
          {children}
        </div>
        <button
          onClick={onClose}
          className={`w-full ${styles.button} text-white font-semibold py-3 px-4 rounded-md transition-colors hover:scale-105 transform`}
        >
          ✓ Acknowledge & Take Action
        </button>
      </div>
    </div>
  );
};

// --- CHART COMPONENTS ---

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: "#334155" },
      ticks: { color: "#94a3b8" },
    },
    x: { grid: { display: false }, ticks: { color: "#94a3b8" } },
  },
};

const UserConsumptionChart = ({ period }) => {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    const { labels, data } = generateUserData(period);
    setChartData({
      labels,
      datasets: [
        {
          label: "kWh Consumed",
          data,
          borderColor: "#3b82f6",
          backgroundColor: (context) => {
            if (!context.chart.ctx) return "rgba(0,0,0,0)";
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "#3b82f640");
            gradient.addColorStop(1, "#3b82f600");
            return gradient;
          },
          borderWidth: 2,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#1e293b",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#3b82f6",
          tension: 0.4,
          fill: true,
        },
      ],
    });
  }, [period]);

  return <Line options={chartOptions} data={chartData} />;
};

const OperatorConsumptionChart = ({ data }) => {
  const chartData = {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: "Energy Consumption",
        data: data,
        borderColor: "#3b82f6",
        backgroundColor: (context) => {
          if (!context.chart.ctx) return "rgba(0,0,0,0)";
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, "#3b82f640");
          gradient.addColorStop(1, "#3b82f600");
          return gradient;
        },
        tension: 0.4,
        fill: true,
      },
    ],
  };
  return <Line options={chartOptions} data={chartData} />;
};

const ProductionChart = () => {
  const data = {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: "Energy Production",
        data: generateOperatorChartData(30, 20, 40),
        backgroundColor: "#10b981",
      },
    ],
  };
  return <Bar options={chartOptions} data={data} />;
};

// --- LEAFLET HEATMAP COMPONENT ---

  useEffect(() => {
    // Load Leaflet libraries from CDN
    

    if (heatLayerRef.current) {
      mapInstance.current.removeLayer(heatLayerRef.current);
    }

    // Generate appropriate data based on zoom level
    let heatData;
    let heatOptions;

    if (zoomLevel >= 14) {
      // Ultra-detailed view - maximum granularity
      heatData = generateDetailedHeatmapData(regionalData, liveData, zoomLevel);
      heatOptions = {
        radius: 20,
        blur: 10,
        maxZoom: 18,
        minOpacity: 0.1,
        gradient: {
          0.0: "rgba(0, 100, 255, 0)", // Transparent blue
          0.1: "rgba(0, 150, 255, 0.7)", // Light blue - Economical
          0.25: "rgba(0, 255, 200, 0.8)", // Cyan - Low consumption
          0.4: "rgba(100, 255, 100, 0.8)", // Light green - Moderate low
          0.55: "rgba(200, 255, 0, 0.9)", // Yellow-green - Moderate
          0.7: "rgba(255, 200, 0, 0.95)", // Orange - High
          0.85: "rgba(255, 100, 0, 1.0)", // Dark orange - Very high
          1.0: "rgba(255, 0, 0, 1.0)", // Red - Critical
        },
      };
    } else if (zoomLevel >= 12) {
      // Detailed view - show sub-areas
      heatData = generateDetailedHeatmapData(regionalData, liveData, zoomLevel);
      heatOptions = {
        radius: 30,
        blur: 18,
        maxZoom: 18,
        minOpacity: 0.2,
        gradient: {
          0.0: "rgba(0, 100, 255, 0)",
          0.15: "rgba(0, 150, 255, 0.7)", // Blue - Economical
          0.3: "rgba(0, 255, 150, 0.8)", // Cyan - Low
          0.45: "rgba(100, 255, 100, 0.85)", // Green - Moderate
          0.6: "rgba(200, 255, 0, 0.9)", // Yellow - High
          0.75: "rgba(255, 150, 0, 0.95)", // Orange - Very high
          1.0: "rgba(255, 0, 0, 1.0)", // Red - Critical
        },
      };
    } else {
      // Regional view - show main regions
      heatData = generateHeatmapData(regionalData, liveData);
      heatOptions = {
        radius: 45,
        blur: 30,
        maxZoom: 18,
        minOpacity: 0.3,
        gradient: {
          0.0: "rgba(0, 100, 255, 0)",
          0.2: "rgba(0, 150, 255, 0.8)", // Blue - Economical
          0.4: "rgba(0, 255, 150, 0.85)", // Cyan - Low
          0.6: "rgba(150, 255, 0, 0.9)", // Yellow-green - Moderate
          0.8: "rgba(255, 150, 0, 0.95)", // Orange - High
          1.0: "rgba(255, 0, 0, 1.0)", // Red - Critical
        },
      };
    }

    // Create new heat layer with enhanced options
    heatLayerRef.current = window.L.heatLayer(heatData, heatOptions);
    heatLayerRef.current.addTo(mapInstance.current);
  };

  useEffect(() => {
    let checkLeaflet;
    let attempts = 0;
    const maxAttempts = 50;

    const initializeMap = () => {
      if (window.L && window.L.heatLayer) {
        if (mapRef.current && !mapInstance.current) {
          const mangaloreBounds = window.L.latLngBounds(
            [12.75, 74.75],
            [13.05, 75.0]
          );

          mapInstance.current = window.L.map(mapRef.current, {
            center: [12.9141, 74.856],
            zoom: 11,
            minZoom: 10,
            maxZoom: 16,
            maxBounds: mangaloreBounds,
            maxBoundsViscosity: 1.0,
          });

          // Add tile layer
          window.L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }
          ).addTo(mapInstance.current);

          // Add zoom event listener
          mapInstance.current.on("zoomend", () => {
            const zoom = mapInstance.current.getZoom();
            setCurrentZoom(zoom);
            updateHeatmapData(zoom);
          });

          // Add regional labels
          Object.keys(regionalHeatmapData).forEach((regionKey) => {
            const region = regionalHeatmapData[regionKey];
            const regionInfo = regionalData[regionKey];

            const marker = window.L.marker(region.center, {
              icon: window.L.divIcon({
                className: "region-label",
                html: `<div style="background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap;">
                  ${regionInfo.name}<br>
                  <span style="color: #60a5fa;">${regionInfo.forecasts.day.value} ${regionInfo.forecasts.day.unit}</span>
                </div>`,
                iconSize: [120, 40],
                iconAnchor: [60, 20],
              }),
            });
            marker.addTo(mapInstance.current);
          });

          // Initial heatmap
          updateHeatmapData(11);

          setTimeout(() => mapInstance.current?.invalidateSize(), 100);
        }
        return true;
      }
      return false;
    };

    checkLeaflet = setInterval(() => {
      attempts++;
      if (initializeMap() || attempts >= maxAttempts) {
        clearInterval(checkLeaflet);
      }
    }, 100);

    return () => {
      if (checkLeaflet) clearInterval(checkLeaflet);
    };
  }, []);

  // Update heatmap when data changes
  useEffect(() => {
    if (mapInstance.current) {
      updateHeatmapData(currentZoom);
    }
  }, [regionalData, liveData, currentZoom]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        id="operatorMap"
        className="w-full h-full rounded-lg z-10"
        style={{ height: "calc(100vh - 12rem)" }}
      ></div>

      {/* Enhanced Professional Heatmap Legend - Always Visible */}
      <div className="absolute top-4 right-4 bg-black/95 backdrop-blur-md p-5 rounded-xl border border-gray-400 shadow-2xl text-sm min-w-[280px] z-[9999] pointer-events-auto">
        <div className="flex items-center mb-3">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-red-500 rounded-full mr-2"></div>
          <h4 className="text-white font-bold text-base">
            Mangalore Energy Consumption
          </h4>
        </div>

        {/* Gradient Bar */}
        <div className="mb-4">
          <div className="h-4 rounded-lg bg-gradient-to-r from-blue-500 via-cyan-400 via-lime-400 via-yellow-400 to-red-500 mb-2 shadow-inner"></div>
          <div className="flex justify-between text-xs text-gray-200">
            <span>0 MWh</span>
            <span>200 MWh</span>
            <span>400+ MWh</span>
          </div>
        </div>

        {/* Intensity Levels */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 mr-2 rounded-full shadow-sm"></div>
              <span className="text-white text-sm">Minimal</span>
            </div>
            <span className="text-gray-200 text-xs">0-100 MWh</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-cyan-400 mr-2 rounded-full shadow-sm"></div>
              <span className="text-white text-sm">Low</span>
            </div>
            <span className="text-gray-200 text-xs">100-200 MWh</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-lime-400 mr-2 rounded-full shadow-sm"></div>
              <span className="text-white text-sm">Moderate</span>
            </div>
            <span className="text-gray-200 text-xs">200-300 MWh</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-400 mr-2 rounded-full shadow-sm"></div>
              <span className="text-white text-sm">High</span>
            </div>
            <span className="text-gray-200 text-xs">300-400 MWh</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 mr-2 rounded-full shadow-sm"></div>
              <span className="text-white text-sm">Critical</span>
            </div>
            <span className="text-gray-200 text-xs">400+ MWh</span>
          </div>
        </div>

        {/* Status Info */}
        <div className="pt-3 border-t border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-xs font-medium">Zoom Level:</span>
            <span className="text-cyan-400 text-xs font-bold">
              {currentZoom}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-xs font-medium">View Mode:</span>
            <span className="text-lime-400 text-xs font-bold">
              {currentZoom >= 14
                ? "Ultra-Detailed"
                : currentZoom >= 12
                ? "Detailed"
                : "Regional"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white text-xs font-medium">Data Points:</span>
            <span className="text-yellow-400 text-xs font-bold">
              {currentZoom >= 14 ? "500+" : currentZoom >= 12 ? "200+" : "100+"}
            </span>
          </div>
        </div>

        {/* Total Mangalore Consumption */}
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-xs font-medium">
              Total Mangalore:
            </span>
            <span className="text-yellow-400 text-xs font-bold">
              {calculateTotalMangaloreConsumption(
                regionalData,
                liveData
              ).toFixed(1)}{" "}
              MWh
            </span>
          </div>
          <div className="text-gray-200 text-xs">
            All 6 regions combined • Real-time adjusted
          </div>
        </div>

        {/* Live Status Indicator */}
        {liveData && (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              <span className="text-green-400 text-xs font-medium">
                Live Federated Data
              </span>
            </div>
            <div className="text-gray-200 text-xs mt-1">
              Updated: {new Date(liveData.timestamp_utc).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Controls Info - Always Visible */}
      <div className="absolute bottom-4 left-4 bg-black/95 backdrop-blur-md p-4 rounded-xl border border-gray-400 shadow-2xl text-xs max-w-[300px] z-[9999] pointer-events-auto">
        <div className="flex items-center mb-2">
          <svg
            className="w-4 h-4 text-blue-400 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-white font-semibold">Interactive Heatmap</span>
        </div>
        <div className="space-y-1 text-white">
          <p>
            <span className="font-semibold text-cyan-400">Zoom in</span> for
            detailed sub-area predictions
          </p>
          <p>
            <span className="font-semibold text-lime-400">Pan around</span> to
            explore different regions
          </p>
          <p className="text-gray-200 mt-2 text-xs">
            Powered by federated learning model predictions from{" "}
            {liveData?.total_nodes || 6} nodes
          </p>
        </div>
      </div>

      {/* Data Source Info - Always Visible */}
      <div className="absolute top-4 left-4 bg-black/95 backdrop-blur-md p-3 rounded-xl border border-gray-400 shadow-2xl text-xs z-[9999] pointer-events-auto">
        <div className="flex items-center mb-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
          <span className="text-white font-semibold">Mangalore Grid</span>
        </div>
        <div className="text-gray-200">
          <div>6 Regional Zones</div>
          <div>{liveData ? "Live" : "Static"} Predictions</div>
          <div className="text-yellow-400 text-xs font-bold mt-1">
            Total:{" "}
            {calculateTotalMangaloreConsumption(regionalData, liveData).toFixed(
              1
            )}{" "}
            MWh
          </div>
          <div className="text-xs mt-1 text-gray-300">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- WALLET AUTHENTICATION COMPONENT ---

const WalletAuthView = ({ onWalletConnect }) => {
  return <WalletConnect onConnect={onWalletConnect} />;
};

// --- VIEW COMPONENTS ---

const UserView = ({ walletInfo, onDisconnect }) => {
  const [period, setPeriod] = useState("day");
  const [prediction, setPrediction] = useState(null);
  const [predictionPeriod, setPredictionPeriod] = useState("24h");
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [showBillPayment, setShowBillPayment] = useState(false);

  // Fetch live prediction data - STATIC VERSION (no polling)
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLatestPrediction();
      if (data) {
        setLiveData(data);
        setLastUpdate(new Date(data.timestamp_utc));
      }
    };

    // Only fetch once on component mount
    fetchData();
  }, []);

  const fetchDynamicPrediction = async (period = predictionPeriod) => {
    setPredictionLoading(true);
    try {
      const response = await fetch(
        `http://127.0.0.1:5000/get-prediction?period=${period}&user_address=${walletInfo.address}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPrediction(data);
    } catch (error) {
      console.error("Error fetching prediction:", error);
      // Fallback to static prediction
      const fallbackValue =
        period === "24h" ? 35 : period === "7d" ? 245 : 1050;
      const variation = (Math.random() - 0.5) * 0.2;
      setPrediction({
        prediction: {
          value: (fallbackValue * (1 + variation)).toFixed(1),
          unit: "kWh",
          confidence: 85 + Math.random() * 10,
        },
        period: period,
        metadata: { model_version: "fallback" },
      });
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleSimulate = () => {
    fetchDynamicPrediction();
  };

  const handlePredictionPeriodChange = (newPeriod) => {
    setPredictionPeriod(newPeriod);
    if (prediction) {
      fetchDynamicPrediction(newPeriod);
    }
  };

  return (
    <>
      <header className="bg-slate-900 sticky top-0 z-50 border-b border-slate-600">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <svg
                className="h-8 w-8 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m13.5 10.5-3 3"></path>
                <path d="m10.5 10.5 3 3"></path>
              </svg>
              <h1 className="text-xl font-bold text-slate-100">FedGrid User</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-slate-400 text-sm hidden sm:block">
                {walletInfo.address.slice(0, 6)}...
                {walletInfo.address.slice(-4)}
              </span>
              <button
                onClick={onDisconnect}
                className="flex items-center justify-center px-4 py-2 text-slate-300 rounded-lg transition-colors bg-slate-800 hover:bg-red-500 hover:text-white"
              >
                <SignOutIcon />{" "}
                <span className="hidden sm:inline ml-2">Disconnect</span>
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Current Power Prediction
              </h2>
              <div className="flex items-baseline space-x-2">
                <p className="text-5xl font-bold text-slate-100">
                  {liveData
                    ? (liveData.predicted_24h_sum_kw / 1000).toFixed(2)
                    : "0.035"}
                </p>
                <span className="text-lg text-slate-400">MWh</span>
              </div>
              <div className="flex items-center mt-2">
                <span
                  className={`text-sm mr-2 ${
                    liveData?.status === "✅ Success"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {liveData?.status || "✅ Success"}
                </span>
                {liveData && (
                  <span className="text-sm text-slate-400">
                    Error: {liveData.error_percent}%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {lastUpdate
                  ? `Last update: ${lastUpdate.toLocaleTimeString()}`
                  : "Waiting for data..."}
              </p>
              {liveData && (
                <div className="mt-3 p-2 bg-slate-800 rounded text-xs">
                  <div className="text-slate-300">
                    Actual: {(liveData.actual_24h_sum_kw / 1000).toFixed(2)} MWh
                  </div>
                  <div className="text-slate-400">
                    Model: {liveData.model_version}
                  </div>
                  {liveData.federated_nodes && (
                    <div className="text-blue-400 mt-1">
                      Federated: {liveData.total_nodes} nodes •{" "}
                      {liveData.federated_error_percent}% error
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
              <h2 className="text-lg font-semibold text-slate-100 mb-4">
                Predict Future Consumption
              </h2>
              <div className="space-y-4">
                <select
                  value={predictionPeriod}
                  onChange={(e) => handlePredictionPeriodChange(e.target.value)}
                  className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-100"
                >
                  <option value="24h">Next 24 Hours</option>
                  <option value="7d">Next 7 Days</option>
                  <option value="30d">Next 30 Days</option>
                </select>
                <button
                  onClick={handleSimulate}
                  disabled={predictionLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  {predictionLoading ? "Generating..." : "Generate Prediction"}
                </button>
                {prediction && (
                  <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                    <div className="text-center">
                      <p className="text-slate-400 text-sm">
                        Predicted Consumption:
                      </p>
                      <p className="text-2xl font-bold text-blue-500">
                        {prediction.prediction?.value}{" "}
                        {prediction.prediction?.unit}
                      </p>
                    </div>

                    {prediction.prediction?.confidence && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Confidence:</span>
                        <span className="text-green-400">
                          {prediction.prediction.confidence}%
                        </span>
                      </div>
                    )}

                    {prediction.breakdown && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Base Load:</span>
                          <span className="text-slate-300">
                            {prediction.breakdown.base_load}{" "}
                            {prediction.prediction?.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Variable Load:</span>
                          <span className="text-slate-300">
                            {prediction.breakdown.variable_load}{" "}
                            {prediction.prediction?.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Peak Load:</span>
                          <span className="text-slate-300">
                            {prediction.breakdown.peak_load}{" "}
                            {prediction.prediction?.unit}
                          </span>
                        </div>
                      </div>
                    )}

                    {prediction.metadata && (
                      <div className="text-xs text-slate-500 text-center">
                        Model: {prediction.metadata.model_version} | Period:{" "}
                        {prediction.period}
                        {prediction.metadata.user_personalized &&
                          " | Personalized"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bill Payment Card */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-6 rounded-lg border border-slate-600 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <svg
                    className="w-6 h-6 mr-2 text-blue-300"
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
                  Pay Electricity Bill
                </h2>
                <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold animate-pulse">
                  NEW
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-100">Current Month Bill:</span>
                  <span className="text-2xl font-bold text-white">
                    ~0.0001 ETH
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-200">Estimated USD:</span>
                  <span className="text-slate-100">~$0.25</span>
                </div>

                {/* Transaction Preview */}
                <div className="bg-slate-800/30 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-200">From:</span>
                    <span className="font-mono text-slate-100">
                      {walletInfo.address.slice(0, 6)}...
                      {walletInfo.address.slice(-4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center my-1">
                    <svg
                      className="w-4 h-4 text-blue-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">To:</span>
                    <span className="font-mono text-slate-100">
                      0x742d...Da5A
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowBillPayment(true)}
                  className="w-full bg-white text-blue-700 font-bold py-3 px-4 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2 group"
                >
                  <svg
                    className="w-5 h-5 group-hover:scale-110 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Pay with MetaMask</span>
                </button>

                <p className="text-xs text-slate-200 text-center">
                  Real blockchain transaction • Sepolia Testnet
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-700 p-6 rounded-lg border border-slate-600">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-100 mb-2 sm:mb-0">
                Power Consumption
              </h2>
              <div className="flex items-center bg-slate-800 p-1 rounded-lg">
                {["Day", "Week", "Month", "Year"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p.toLowerCase())}
                    className={`timespan-btn px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                      period === p.toLowerCase()
                        ? "bg-blue-500 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative" style={{ height: "50vh" }}>
              <UserConsumptionChart period={period} />
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Bill Payment Button */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-4 z-50">
        {/* Large Bill Payment Button with Text */}
        <div className="relative">
          <button
            onClick={() => setShowBillPayment(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-4 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-green-500/25 flex items-center space-x-3 group"
            title="Pay Your Electricity Bill with Crypto"
          >
            <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
              <svg
                className="w-8 h-8"
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
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">Pay Bill</div>
              <div className="text-sm opacity-90">~0.0001 ETH</div>
            </div>
          </button>

          {/* Pulsing indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-pulse"></div>

          {/* Tooltip arrow */}
          <div className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            Click to pay your electricity bill
            <div className="absolute left-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-l-gray-900"></div>
          </div>
        </div>

        {/* Smaller Chat Button */}
        <button
          onClick={() => setShowChat(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center space-x-2"
          title="Open FedGrid AI Assistant"
        >
          <ChatIcon />
          <span className="text-sm font-medium">Chat</span>
        </button>
      </div>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-600">
              <h2 className="text-xl font-bold text-slate-100">
                FedGrid AI Assistant
              </h2>
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatBot />
            </div>
          </div>
        </div>
      )}

      {/* Bill Payment Modal */}
      {showBillPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-600">
              <h2 className="text-xl font-bold text-slate-100">
                Electricity Bill Payment
              </h2>
              <button
                onClick={() => setShowBillPayment(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <BillPayment
                walletInfo={walletInfo}
                onPaymentSuccess={(payment) => {
                  console.log("Payment successful:", payment);
                  setShowBillPayment(false);
                  alert(
                    "Payment successful! Check your transaction on Etherscan."
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const OperatorView = ({ walletInfo, onDisconnect }) => {
  const [subView, setSubView] = useState("dashboard");
  const [region, setRegion] = useState("north_mangaluru");
  const [regionalData, setRegionalData] = useState(initialRegionalData);
  const [consumptionChartData, setConsumptionChartData] = useState(
    generateOperatorChartData(30, 135, 150)
  );
  const [modalInfo, setModalInfo] = useState({
    show: false,
    title: "",
    message: "",
  });
  const [liveData, setLiveData] = useState(null);
  const [previousData, setPreviousData] = useState(null);
  const [insightQueue, setInsightQueue] = useState([]);
  const [regionalDataLoading, setRegionalDataLoading] = useState(false);

  // Fetch regional data from API on component mount
  useEffect(() => {
    const fetchRegionalData = async () => {
      setRegionalDataLoading(true);
      try {
        const response = await fetch("http://127.0.0.1:5000/get-regional-data");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.regions) {
          setRegionalData(data.regions);
        }
      } catch (error) {
        console.error("Error fetching regional data:", error);
        // Keep using initialRegionalData as fallback
      } finally {
        setRegionalDataLoading(false);
      }
    };

    fetchRegionalData();
  }, []);

  // Comprehensive random operational insights for demonstration
  const randomOperationalInsights = [
    {
      type: "critical",
      title: "Transformer Overload Warning",
      message:
        "Transformer T-204 in South Mangalore operating at 94% capacity. Recommend load redistribution to adjacent feeders within 30 minutes to prevent equipment failure.",
      icon: "🔥",
      action: "Redistribute load to T-205 and T-206",
    },
    {
      type: "warning",
      title: "Peak Demand Forecast",
      message:
        "Predicted 18% demand surge at 7:30 PM today. Activate demand response protocols and notify industrial consumers to shift non-critical loads.",
      icon: "📈",
      action: "Enable DR protocols, contact major consumers",
    },
    {
      type: "info",
      title: "Renewable Integration Opportunity",
      message:
        "Solar generation in West Mangalore at 87% efficiency. Optimal conditions for battery storage charging. Recommend activating grid-scale storage systems.",
      icon: "☀️",
      action: "Activate battery storage, optimize solar dispatch",
    },
    {
      type: "success",
      title: "Grid Optimization Success",
      message:
        "Federated learning model achieved 96.2% accuracy. Power loss reduced by 12% compared to last month. System operating at peak efficiency.",
      icon: "✅",
      action: "Continue current optimization parameters",
    },
    {
      type: "warning",
      title: "Voltage Regulation Alert",
      message:
        "Voltage fluctuations detected in East Mangalore (±3.2%). Deploy automatic voltage regulators and check capacitor bank status immediately.",
      icon: "⚡",
      action: "Deploy AVRs, inspect capacitor banks",
    },
    {
      type: "info",
      title: "Predictive Maintenance Due",
      message:
        "Circuit breaker CB-156 showing 89% health score. Schedule maintenance within 72 hours to prevent unexpected outages during peak season.",
      icon: "🔧",
      action: "Schedule CB-156 maintenance, prepare backup",
    },
    {
      type: "critical",
      title: "Emergency Load Shedding Required",
      message:
        "System frequency dropping to 49.7 Hz. Implement Stage-2 load shedding in non-essential areas. Estimated restoration time: 45 minutes.",
      icon: "🚨",
      action: "Execute load shedding protocol Stage-2",
    },
    {
      type: "success",
      title: "Smart Meter Data Quality",
      message:
        "99.4% of smart meters reporting accurate data. Real-time analytics improving demand forecasting by 23%. Grid visibility at optimal levels.",
      icon: "📊",
      action: "Maintain current data collection protocols",
    },
    {
      type: "warning",
      title: "Weather Impact Assessment",
      message:
        "Monsoon forecast indicates 85mm rainfall in next 6 hours. Pre-position emergency crews and activate flood-prone substation protection protocols.",
      icon: "🌧️",
      action: "Deploy emergency teams, activate flood protection",
    },
    {
      type: "info",
      title: "Energy Storage Optimization",
      message:
        "Battery storage systems at 78% capacity. Optimal discharge window opening at 6 PM. Configure for peak shaving to reduce grid stress.",
      icon: "🔋",
      action: "Program battery discharge for peak hours",
    },
    {
      type: "warning",
      title: "Cybersecurity Scan Alert",
      message:
        "Unusual network activity detected on SCADA system. Recommend immediate security audit and temporary isolation of affected communication nodes.",
      icon: "🛡️",
      action: "Initiate security audit, isolate affected nodes",
    },
    {
      type: "success",
      title: "Carbon Emission Reduction",
      message:
        "Grid carbon intensity reduced to 0.42 kg CO2/kWh - 15% improvement this quarter. Renewable integration strategies proving highly effective.",
      icon: "🌱",
      action: "Continue renewable integration expansion",
    },
    {
      type: "info",
      title: "Dynamic Pricing Opportunity",
      message:
        "Low demand period detected (2-5 AM). Implement time-of-use pricing to encourage off-peak consumption and improve load factor by 8%.",
      icon: "💰",
      action: "Activate dynamic pricing, notify consumers",
    },
    {
      type: "warning",
      title: "Harmonic Distortion Detection",
      message:
        "Total Harmonic Distortion at 6.2% in industrial zone. Install active filters to protect sensitive equipment and improve power quality.",
      icon: "📡",
      action: "Deploy harmonic filters, monitor THD levels",
    },
    {
      type: "critical",
      title: "Substation Equipment Failure",
      message:
        "Protection relay R-89 failed self-test. Backup protection active but redundancy compromised. Replace within 4 hours to maintain N-1 security.",
      icon: "⚠️",
      action: "Emergency relay replacement, maintain backup",
    },
    {
      type: "success",
      title: "Demand Response Achievement",
      message:
        "Industrial consumers reduced load by 2.3 MW during peak hours. Avoided need for expensive peaker plant activation, saving ₹1.2 lakhs.",
      icon: "🎯",
      action: "Reward participating consumers, expand DR program",
    },
    {
      type: "info",
      title: "Grid Modernization Update",
      message:
        "Phase-2 smart grid deployment 67% complete. Advanced metering infrastructure improving outage detection time by 78% in covered areas.",
      icon: "🏗️",
      action: "Continue Phase-2 rollout, monitor performance",
    },
    {
      type: "warning",
      title: "Transmission Line Monitoring",
      message:
        "Conductor temperature on Line-34 reaching 85°C. Reduce loading by 15% and inspect for vegetation encroachment or conductor damage.",
      icon: "🌡️",
      action: "Reduce line loading, schedule inspection",
    },
  ];

  // Generate intelligent insights based on prediction data
  const generateInsights = (currentData, prevData) => {
    const insights = [];

    if (!prevData || !currentData.federated_nodes) return insights;

    // Analyze federated nodes for anomalies
    currentData.federated_nodes.forEach((node, index) => {
      const prevNode = prevData.federated_nodes?.[index];
      if (!prevNode) return;

      const consumptionChange =
        ((node.local_prediction_kw - prevNode.local_prediction_kw) /
          prevNode.local_prediction_kw) *
        100;
      const accuracyChange = node.accuracy_score - prevNode.accuracy_score;

      // High consumption increase alert
      if (consumptionChange > 15) {
        insights.push({
          type: "warning",
          title: "High Consumption Alert",
          message: `${node.node_name} shows ${consumptionChange.toFixed(
            1
          )}% increase in energy consumption. Check transformer load capacity and grid stability.`,
          icon: "⚡",
        });
      }

      // Low consumption alert
      if (consumptionChange < -20) {
        insights.push({
          type: "info",
          title: "Consumption Drop Detected",
          message: `${node.node_name} consumption dropped by ${Math.abs(
            consumptionChange
          ).toFixed(1)}%. Possible load shedding or equipment maintenance.`,
          icon: "📉",
        });
      }

      // Accuracy degradation
      if (accuracyChange < -5) {
        insights.push({
          type: "warning",
          title: "Model Performance Alert",
          message: `${
            node.node_name
          } prediction accuracy decreased by ${Math.abs(accuracyChange).toFixed(
            1
          )}%. Consider model retraining or data quality check.`,
          icon: "🔧",
        });
      }

      // High accuracy improvement
      if (accuracyChange > 3) {
        insights.push({
          type: "success",
          title: "Performance Improvement",
          message: `${
            node.node_name
          } shows improved prediction accuracy (+${accuracyChange.toFixed(
            1
          )}%). Federated learning optimization successful.`,
          icon: "✅",
        });
      }
    });

    // Overall system insights
    const errorChange =
      currentData.federated_error_percent - prevData.federated_error_percent;

    if (errorChange > 3) {
      insights.push({
        type: "critical",
        title: "System-wide Accuracy Drop",
        message: `Federated model error increased by ${errorChange.toFixed(
          1
        )}%. Grid instability detected. Recommend immediate load balancing review.`,
        icon: "🚨",
      });
    }

    if (currentData.predicted_24h_sum_kw > 2800) {
      insights.push({
        type: "warning",
        title: "Peak Load Warning",
        message: `Predicted consumption of ${(
          currentData.predicted_24h_sum_kw / 1000
        ).toFixed(
          1
        )} MWh approaching grid capacity. Activate demand response protocols.`,
        icon: "⚠️",
      });
    }

    if (currentData.federated_error_percent < 3) {
      insights.push({
        type: "success",
        title: "Optimal Grid Performance",
        message: `Federated learning achieving ${(
          100 - currentData.federated_error_percent
        ).toFixed(1)}% accuracy. All regional nodes operating efficiently.`,
        icon: "🎯",
      });
    }

    // Random operational insights
    const randomInsights = [
      {
        type: "info",
        title: "Transformer Load Analysis",
        message: `South Mangalore transformer T-204 operating at 87% capacity. Schedule maintenance during low-demand hours.`,
        icon: "🔌",
      },
      {
        type: "info",
        title: "Renewable Integration",
        message: `Solar generation in West Mangalore contributing 23% to local grid. Optimal weather conditions detected.`,
        icon: "☀️",
      },
      {
        type: "warning",
        title: "Load Balancing Required",
        message: `East Mangalore showing 15% higher load than predicted. Consider load redistribution to adjacent feeders.`,
        icon: "⚖️",
      },
      {
        type: "info",
        title: "Smart Meter Update",
        message: `1,247 smart meters in North Mangalore updated with latest firmware. Real-time data accuracy improved.`,
        icon: "📊",
      },
    ];

    // Add random insight occasionally (20% chance)
    if (Math.random() < 0.2 && insights.length < 2) {
      const randomInsight =
        randomInsights[Math.floor(Math.random() * randomInsights.length)];
      insights.push(randomInsight);
    }

    return insights;
  };

  // Display insights as pop-ups - DISABLED to prevent flickering
  // useEffect(() => {
  //   if (insightQueue.length > 0) {
  //     const insight = insightQueue[0];
  //     setModalInfo({
  //       show: true,
  //       title: `${insight.icon} ${insight.title}`,
  //       message: insight.message,
  //       type: insight.type,
  //     });

  //     // Remove the displayed insight from queue
  //     setInsightQueue((prev) => prev.slice(1));
  //   }
  // }, [insightQueue]);

  // Fetch live prediction data for operator view - STATIC VERSION (no polling)
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLatestPrediction();
      if (data) {
        setLiveData(data);
      }
    };

    // Only fetch once on component mount
    fetchData();
  }, []); // No dependencies to prevent re-fetching

  // Random operational insights timer - shows insights every minute for demo
  useEffect(() => {
    const showRandomInsight = () => {
      const randomInsight =
        randomOperationalInsights[
          Math.floor(Math.random() * randomOperationalInsights.length)
        ];

      setModalInfo({
        show: true,
        title: `${randomInsight.icon} ${randomInsight.title}`,
        message: `${randomInsight.message}\n\nRecommended Action: ${randomInsight.action}`,
        type: randomInsight.type,
      });
    };

    // Show first insight after 10 seconds, then every minute
    const initialTimeout = setTimeout(showRandomInsight, 10000);
    const interval = setInterval(showRandomInsight, 60000); // Every 60 seconds

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []); // Run once on component mount

  // Dashboard value updates disabled to keep all charts and data static
  // useEffect(() => {
  //   if (liveData) {
  //     // Update regional data based on federated learning aggregation
  //     const updatedData = { ...regionalData };
  //     Object.keys(updatedData).forEach((key) => {
  //       // Simulate federated learning: each region contributes to the global model
  //       const regionWeight = Math.random() * 0.3 + 0.85; // 0.85-1.15 weight factor
  //       const federatedPrediction =
  //         (liveData.predicted_24h_sum_kw / 1000) * regionWeight;
  //       updatedData[key].forecasts.day.value = parseFloat(
  //         federatedPrediction.toFixed(1)
  //       );

  //       // Also update weekly and monthly forecasts based on daily
  //       updatedData[key].forecasts.week.value = parseFloat(
  //         (federatedPrediction * 7).toFixed(1)
  //       );
  //       updatedData[key].forecasts.month.value = parseFloat(
  //         ((federatedPrediction * 30) / 1000).toFixed(1)
  //       );

  //       // Update efficiency based on prediction accuracy
  //       const accuracy = 100 - liveData.federated_error_percent;
  //       updatedData[key].efficiency = Math.max(
  //         85,
  //         Math.min(98, Math.round(accuracy))
  //       );
  //     });
  //     setRegionalData(updatedData);
  //   }
  // }, [liveData?.prediction_id]); // Only update when we get a new prediction

  const data = regionalData[region];

  const Sidebar = () => (
    <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="flex items-center space-x-3 h-16 px-4 border-b border-slate-700">
        <svg
          className="h-8 w-8 text-blue-500"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m13.5 10.5-3 3"></path>
          <path d="m10.5 10.5 3 3"></path>
        </svg>
        <h1 className="text-xl font-bold text-slate-100">FedGrid Operator</h1>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSubView("dashboard");
          }}
          className={`flex items-center px-4 py-2.5 rounded-lg transition-colors hover:bg-blue-500 hover:text-white ${
            subView === "dashboard"
              ? "bg-blue-500 text-white"
              : "text-slate-400"
          }`}
        >
          <DashboardIcon /> Dashboard
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSubView("heatmap");
          }}
          className={`flex items-center px-4 py-2.5 rounded-lg transition-colors hover:bg-blue-500 hover:text-white ${
            subView === "heatmap" ? "bg-blue-500 text-white" : "text-slate-400"
          }`}
        >
          <HeatmapIcon /> Heatmap
        </a>

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSubView("chat");
          }}
          className={`flex items-center px-4 py-2.5 rounded-lg transition-colors hover:bg-blue-500 hover:text-white ${
            subView === "chat" ? "bg-blue-500 text-white" : "text-slate-400"
          }`}
        >
          <ChatIcon /> FedGrid AI
        </a>
      </nav>
      <div className="px-4 py-4 mt-auto border-t border-slate-700">
        <div className="px-4 py-3 rounded-lg bg-slate-800">
          <p className="text-sm font-medium text-white">Wallet Address</p>
          <p className="text-xs text-slate-400 truncate">
            {walletInfo.address}
          </p>
        </div>
        <div className="px-4 py-3 rounded-lg bg-slate-800">
          <p className="text-sm font-medium text-white">Network</p>
          <p className="text-xs text-slate-400">
            {walletInfo.network} (Chain ID: {walletInfo.chainId})
          </p>
        </div>
        <button
          onClick={onDisconnect}
          className="flex items-center justify-center w-full mt-4 px-4 py-2.5 text-slate-300 rounded-lg transition-colors bg-slate-800 hover:bg-red-500 hover:text-white"
        >
          <SignOutIcon /> Disconnect Wallet
        </button>
      </div>
    </aside>
  );

  const Dashboard = () => (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Energy Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Viewing data for the {regionalData[region].name} region.
          </p>
        </div>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="w-full sm:w-auto mt-4 sm:mt-0 bg-slate-700 border border-slate-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100"
        >
          {Object.keys(regionalData).map((regionKey) => (
            <option key={regionKey} value={regionKey}>
              {regionalData[regionKey].name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="lg:col-span-1 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4 flex items-center">
            <DailyForecastIcon />
            Daily Forecast
          </h3>
          <p
            className={`text-4xl font-bold ${
              data.forecasts.day.value === 0 ? "text-red-500" : "text-slate-100"
            }`}
          >
            {data.forecasts.day.value}{" "}
            <span className="text-2xl text-slate-400">
              {data.forecasts.day.unit}
            </span>
          </p>
          <p className="text-sm text-slate-400 mt-2">92% confidence</p>
        </div>
        <div className="lg:col-span-1 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4 flex items-center">
            <WeeklyForecastIcon />
            Weekly Forecast
          </h3>
          <p className="text-4xl font-bold text-slate-100">
            {data.forecasts.week.value}{" "}
            <span className="text-2xl text-slate-400">
              {data.forecasts.week.unit}
            </span>
          </p>
          <p className="text-sm text-slate-400 mt-2">89% confidence</p>
        </div>
        <div className="lg:col-span-1 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4 flex items-center">
            <MonthlyForecastIcon />
            Monthly Forecast
          </h3>
          <p className="text-4xl font-bold text-slate-100">
            {data.forecasts.month.value}{" "}
            <span className="text-2xl text-slate-400">
              {data.forecasts.month.unit}
            </span>
          </p>
          <p className="text-sm text-slate-400 mt-2">85% confidence</p>
        </div>
        <div className="lg:col-span-1 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4 flex items-center">
            <GridEfficiencyIcon />
            Grid Efficiency
          </h3>
          <p className="text-4xl font-bold text-emerald-500">
            {data.efficiency}%
          </p>
          <p className="text-sm text-slate-400 mt-2">Real-time performance</p>
        </div>
        <div className="md:col-span-2 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-slate-400">Regional Trends</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">Live</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-blue-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <p className="text-sm text-slate-400">Avg Consumption</p>
              </div>
              <p className="text-3xl font-bold text-slate-100">
                {data.trends.avgConsumption}{" "}
                <span className="text-lg text-slate-400">kWh</span>
              </p>
              <div className="flex items-center justify-center mt-2">
                <span className="text-xs text-green-400">↗ +2.3%</span>
                <span className="text-xs text-slate-500 ml-1">
                  vs last month
                </span>
              </div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <svg
                  className="w-5 h-5 text-emerald-400 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-sm text-slate-400">Total Consumers</p>
              </div>
              <p className="text-3xl font-bold text-slate-100">
                {data.trends.users.toLocaleString()}
              </p>
              <div className="flex items-center justify-center mt-2">
                <span className="text-xs text-green-400">↗ +47</span>
                <span className="text-xs text-slate-500 ml-1">
                  new this week
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                <span className="text-sm text-slate-300">Peak Load Today</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-100">
                  {((data.forecasts.day.value / 24) * 1.5).toFixed(1)} MW
                </span>
                <div className="text-xs text-slate-400">at 7:30 PM</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3"></div>
                <span className="text-sm text-slate-300">Grid Stability</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-emerald-400">
                  Excellent
                </span>
                <div className="text-xs text-slate-400">99.7% uptime</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm text-slate-300">
                  Total Mangalore Consumption
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-100">
                  {calculateTotalMangaloreConsumption(
                    regionalData,
                    liveData
                  ).toFixed(1)}{" "}
                  MWh
                </span>
                <div className="text-xs text-green-400">
                  {(() => {
                    // Calculate percentage change based on intelligent factors
                    const currentHour = new Date().getHours();
                    const baseChange = Math.random() * 10 - 2; // Random between -2% to +8%

                    // Adjust based on time of day
                    let timeAdjustment = 0;
                    if (
                      (currentHour >= 7 && currentHour <= 9) ||
                      (currentHour >= 18 && currentHour <= 21)
                    ) {
                      timeAdjustment = 5; // Higher during peak hours
                    } else if (currentHour >= 22 || currentHour <= 5) {
                      timeAdjustment = -3; // Lower during night
                    }

                    const totalChange = baseChange + timeAdjustment;
                    const sign = totalChange >= 0 ? "+" : "";
                    return `${sign}${totalChange.toFixed(1)}% vs yesterday`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 lg:col-span-4 xl:col-span-2 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4">
            Energy Consumption
          </h3>
          <div className="relative h-64">
            <OperatorConsumptionChart data={consumptionChartData} />
          </div>
        </div>
        <div className="md:col-span-2 lg:col-span-4 xl:col-span-2 bg-slate-700 p-6 rounded-lg border border-slate-600">
          <h3 className="font-semibold text-slate-400 mb-4">
            Energy Production
          </h3>
          <div className="relative h-64">
            <ProductionChart />
          </div>
        </div>
        {liveData && liveData.federated_nodes && (
          <div className="md:col-span-2 lg:col-span-4 bg-slate-700 p-6 rounded-lg border border-slate-600">
            <h3 className="font-semibold text-slate-400 mb-4">
              Federated Learning Nodes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveData.federated_nodes.map((node, index) => (
                <div key={node.node_id} className="bg-slate-800 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    {node.node_name}
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weight:</span>
                      <span className="text-slate-200">
                        {(node.node_weight * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Accuracy:</span>
                      <span className="text-green-400">
                        {node.accuracy_score}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Prediction:</span>
                      <span className="text-slate-200">
                        {(() => {
                          // Scale the prediction based on node type and make it realistic
                          let scaleFactor = 100; // Default scale factor

                          // Adjust scale factor based on node name/type
                          if (
                            node.node_name.toLowerCase().includes("central")
                          ) {
                            scaleFactor = 200; // Central nodes handle more load
                          } else if (
                            node.node_name.toLowerCase().includes("industrial")
                          ) {
                            scaleFactor = 150; // Industrial areas have higher consumption
                          } else if (
                            node.node_name.toLowerCase().includes("residential")
                          ) {
                            scaleFactor = 80; // Residential areas have lower consumption
                          } else if (
                            node.node_name.toLowerCase().includes("commercial")
                          ) {
                            scaleFactor = 120; // Commercial areas have moderate-high consumption
                          }

                          const scaledPrediction =
                            (node.local_prediction_kw / 1000) * scaleFactor;
                          return scaledPrediction.toFixed(1);
                        })()}{" "}
                        MWh
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-slate-800 rounded-lg">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Aggregation Method:</span>
                <span className="text-blue-400">
                  {liveData.aggregation_method.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-slate-400">Federated Accuracy:</span>
                <span className="text-green-400">
                  {(100 - liveData.federated_error_percent).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const Heatmap = () => (
    <div>
      <h1 className="text-3xl font-bold text-slate-100 mb-6">
        Mangalore Regional Power Consumption Heatmap
      </h1>
      <p className="text-slate-400 mb-4">
        Real-time energy consumption visualization based on federated learning
        predictions. Zoom in to see detailed sub-area breakdowns.
      </p>
      <HeatmapComponent regionalData={regionalData} liveData={liveData} />
    </div>
  );

  return (
    <div className="flex w-full min-h-screen bg-slate-800 text-slate-300 font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Modal
          show={modalInfo.show}
          onClose={() => setModalInfo({ ...modalInfo, show: false })}
          title={modalInfo.title}
          type={modalInfo.type}
        >
          <p>{modalInfo.message}</p>
        </Modal>
        {subView === "dashboard" ? (
          <Dashboard />
        ) : subView === "heatmap" ? (
          <Heatmap />
        ) : (
          <div className="h-full">
            <ChatBot />
          </div>
        )}
      </main>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [walletInfo, setWalletInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load Leaflet libraries from CDN
    const loadScript = (id, src, onload) => {
      if (document.getElementById(id)) return;
      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.onload = onload;
      document.body.appendChild(script);
    };

    const leafletCss = document.createElement("link");
    leafletCss.id = "leaflet-css";
    leafletCss.rel = "stylesheet";
    leafletCss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(leafletCss);

    loadScript(
      "leaflet-js",
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      () => {
        loadScript(
          "leaflet-heat-js",
          "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js",
          () => {
            setLoading(false);
  }, []);

  // Update heatmap when data changes
  const handleWalletConnect = (wallet) => {
    setWalletInfo(wallet);
    // Save wallet info to localStorage (without sensitive data)
    const walletToSave = {
      address: wallet.address,
      userType: wallet.userType,
      network: wallet.network,
      chainId: wallet.chainId,
    };
    localStorage.setItem("fedgrid_wallet", JSON.stringify(walletToSave));
  };

  const handleWalletDisconnect = () => {
    setWalletInfo(null);
    localStorage.removeItem("fedgrid_wallet");
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="min-h-screen bg-slate-800 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading FedGrid...</p>
          </div>
        </div>
      );
    }

    if (!walletInfo) {
      return <WalletAuthView onWalletConnect={handleWalletConnect} />;
    }

    if (walletInfo.userType === "operator") {
      return (
        <OperatorView
          walletInfo={walletInfo}
          onDisconnect={handleWalletDisconnect}
        />
      );
    }

    return (
      <UserView walletInfo={walletInfo} onDisconnect={handleWalletDisconnect} />
    );
  };

  return (
    <div className="min-h-screen bg-slate-800 text-slate-300 font-sans">
      {renderContent()}
    </div>
  );
}
