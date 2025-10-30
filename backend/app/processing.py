import io
import base64
import tempfile
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

from fastapi import UploadFile

from .ai import generate_summary_and_strategies


def _read_uploaded_file(file: UploadFile) -> pd.DataFrame:
	file_bytes = file.file.read()
	buffer = io.BytesIO(file_bytes)
	name = (file.filename or "").lower()
	if name.endswith(".csv"):
		return pd.read_csv(buffer)
	elif name.endswith(".xlsx") or name.endswith(".xls"):
		return pd.read_excel(buffer)
	# fallback try csv first, then excel
	try:
		buffer.seek(0)
		return pd.read_csv(buffer)
	except Exception:
		buffer.seek(0)
		return pd.read_excel(buffer)


def _clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
	# Drop fully empty columns
	df = df.dropna(axis=1, how="all")
	# Strip column names
	df.columns = [str(c).strip() for c in df.columns]
	# Convert obvious datetime columns
	for col in df.columns:
		if any(s in str(col).lower() for s in ["date", "time"]):
			with pd.option_context("mode.chained_assignment", None):
				df[col] = pd.to_datetime(df[col], errors="ignore")
	# Impute numeric with median, categorical with mode
	numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
	cat_cols = df.select_dtypes(exclude=[np.number, "datetime64[ns]"]).columns.tolist()
	for col in numeric_cols:
		if df[col].isna().any():
			median_val = df[col].median()
			df[col] = df[col].fillna(median_val)
	for col in cat_cols:
		if df[col].isna().any():
			mode_val = df[col].mode().iloc[0] if not df[col].mode().empty else "Unknown"
			df[col] = df[col].fillna(mode_val)
	# Simple outlier clipping for numeric columns (IQR)
	for col in numeric_cols:
		q1 = df[col].quantile(0.25)
		q3 = df[col].quantile(0.75)
		iqr = q3 - q1
		low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
		with pd.option_context("mode.chained_assignment", None):
			df[col] = df[col].clip(lower=low, upper=high)
	return df


def _encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
	cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
	if not cat_cols:
		return df
	encoded = pd.get_dummies(df, columns=cat_cols, drop_first=True)
	return encoded


def _plot_to_base64(fig) -> str:
	buf = io.BytesIO()
	fig.savefig(buf, format="png", bbox_inches="tight")
	plt.close(fig)
	buf.seek(0)
	return base64.b64encode(buf.read()).decode("utf-8")


def _generate_charts(df: pd.DataFrame) -> Dict[str, str]:
	charts: Dict[str, str] = {}
	# Histogram of first numeric column
	numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
	if numeric_cols:
		col = numeric_cols[0]
		fig, ax = plt.subplots(figsize=(6,4))
		sns.histplot(df[col], kde=True, ax=ax)
		ax.set_title(f"Distribution of {col}")
		charts["histogram"] = _plot_to_base64(fig)
	# Correlation heatmap
	if len(numeric_cols) >= 2:
		corr = df[numeric_cols].corr(numeric_only=True)
		fig, ax = plt.subplots(figsize=(6,5))
		sns.heatmap(corr, cmap="coolwarm", annot=False, ax=ax)
		ax.set_title("Correlation Heatmap")
		charts["correlation_heatmap"] = _plot_to_base64(fig)
	# Trend line over time if a datetime column exists
	datetime_cols = df.select_dtypes(include=["datetime64[ns]"]).columns.tolist()
	if datetime_cols and numeric_cols:
		dt = datetime_cols[0]
		val = numeric_cols[0]
		tmp = df[[dt, val]].dropna().sort_values(dt)
		if not tmp.empty:
			fig, ax = plt.subplots(figsize=(6,4))
			sns.lineplot(data=tmp, x=dt, y=val, ax=ax)
			ax.set_title(f"Trend of {val} over {dt}")
			charts["trend_line"] = _plot_to_base64(fig)
	# Bar chart of top categorical feature
	cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
	if cat_cols:
		c = cat_cols[0]
		vc = df[c].value_counts().head(10)
		fig, ax = plt.subplots(figsize=(6,4))
		sns.barplot(x=vc.values, y=vc.index, ax=ax, orient="h")
		ax.set_title(f"Top {c} categories")
		charts["bar_categorical"] = _plot_to_base64(fig)
	# Pie chart for proportions (use same categorical)
	if cat_cols:
		c = cat_cols[0]
		vc = df[c].value_counts().head(6)
		fig, ax = plt.subplots(figsize=(5,5))
		ax.pie(vc.values, labels=vc.index, autopct="%1.1f%%", startangle=140)
		ax.set_title(f"{c} proportions")
		charts["pie_proportions"] = _plot_to_base64(fig)
	return charts


