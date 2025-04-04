import json
import numpy as np
import tkinter as tk
from tkinter import messagebox
from sklearn.linear_model import LinearRegression
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import math
import uuid
import itertools

# Load data
with open("results.json", "r") as f:
    data = json.load(f)

# Extract inputs and targets (scores)
X = []
y = []

for d in data:
    config = d['config']
    input_speed = config['inputSpeed']  # Default to 0 if inputSpeed is not found
    inaccuracy = config['inaccuracy']
    mistake = config['mistake']
    misdrop = config['misdrop']
    
    # Add the features and target (score) to X and y
    X.append([input_speed, inaccuracy, mistake, misdrop])
    y.append(d['stats']['average']['score'])

# Convert lists to numpy arrays
X = np.array(X)
y = np.array(y)

# Initialize and train the model
# model = LinearRegression()
# model.fit(X, y)

poly = PolynomialFeatures(degree=3)  # You can try changing the degree
X_poly = poly.fit_transform(X)

# Train-test split for better model validation
X_train, X_test, y_train, y_test = train_test_split(X_poly, y, test_size=0.2, random_state=42)

# Initialize and train a Ridge regression model (with regularization)
ridge_model = Ridge(alpha=1.0)  # You can adjust alpha (regularization strength)
ridge_model.fit(X_train, y_train)

# Predict on the test set and evaluate performance
y_pred = ridge_model.predict(X_test)
mse = mean_squared_error(y_test, y_pred)
print(f"Mean Squared Error on Test Set: {mse}")

# Function to predict trophies from score
def trophies_from_score(score):
    if score <= 0:
        raise ValueError("Score must be greater than zero for trophies calculation.")
    return 3.4 * math.pow(score, 0.5)

def predict_score(input_speed, inaccuracy, mistake, misdrop):
    # Predict the score using the trained model
    features = np.array([[input_speed, inaccuracy, mistake, misdrop]])
    features_poly = poly.transform(features)  # Apply polynomial transformation
    predicted_score = ridge_model.predict(features_poly)
    
    # Get the score
    return predicted_score[0]

# remove percentage of bots
def remove_percentage(bots, percentage):
    count_to_remove = round(len(bots) * percentage)
    if count_to_remove == 0 or len(bots) <= 1:
        return bots

    result = bots[:]

    for _ in range(count_to_remove):
        min_disruption_index = 1  # Avoid first and last element
        min_disruption = float('inf')

        for j in range(1, len(result) - 1):
            prev_gap = result[j]["trophies"] - result[j - 1]["trophies"]
            next_gap = result[j + 1]["trophies"] - result[j]["trophies"]
            new_gap = result[j + 1]["trophies"] - result[j - 1]["trophies"]  # After removal

            disruption = abs(new_gap - prev_gap) + abs(new_gap - next_gap)

            if disruption < min_disruption:
                min_disruption = disruption
                min_disruption_index = j

        result.pop(min_disruption_index)

    return result

# Function to generate all configurations, calculate the scores and trophies, and write to TypeScript file
def generate_bot_configs_and_write_to_file():
    # Define the possible values for each parameter
    input_speeds = [6, 8, 10, 12, 14, 17, 20, 25]
    inaccuracies = [0.9, 0.6, 0.3, 0.1]
    mistakes = [0.3, 0.1, 0.05, 0.03, 0.01, 0.005]
    misdrops = [0.03, 0.01, 0.005, 0.001, 0.0005]


    # Generate all permutations of the configurations
    bot_configs = list(itertools.product(input_speeds, inaccuracies, mistakes, misdrops))
    
    bots = []

    # Process each configuration, predict the score and trophies, and filter out non-positive scores
    for config in bot_configs:
        input_speed, inaccuracy, mistake, misdrop = config

        # Don't allow slow bots that don't misdrop much, because this results in boring lineout bots
        if input_speed <= 8 and misdrop <= 0.01:
            continue

        # don't allow fast bots that misdrop a lot, not realistic
        if input_speed >= 14 and misdrop >= 0.01:
            continue

        # Get the score and calculate trophies
        score = predict_score(input_speed, inaccuracy, mistake, misdrop)
        
        if score <= 0:
            continue  # Skip bots with non-positive scores
        
        try:
            trophies = trophies_from_score(score)
        except ValueError:
            continue  # Skip bots that throw an error in trophies calculation

        # Generate a unique bot ID
        bot_id = str(uuid.uuid4())

        # Create the bot entry
        bot_entry = {
            "score": round(math.pow(score, 0.7) * 100), # score accounts for average, bump up a bit for predicted high score
            "trophies": round(trophies),
            "speed": f"InputSpeed.HZ_{int(input_speed)}",  # Format as HZ_<speed>
            "inaccuracy": inaccuracy,
            "mistake" : mistake,
            "misdrop": misdrop,
            "botIDs": [bot_id]
        }

        bots.append(bot_entry)
    
    # Sort bots by trophies in ascending order
    bots = sorted(bots, key=lambda bot: bot['trophies'])
    bots = remove_percentage(bots, 0.7)

    print("num bots:", len(bots))

    # Write the results to a TypeScript file
    with open("generated_bots.txt", "w") as f:
        f.write(f"const bots: BotType[] = [\n")
        for bot in bots:
            f.write(f"    {{ highscore: {bot['score']}, trophies: {bot['trophies']}, speed: {bot['speed']}, inaccuracy: {bot['inaccuracy']}, mistake: {bot['mistake']}, misdrop: {bot['misdrop']}, botIDs: {bot['botIDs']} }},\n")
        f.write(f"];\n")

    #messagebox.showinfo("Success", "Bot configurations have been written to generated_bots.txt.")

# # Create a Tkinter window
# window = tk.Tk()
# window.title("Bot Configuration Generator")

# # Create input fields and labels for bot configurations
# tk.Label(window, text="Input Speed (e.g., 12)").grid(row=0, column=0)
# input_speed_entry = tk.Entry(window)
# input_speed_entry.grid(row=0, column=1)

# tk.Label(window, text="Inaccuracy (e.g., 0.2):").grid(row=1, column=0)
# inaccuracy_entry = tk.Entry(window)
# inaccuracy_entry.grid(row=1, column=1)

# tk.Label(window, text="Misdrop (e.g., 0.05):").grid(row=2, column=0)
# misdrop_entry = tk.Entry(window)
# misdrop_entry.grid(row=2, column=1)

# Function to trigger bot generation
def generate_bot_configs():
    generate_bot_configs_and_write_to_file()

# Create a button to trigger bot config generation
# generate_button = tk.Button(window, text="Generate Bots and Write to File", command=generate_bot_configs)
# generate_button.grid(row=3, column=0, columnspan=2)

generate_bot_configs()
# # Start the Tkinter event loop
# window.mainloop()
