"""WCAG 2.1 contrast ratios for the map tokens. Fill classes must differ from their neighbours
and from the page by 3:1 to meet non-text contrast (1.4.11) on their own; where they do not,
the outline, the labels and the table carry the information. Usage: python3 -I tools/contrast.py"""
import re

def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

def ratio(a, b):
    high, low = sorted([luminance(a), luminance(b)], reverse=True)
    return (high + 0.05) / (low + 0.05)

themes = {
    "light": {"background": "#ffffff", "none": "#e9e7e2", "one": "#a9c9df", "two": "#4f8fbd", "three-or-more": "#1d4e7a"},
    "dark": {"background": "#141414", "none": "#2c2c2c", "one": "#2f4f66", "two": "#4d86b3", "three-or-more": "#9cc8ec"},
    "print": {"background": "#ffffff", "none": "#ffffff", "one": "#c8c8c8", "two": "#8c8c8c", "three-or-more": "#4a4a4a"},
}
for name, colors in themes.items():
    steps = ["none", "one", "two", "three-or-more"]
    pairs = [(steps[i], steps[i + 1]) for i in range(3)] + [("background", "none"), ("background", "three-or-more")]
    print(name, ", ".join(f"{a}/{b} {ratio(colors[a], colors[b]):.2f}" for a, b in pairs))
