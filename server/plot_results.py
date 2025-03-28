import json
import matplotlib.pyplot as plt
import numpy as np

# Load data
with open("results.json", "r") as f:
    data = json.load(f)

data_sorted = sorted(data, key=lambda d: d['stats']['average']['score'], reverse=True)

# Extract the sorted fields
configs = [f"Lvl {d['config']['startLevel']}, Spd {d['config']['inputSpeed']}, Ina {d['config']['inaccuracy']}, Mstke {d['config']['mistake']}, Msdrp {d['config']['misdrop']}" for d in data_sorted]
scores = np.array([d['stats']['average']['score'] for d in data_sorted])
score_variances = np.array([d['stats']['variance']['score'] for d in data_sorted])
lines = np.array([d['stats']['average']['lines'] for d in data_sorted])
line_variances = np.array([d['stats']['variance']['lines'] for d in data_sorted])

# Adjust figure height dynamically to allow scrolling
fig, ax1 = plt.subplots(figsize=(14, max(6, len(configs) * 0.5)))  # Increased width more substantially

# Create second x-axis for score at the top
ax2 = ax1.twiny()
ax1.xaxis.set_label_position("bottom")
ax1.xaxis.tick_bottom()
ax2.xaxis.set_label_position("top")
ax2.xaxis.tick_top()

# Set bar heights
bar_height = 0.4

# Define positions for each pair (score on top, lines below)
y_positions_score = np.arange(len(configs)) + bar_height / 2
y_positions_lines = np.arange(len(configs)) - bar_height / 2

# Set limits dynamically
ax2.set_xlim(0, (scores + score_variances).max() * 1.25)  # Increased limit to make more room for labels
ax1.set_xlim(0, (lines + line_variances).max() * 1.25)  # Increased limit to make more room for labels

# Function to add value labels to bars
def add_labels(bars, axis, variances):
    for bar, variance in zip(bars, variances):
        width = bar.get_width()
        # Move label further to the right, past the variance line
        axis.text(width + variance * 1.5, bar.get_y() + bar.get_height()/2, f'{width}', 
                  ha='left', va='center', fontweight='bold', fontsize=8)

# Plot Scores (top bar, top axis)
score_bars = ax2.barh(y_positions_score, scores, xerr=score_variances, capsize=5, color='blue', alpha=0.6, height=bar_height, label="Score")
ax2.set_xlabel("Average Score", color='blue')
ax2.tick_params(axis='x', colors='blue')

# Plot Lines Cleared (bottom bar, bottom axis)
lines_bars = ax1.barh(y_positions_lines, lines, xerr=line_variances, capsize=5, color='green', alpha=0.6, height=bar_height, label="Lines Cleared")
ax1.set_xlabel("Average Lines Cleared", color='green')
ax1.tick_params(axis='x', colors='green')

# Add labels to bars
add_labels(score_bars, ax2, score_variances)
add_labels(lines_bars, ax1, line_variances)

# Set y-axis labels
ax1.set_yticks(np.arange(len(configs)))
ax1.set_yticklabels(configs)

# Adjust layout for scrolling and labels
plt.subplots_adjust(left=0.35, right=0.95, top=0.95, bottom=0.05)

# Save the figure
plt.savefig('results_chart.png', dpi=300, bbox_inches='tight')

# Optional: Close the figure to free up memory
plt.close(fig)