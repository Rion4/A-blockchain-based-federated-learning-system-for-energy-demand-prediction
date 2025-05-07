import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler 
from sklearn.model_selection import train_test_split
from   tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.optimizers import SGD

# Load data
data = pd.read_csv('raw_data.csv')
print("First few rows of raw data:")
print(data.head())

# Filter out rows with synthetic thefts
cleaned_data = data[data['theft'] == 'Normal']

# Drop the 'theft' column (optional)
cleaned_data = cleaned_data.drop(columns=['theft'])
print("\nColumn Names in cleaned_data:")
print(cleaned_data.columns)

# Aggregate energy consumption into hourly totals
cleaned_data['Total_Electricity'] = cleaned_data[
    ['Electricity:Facility [kW](Hourly)', 'Fans:Electricity [kW](Hourly)', 'Cooling:Electricity [kW](Hourly)', 
     'Heating:Electricity [kW](Hourly)', 'InteriorLights:Electricity [kW](Hourly)']
].sum(axis=1)

cleaned_data['Total_Gas'] = cleaned_data[
    ['Gas:Facility [kW](Hourly)', 'Heating:Gas [kW](Hourly)', 'InteriorEquipment:Gas [kW](Hourly)', 
     'Water Heater:WaterSystems:Gas [kW](Hourly)']
].sum(axis=1)

print("\nAggregated Energy Consumption:")
print(cleaned_data[['Total_Electricity', 'Total_Gas']].head())

# Convert timestamp and extract day of week/weekend flag
cleaned_data['timestamp'] = pd.to_datetime(cleaned_data['timestamp'])
cleaned_data['DayOfWeek'] = cleaned_data['timestamp'].dt.dayofweek
cleaned_data['IsWeekend'] = cleaned_data['DayOfWeek'].isin([5, 6]).astype(int)

# Normalize energy consumption columns
scaler = MinMaxScaler(feature_range=(-1, 1))
normalized_data = cleaned_data.copy()
normalized_data[['Total_Electricity', 'Total_Gas']] = scaler.fit_transform(
    cleaned_data[['Total_Electricity', 'Total_Gas']]
)

print("\nNormalized Total Electricity and Gas:")
print(normalized_data[['Total_Electricity', 'Total_Gas']].head())

# Split data into train, validation, and test sets
train_data, test_data = train_test_split(normalized_data, test_size=1/5, shuffle=False)
train_data, val_data = train_test_split(train_data, test_size=0.1, shuffle=False)

print("\nTrain Data Shape:", train_data.shape)
print("Validation Data Shape:", val_data.shape)
print("Test Data Shape:", test_data.shape)

# Create input features for the MLP model
def create_input_features(data):
    X, y = [], []
    for i in range(len(data) - 24):  # Use a sliding window of 24 hours
        X.append(data.iloc[i:i+24][['Total_Electricity', 'Total_Gas', 'DayOfWeek', 'IsWeekend']].values)
        y.append(data.iloc[i+24]['Total_Electricity'])  # Predict next hour's electricity consumption
    return np.array(X), np.array(y)

X_train, y_train = create_input_features(train_data)
X_val, y_val = create_input_features(val_data)
X_test, y_test = create_input_features(test_data)

print("\nX_train Shape:", X_train.shape)
print("y_train Shape:", y_train.shape)

# Build the MLP model
def build_mlp_model(input_shape):
    model = Sequential([
        Dense(30, activation='relu', input_shape=input_shape),  # Hidden layer with 30 neurons
        Dense(1, activation='linear')  # Output layer for regression
    ])
    model.compile(optimizer=SGD(learning_rate=0.01), loss='mse')
    return model

model = build_mlp_model(input_shape=(X_train.shape[1], X_train.shape[2]))
print("\nModel Summary:")
model.summary()