def _derive_insights(df: pd.DataFrame) -> List[str]:
	insights: List[str] = []
	numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
	if numeric_cols:
		col = numeric_cols[0]
		mean_val = df[col].mean()
		median_val = df[col].median()
		insights.append(f"Key metric {col}: mean {mean_val:.2f}, median {median_val:.2f}.")
		# Simple anomaly: high std
		std_val = df[col].std()
		if std_val > 0:
			cv = std_val / (mean_val + 1e-9)
			if cv > 0.8:
				insights.append(f"High variability detected in {col} (CV ~ {cv:.2f}).")
	# Correlation highlight
	if len(numeric_cols) >= 2:
		corr = df[numeric_cols].corr(numeric_only=True).abs()
		mask = np.triu(np.ones_like(corr, dtype=bool))
		corr_vals = corr.where(~mask)
		max_pair = None
		max_val = 0
		for i in corr_vals.columns:
			for j in corr_vals.index:
				val = corr_vals.loc[j, i]
				if pd.notna(val) and val > max_val:
					max_val = val
					max_pair = (i, j)
		if max_pair and max_val >= 0.5:
			insights.append(
				f"Strong relationship between {max_pair[0]} and {max_pair[1]} (|corr|={max_val:.2f})."
			)
	# Category concentration
	cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
	if cat_cols:
		c = cat_cols[0]
		vc = df[c].value_counts(normalize=True)
		if not vc.empty:
			top_cat, top_share = vc.index[0], vc.iloc[0]
			insights.append(f"Category {c} dominated by {top_cat} (~{top_share*100:.1f}%).")
	return insights


async def analyze_dataset(file: UploadFile) -> Dict[str, Any]:
	# Read
	df = _read_uploaded_file(file)
	if df.empty:
		raise ValueError("Uploaded file contains no rows after parsing.")
	# Clean
	df_clean = _clean_dataframe(df)
	# Encode copy for stats/corr calcs
	df_encoded = _encode_categoricals(df_clean)
	# EDA stats
	summary_stats = {
		"shape": df_clean.shape,
		"columns": list(map(str, df_clean.columns)),
		"numeric_columns": df_clean.select_dtypes(include=[np.number]).columns.tolist(),
		"categorical_columns": df_clean.select_dtypes(include=["object", "category"]).columns.tolist(),
	}
	if df_encoded.select_dtypes(include=[np.number]).shape[1] >= 2:
		corr = df_encoded.corr(numeric_only=True).round(3)
		summary_stats["correlation_preview"] = corr.iloc[:5, :5].to_dict()
	else:
		summary_stats["correlation_preview"] = {}
	# Charts
	charts = _generate_charts(df_clean)
	# Insights
	insights = _derive_insights(df_clean)
	# AI text (placeholder)
	report_summary, strategies, strengths, weaknesses = generate_summary_and_strategies(df_clean, insights)
	return {
		"report_summary": report_summary,
		"strategies": strategies,
		"strengths": strengths,
		"weaknesses": weaknesses,
		"charts": charts,
		"stats": summary_stats,
		"insights": insights,
	}


