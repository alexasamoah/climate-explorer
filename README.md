# Global CO2 Emissions & Climate Impact Explorer 2019

A premium, storytelling-first climate analytics project built with a strict stack: Python for data science and a static D3.js + Bootstrap dashboard for GitHub Pages.

<a href="https://alexasamoah.github.io/climate-explorer/">
  <img src="/images/app-image.png" width="100%" />
</a>


🔗 **[Live Demo](https://alexasamoah.github.io/climate-explorer/)**


## Repository Structure

```text
climate-explorer
├── assets/
│    └── .gitkeep
├── data/
│   ├── co2_data.json
│   ├── predictions.json
│   └── owid_co2_2010_2019.csv
├── images/
│   └── app-image.png
├── data_science_pipeline.py
├── index.html
├── insights.md
├── LICENSE
├── README.md
├── script.js
└── styles.css

```

## Project Highlights

- End-to-end data pipeline (cleaning, feature engineering, clustering, prediction export).
- Cinematic dark dashboard with coordinated interactions and smooth transitions.
- Animated world choropleth, bubble timeline, bar race, line+brush, scatter+regression, clusters, and multi-country comparison.
- Built for static hosting on GitHub Pages (no backend required).

## Tech Stack

- **Python 3.7**
- **pandas, numpy, scikit-learn (0.21.x), matplotlib, seaborn, plotly (offline)**
- **HTML5, CSS3, Bootstrap 4.3.1**
- **Vanilla JavaScript + D3.js v5.16.0**

## Data Source

- Intended public source: **Our World in Data CO2 dataset** (2010–2019 subset prepared for dashboard use).
- Dashboard dataset fields include CO2 totals/per-capita, GDP, population, temperature anomaly proxy, continent, and derived metrics.

## How to Run Locally

1. Clone this repository.
2. Serve the project with any static web server:
   - `python -m http.server 8000`
3. Open `http://localhost:8000`.

## Data Science Workflow

1. Prepare and clean country-year panel data for 2010–2019.
2. Engineer features (`gdp_per_capita`, `co2_intensity`).
3. Perform EDA and correlation analysis.
4. Build **KMeans clusters** for country archetypes.
5. Train baseline predictive model (Linear Regression + Random Forest comparison).
6. Export:
   - `data/co2_data.json`
   - `data/predictions.json`
   - `insights.md`

## GitHub Pages Deployment (Step-by-step)

1. Push repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default), `/root`
4. Save settings.
5. Wait for GitHub Pages action to finish.
6. Open your published URL (shown in Pages settings).

## What I Learned

- Designing climate storytelling requires balancing analytical depth with visual clarity.
- Coordinated views (map + scatter + trend + comparison) reveal patterns better than isolated charts.
- Smooth motion and interaction pacing (800–1200ms) improve interpretability in temporal climate data.

## Licence

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
