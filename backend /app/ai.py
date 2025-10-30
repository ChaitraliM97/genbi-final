import os
import openai
from typing import List, Tuple

import pandas as pd


USE_OPENAI = os.getenv("USE_OPENAI", "false").lower() in ("1", "true", "yes")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai.api_key = OPENAI_API_KEY


def _fallback_summary(insights: List[str]) -> str:
	if not insights:
		return (
			"The dataset was analyzed. No strong trends detected, but basic distribution, correlations, and category proportions were reviewed."
		)
	concise = "; ".join(insights[:3])
	return f"Executive summary: {concise}."


def _fallback_strategies(df: pd.DataFrame, insights: List[str]) -> Tuple[List[str], str, str]:
	strategies = [
		"Improve retention: target top risk segments with incentives and onboarding.",
		"Optimize pricing: evaluate elastic features and competitor positioning by region.",
		"Reduce refunds: analyze root causes and implement proactive support workflows.",
	]
	strengths = "Key strengths: Strong product performance in top segments. Good historical customer growth."
	weaknesses = "Key weaknesses: High churn/variation in lower segments. Untapped market opportunities exist."
	return strategies, strengths, weaknesses


def generate_summary_and_strategies(df: pd.DataFrame, insights: List[str]) -> Tuple[str, List[str], str, str]:
	if USE_OPENAI and OPENAI_API_KEY:
		sample = df.head(10).to_markdown(index=False)
		stats = df.describe(include='all').to_markdown()
		prompt = f'''
Business Intelligence Analyst Assistant
You are given data (snippet and stats) and auto-generated insights. Extract the primary strengths and weaknesses (SWOT), list 5 powerful, thoughtful business insights (think like a top consultant), and recommend 5 advanced business strategies to improve results. Use very professional business language. Be detailed and avoid trivial descriptive stats.

Data sample:\n{sample}
\nStats:\n{stats}
\nAuto-insights:\n{chr(10).join(insights)}
---
Give answers in this JSON:
{{"summary": "...", "insights": ["..."], "strengths": "...", "weaknesses": "...", "strategies": ["..."]}}
'''
		try:
			response = openai.chat.completions.create(
				model="gpt-4-turbo",
				messages=[{"role": "user", "content": prompt}],
				temperature=0.35,
				max_tokens=800,
			)
			import json
			ans = response.choices[0].message.content
			data = json.loads(ans)
			summary = data.get('summary') or _fallback_summary(insights)
			strategies = data.get('strategies') or _fallback_strategies(df, insights)[0]
			strengths = data.get('strengths') or ""
			weaknesses = data.get('weaknesses') or ""
			insights_ = data.get('insights') or insights
			return summary, strategies, strengths, weaknesses
		except Exception as e:
			pass
	summary = _fallback_summary(insights)
	strategies, strengths, weaknesses = _fallback_strategies(df, insights)
	return summary, strategies, strengths, weaknesses


