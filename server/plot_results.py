import json
import matplotlib.pyplot as plt
import numpy as np

# Load data
with open("results.json", "r") as f:
    data = json.load(f)

# Extract relevant fields
configs = [f"Speed: {d['config']['inputSpeed']}, Inacc: {d['config']['inaccuracy']}, Misdrop: {d['config']['misdrop']}" for d in data]
scores = np.array([d['stats']['average']['score'] for d in data])
score_variances = np.array([d['stats']['variance']['score'] for d in data])
lines = np.array([d['stats']['average']['lines'] for d in data])
line_variances = np.array([d['stats']['variance']['lines'] for d in data])

# Adjust figure size dynamically
fig, ax1 = plt.subplots(figsize=(10, max(6, len(configs) * 0.5)))

# Create second x-axis (for score) at the top
ax2 = ax1.twiny()
ax1.xaxis.set_label_position("bottom")  # Set lines axis at bottom
ax1.xaxis.tick_bottom()
ax2.xaxis.set_label_position("top")  # Set score axis at top
ax2.xaxis.tick_top()

# Set bar heights
bar_height = 0.4  # Adjusted for clear separation

# Define positions for each pair (score on top, lines below)
y_positions_score = np.arange(len(configs)) + bar_height / 2
y_positions_lines = np.arange(len(configs)) - bar_height / 2

# Set limits dynamically
ax2.set_xlim(0, (scores + score_variances).max() * 1.1)
ax1.set_xlim(0, (lines + line_variances).max() * 1.1)

# Plot Scores (top bar, top axis)
ax2.barh(y_positions_score, scores, xerr=score_variances, capsize=5, color='blue', alpha=0.6, height=bar_height, label="Score")
ax2.set_xlabel("Average Score", color='blue')
ax2.tick_params(axis='x', colors='blue')

# Plot Lines Cleared (bottom bar, bottom axis)
ax1.barh(y_positions_lines, lines, xerr=line_variances, capsize=5, color='green', alpha=0.6, height=bar_height, label="Lines Cleared")
ax1.set_xlabel("Average Lines Cleared", color='green')
ax1.tick_params(axis='x', colors='green')

# Set y-axis labels
ax1.set_yticks(np.arange(len(configs)))
ax1.set_yticklabels(configs)

# Add title
plt.title("StackRabbit performance with depth=1, no tucks")

plt.tight_layout()
plt.show()

