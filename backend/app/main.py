from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from .processing import analyze_dataset


class AnalyzeResponse(BaseModel):
	report_summary: str
	strategies: list[str]
	charts: dict
	stats: dict
	insights: list[str]


app = FastAPI(title="Gen BI UI Backend", version="0.1.0")

app.add_middleware(
	CORSMiddleware,
\tallow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)):
	if file.content_type not in [
		"text/csv",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/octet-stream",
	]:
		raise HTTPException(status_code=400, detail="Unsupported file type. Upload CSV or XLSX.")
	try:
		result = await analyze_dataset(file)
		return AnalyzeResponse(**result)
	except Exception as exc:
		raise HTTPException(status_code=500, detail=str(exc))


@app.get("/health")
def health():
	return {"status": "ok"}


if __name__ == "__main__":
	uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


