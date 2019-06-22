"""
Global CO2 Emissions & Climate Impact Explorer 2019
Data science pipeline (2019 stack oriented).

Designed for Python 3.7 with:
- pandas
- numpy
- scikit-learn==0.21.x
- matplotlib
- seaborn
- plotly (offline)
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
CSV_PATH = DATA_DIR / "owid_co2_2010_2019.csv"
CLEAN_JSON = DATA_DIR / "co2_data.json"
PRED_JSON = DATA_DIR / "predictions.json"
INSIGHTS_PATH = ROOT / "insights.md"


def load_data(path):
    df = pd.read_csv(path)
    numeric_cols = [
        "year",
        "population",
        "gdp",
        "co2",
        "co2_per_capita",
        "temperature_change",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def clean_data(df):
    df = df.copy()
    df = df[(df["year"] >= 2010) & (df["year"] <= 2019)]
    df = df[df["iso_code"].str.len() == 3]
    df = df.dropna(subset=["country", "continent"])

    # Country-level interpolation for missing values
    for col in ["population", "gdp", "co2", "co2_per_capita", "temperature_change"]:
        df[col] = df.groupby("iso_code")[col].transform(
            lambda s: s.interpolate(limit_direction="both")
        )
        df[col] = df[col].fillna(df[col].median())

    df["gdp_per_capita"] = (df["gdp"] / df["population"]).replace([np.inf, -np.inf], np.nan)
    df["gdp_per_capita"] = df["gdp_per_capita"].fillna(df["gdp_per_capita"].median())

    df["co2_intensity"] = (df["co2"] * 1_000_000 / df["gdp"]).replace([np.inf, -np.inf], np.nan)
    df["co2_intensity"] = df["co2_intensity"].fillna(df["co2_intensity"].median())

    return df


def add_clusters(df):
    profile = (
        df.groupby(["iso_code", "country", "continent"], as_index=False)
        .agg(
            {
                "co2": "mean",
                "co2_per_capita": "mean",
                "gdp_per_capita": "mean",
                "temperature_change": "mean",
                "population": "mean",
            }
        )
    )

    X = profile[["co2", "co2_per_capita", "gdp_per_capita", "temperature_change", "population"]]
    X = (X - X.mean()) / X.std()

    km = KMeans(n_clusters=4, random_state=42)
    profile["cluster"] = km.fit_predict(X)

    return df.merge(profile[["iso_code", "cluster"]], on="iso_code", how="left")


def train_models(df):
    model_df = df[["year", "co2_per_capita", "gdp_per_capita", "population", "temperature_change", "co2"]].copy()
    X = model_df[["year", "co2_per_capita", "gdp_per_capita", "population", "temperature_change"]]
    y = model_df["co2"]

    linear = LinearRegression()
    linear.fit(X, y)
    yhat_linear = linear.predict(X)

    rf = RandomForestRegressor(n_estimators=250, random_state=42)
    rf.fit(X, y)
    yhat_rf = rf.predict(X)

    metrics = {
        "linear": {
            "r2": float(r2_score(y, yhat_linear)),
            "mae": float(mean_absolute_error(y, yhat_linear)),
        },
        "random_forest": {
            "r2": float(r2_score(y, yhat_rf)),
            "mae": float(mean_absolute_error(y, yhat_rf)),
        },
    }

    latest = df[df["year"] == 2019].copy()
    future = latest[["iso_code", "country", "continent", "co2_per_capita", "gdp_per_capita", "population", "temperature_change"]]
    future["year"] = 2020
    future["predicted_co2_2020"] = rf.predict(
        future[["year", "co2_per_capita", "gdp_per_capita", "population", "temperature_change"]]
    )

    return metrics, future


def export(clean_df, metrics, future):
    global_trend = (
        clean_df.groupby("year", as_index=False)
        .agg({"co2": "sum", "population": "sum", "gdp": "sum", "temperature_change": "mean"})
    )
    global_trend["co2_per_capita"] = global_trend["co2"] * 1_000_000 / global_trend["population"]

    corr_cols = ["co2", "co2_per_capita", "gdp_per_capita", "population", "temperature_change", "co2_intensity"]
    corr = clean_df[corr_cols].corr().round(3)

    payload = {
        "meta": {
            "project": "Global CO2 Emissions & Climate Impact Explorer 2019",
            "years": [2010, 2019],
            "rows": int(clean_df.shape[0]),
        },
        "records": clean_df.to_dict(orient="records"),
        "global_trends": global_trend.to_dict(orient="records"),
        "correlation_matrix": corr.to_dict(),
    }

    prediction_payload = {
        "model_metrics": metrics,
        "predictions": future.sort_values("predicted_co2_2020", ascending=False).to_dict(orient="records"),
    }

    CLEAN_JSON.write_text(json.dumps(payload))
    PRED_JSON.write_text(json.dumps(prediction_payload))


def write_insights(df, metrics):
    corr = df[["co2_per_capita", "gdp_per_capita", "temperature_change"]].corr().round(3)
    top_emitters = df[df["year"] == 2019].nlargest(8, "co2")[["country", "co2"]]

    lines = [
        "# Key Insights",
        "",
        "## Narrative Highlights",
        "- Emissions remain highly concentrated among a limited group of economies.",
        "- GDP per capita and CO2 per capita stay positively related across countries.",
        "- Temperature anomaly proxy trends upward during 2010-2019 in the global aggregate.",
        "",
        "## Top Emitters in 2019",
    ]
    for _, row in top_emitters.iterrows():
        lines.append("- {}: {:.1f} MtCO2".format(row["country"], row["co2"]))

    lines += [
        "",
        "## Correlation Snapshot",
        "- corr(CO2 per capita, GDP per capita): {}".format(corr.loc["co2_per_capita", "gdp_per_capita"]),
        "- corr(CO2 per capita, Temperature change): {}".format(corr.loc["co2_per_capita", "temperature_change"]),
        "",
        "## Model Performance",
        "- Linear Regression R2: {:.3f}".format(metrics["linear"]["r2"]),
        "- Random Forest R2: {:.3f}".format(metrics["random_forest"]["r2"]),
    ]

    INSIGHTS_PATH.write_text("\n".join(lines))


def main():
    df = load_data(CSV_PATH)
    clean_df = clean_data(df)
    clean_df = add_clusters(clean_df)
    metrics, future = train_models(clean_df)
    export(clean_df, metrics, future)
    write_insights(clean_df, metrics)
    print("Pipeline complete. Files exported in data/ and insights.md")


if __name__ == "__main__":
    main()
