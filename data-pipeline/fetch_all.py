"""Coleta dados públicos (sem conta/chave) e grava JSONs em web/public/data.

Fontes:
  - yfinance (Yahoo Finance, não oficial): preços, demonstrações, perfil
  - FRED (CSV público): Treasury 10 anos
  - BCB SGS + Focus/Olinda: Selic e expectativa de IPCA
  - Damodaran (NYU): ERP maduro/EUA e prêmio de risco-país do Brasil

Uso:  uv run python fetch_all.py
"""

from __future__ import annotations

import io
import json
import math
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
UA = {"User-Agent": "finance-portfolio-data-pipeline/1.0"}

# segment: semis | ai | software
UNIVERSE: list[dict] = [
    # --- Semicondutores ---
    {"ticker": "NVDA", "country": "US", "segment": "semis", "chain": "Design (fabless)"},
    {"ticker": "AMD", "country": "US", "segment": "semis", "chain": "Design (fabless)"},
    {"ticker": "AVGO", "country": "US", "segment": "semis", "chain": "Design (fabless)"},
    {"ticker": "QCOM", "country": "US", "segment": "semis", "chain": "Design (fabless)"},
    {"ticker": "ARM", "country": "US", "segment": "semis", "chain": "IP & EDA"},
    {"ticker": "CDNS", "country": "US", "segment": "semis", "chain": "IP & EDA"},
    {"ticker": "SNPS", "country": "US", "segment": "semis", "chain": "IP & EDA"},
    {"ticker": "ASML", "country": "US", "segment": "semis", "chain": "Equipamentos"},
    {"ticker": "AMAT", "country": "US", "segment": "semis", "chain": "Equipamentos"},
    {"ticker": "LRCX", "country": "US", "segment": "semis", "chain": "Equipamentos"},
    {"ticker": "KLAC", "country": "US", "segment": "semis", "chain": "Equipamentos"},
    {"ticker": "TSM", "country": "US", "segment": "semis", "chain": "Foundry"},
    {"ticker": "INTC", "country": "US", "segment": "semis", "chain": "Foundry"},
    {"ticker": "MU", "country": "US", "segment": "semis", "chain": "Memória"},
    {"ticker": "POSI3.SA", "country": "BR", "segment": "semis", "chain": "Hardware & montagem"},
    {"ticker": "INTB3.SA", "country": "BR", "segment": "semis", "chain": "Hardware & montagem"},
    # --- Infra de IA & Cloud ---
    {"ticker": "MSFT", "country": "US", "segment": "ai", "chain": "Hyperscaler"},
    {"ticker": "GOOGL", "country": "US", "segment": "ai", "chain": "Hyperscaler"},
    {"ticker": "AMZN", "country": "US", "segment": "ai", "chain": "Hyperscaler"},
    {"ticker": "META", "country": "US", "segment": "ai", "chain": "Modelos & apps"},
    {"ticker": "ORCL", "country": "US", "segment": "ai", "chain": "Hyperscaler"},
    {"ticker": "PLTR", "country": "US", "segment": "ai", "chain": "Modelos & apps"},
    {"ticker": "LWSA3.SA", "country": "BR", "segment": "ai", "chain": "Cloud & hospedagem"},
    # --- Software & Internet ---
    {"ticker": "CRM", "country": "US", "segment": "software", "chain": "SaaS"},
    {"ticker": "NOW", "country": "US", "segment": "software", "chain": "SaaS"},
    {"ticker": "ADBE", "country": "US", "segment": "software", "chain": "SaaS"},
    {"ticker": "TOTS3.SA", "country": "BR", "segment": "software", "chain": "SaaS"},
    {"ticker": "CASH3.SA", "country": "BR", "segment": "software", "chain": "Internet"},
    {"ticker": "VTEX", "country": "BR", "segment": "software", "chain": "SaaS"},
    {"ticker": "MELI", "country": "BR", "segment": "software", "chain": "Internet"},
    {"ticker": "NU", "country": "BR", "segment": "software", "chain": "Fintech", "bank": True},
    {"ticker": "STNE", "country": "BR", "segment": "software", "chain": "Fintech", "bank": True},
]

IS_MAP = {
    "revenue": ["Total Revenue", "Operating Revenue"],
    "cogs": ["Cost Of Revenue", "Reconciled Cost Of Revenue"],
    "grossProfit": ["Gross Profit"],
    "opex": ["Operating Expense"],
    "ebit": ["Operating Income", "EBIT"],
    "ebitda": ["EBITDA", "Normalized EBITDA"],
    "da": ["Reconciled Depreciation", "Depreciation And Amortization In Income Statement"],
    "interestExpense": ["Interest Expense"],
    "pretaxIncome": ["Pretax Income"],
    "tax": ["Tax Provision"],
    "netIncome": ["Net Income", "Net Income Common Stockholders"],
}
BS_MAP = {
    "totalAssets": ["Total Assets"],
    "totalLiabilities": ["Total Liabilities Net Minority Interest"],
    "equity": ["Stockholders Equity", "Common Stock Equity"],
    "cash": ["Cash Cash Equivalents And Short Term Investments", "Cash And Cash Equivalents"],
    "receivables": ["Accounts Receivable", "Receivables"],
    "inventory": ["Inventory"],
    "currentAssets": ["Current Assets"],
    "payables": ["Accounts Payable", "Payables"],
    "currentLiabilities": ["Current Liabilities"],
    "ppe": ["Net PPE"],
    "totalDebt": ["Total Debt"],
}
CF_MAP = {
    "cfo": ["Operating Cash Flow"],
    "capex": ["Capital Expenditure"],
    "da": ["Depreciation And Amortization", "Depreciation Amortization Depletion"],
    "changeNwc": ["Change In Working Capital"],
    "fcf": ["Free Cash Flow"],
}


def clean(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def extract(df: pd.DataFrame, mapping: dict, cols) -> dict:
    out = {}
    for key, candidates in mapping.items():
        row = next((c for c in candidates if c in df.index), None)
        out[key] = [clean(df.at[row, c]) if row else None for c in cols]
    return out


def statements(t: yf.Ticker) -> dict | None:
    inc, bal, cf = t.income_stmt, t.balance_sheet, t.cashflow
    if inc is None or inc.empty:
        return None
    rev_row = next((r for r in IS_MAP["revenue"] if r in inc.index), None)
    cols = [c for c in sorted(inc.columns) if rev_row is None or clean(inc.at[rev_row, c]) is not None]
    cols = cols[-5:]  # mais antigo -> mais recente; descarta anos sem receita
    pick = lambda df: [c for c in cols if df is not None and c in df.columns]
    res = {
        "years": [c.year if hasattr(c, "year") else str(c) for c in cols],
        "fiscalYearEnd": [str(c.date()) if hasattr(c, "date") else str(c) for c in cols],
        "is": extract(inc, IS_MAP, cols),
    }
    for name, df, mp in (("bs", bal, BS_MAP), ("cf", cf, CF_MAP)):
        if df is None or df.empty:
            res[name] = {k: [None] * len(cols) for k in mp}
        else:
            res[name] = {
                k: [clean(df.at[next((x for x in v if x in df.index), None), c])
                    if any(x in df.index for x in v) and c in df.columns else None for c in cols]
                for k, v in mp.items()
            }
    return res


def prices(t: yf.Ticker) -> dict:
    h = t.history(period="5y", interval="1d", auto_adjust=True)
    h = h["Close"].dropna()
    return {
        "dates": [d.strftime("%Y-%m-%d") for d in h.index],
        "close": [round(float(x), 4) for x in h.values],
    }


INFO_KEYS = [
    "longName", "shortName", "sector", "industry", "currency", "financialCurrency",
    "exchange", "marketCap", "sharesOutstanding", "beta", "totalDebt", "totalCash",
    "currentPrice", "regularMarketPrice", "trailingPE", "forwardPE", "enterpriseValue",
    "enterpriseToEbitda", "enterpriseToRevenue", "ebitdaMargins", "operatingMargins",
    "grossMargins", "revenueGrowth", "fiftyTwoWeekLow", "fiftyTwoWeekHigh",
    "longBusinessSummary", "fullTimeEmployees", "website",
]


def company(meta: dict) -> dict | None:
    t = yf.Ticker(meta["ticker"])
    try:
        info = t.info or {}
    except Exception as e:  # noqa: BLE001
        print(f"  ! info {meta['ticker']}: {e}", file=sys.stderr)
        info = {}
    profile = {k: (clean(info.get(k)) if isinstance(info.get(k), (int, float)) else info.get(k))
               for k in INFO_KEYS}
    try:
        px = prices(t)
    except Exception as e:  # noqa: BLE001
        print(f"  ! prices {meta['ticker']}: {e}", file=sys.stderr)
        return None
    if not px["close"]:
        return None
    try:
        fin = statements(t)
    except Exception as e:  # noqa: BLE001
        print(f"  ! statements {meta['ticker']}: {e}", file=sys.stderr)
        fin = None
    price = profile.get("currentPrice") or profile.get("regularMarketPrice") or px["close"][-1]
    return {**meta, "profile": {**profile, "price": price}, "financials": fin, "prices": px}


def ev_to_ebitda(c: dict, to_usd: dict) -> float | None:
    """EV/EBITDA na mesma moeda (o do Yahoo mistura moedas em ADRs como ASML/TSM)."""
    p, fin = c["profile"], c["financials"]
    if not fin or not p.get("marketCap"):
        return None
    last = lambda xs: next((x for x in reversed(xs) if x is not None), None)
    q, f = to_usd.get(p.get("currency") or "USD"), to_usd.get(p.get("financialCurrency") or p.get("currency") or "USD")
    if not q or not f:
        return None
    ebitda = last(fin["is"]["ebitda"])
    if ebitda is None and last(fin["is"]["ebit"]) is not None:
        ebitda = last(fin["is"]["ebit"]) + (last(fin["is"]["da"]) or 0)
    if not ebitda or ebitda <= 0:
        return None
    ev = p["marketCap"] * q / f + (last(fin["bs"]["totalDebt"]) or 0) - (last(fin["bs"]["cash"]) or 0)
    return round(ev / ebitda, 2)


def fx_to_usd(cur: str) -> float:
    h = yf.Ticker(f"{cur}USD=X").history(period="5d")["Close"].dropna()
    return round(float(h.iloc[-1]), 6)


def fred_last(series: str) -> dict:
    r = requests.get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}", headers=UA, timeout=30)
    df = pd.read_csv(io.StringIO(r.text)).dropna()
    df = df[pd.to_numeric(df.iloc[:, 1], errors="coerce").notna()]
    return {"date": str(df.iloc[-1, 0]), "value": float(df.iloc[-1, 1]) / 100}


def bcb_sgs_last(code: int) -> dict:
    r = requests.get(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados/ultimos/1?formato=json",
                     headers=UA, timeout=30)
    d = r.json()[0]
    return {"date": datetime.strptime(d["data"], "%d/%m/%Y").date().isoformat(),
            "value": float(d["valor"]) / 100}


def focus_ipca() -> dict:
    url = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais"
           "?$top=20&$filter=Indicador%20eq%20'IPCA'&$orderby=Data%20desc&$format=json"
           "&$select=Data,DataReferencia,Mediana")
    vals = requests.get(url, headers=UA, timeout=30).json()["value"]
    latest = vals[0]["Data"]
    rows = sorted([v for v in vals if v["Data"] == latest], key=lambda v: v["DataReferencia"])
    return {"date": latest, "byYear": {v["DataReferencia"]: v["Mediana"] / 100 for v in rows},
            "longRun": rows[-1]["Mediana"] / 100}


def damodaran() -> dict:
    url = "https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctryprem.xlsx"
    raw = requests.get(url, headers=UA, timeout=60).content
    df = pd.read_excel(io.BytesIO(raw), "ERPs by country", header=None)
    upd = df.iloc[1, 1]
    row = lambda name: df[df.iloc[:, 0].astype(str).str.strip() == name].iloc[0]
    br, us = row("Brazil"), row("United States")
    return {
        "updated": upd.date().isoformat() if hasattr(upd, "date") else str(upd),
        "matureErp": float(df.iloc[2, 4]),
        "usErp": float(df.iloc[3, 4]),
        "brazilCrp": float(br.iloc[5]),
        "brazilTotalErp": float(br.iloc[4]),
        "brazilDefaultSpread": float(br.iloc[3]),
        "brazilRating": str(br.iloc[2]),
        "source": url,
    }


def safe(fn, *a):
    try:
        return fn(*a)
    except Exception as e:  # noqa: BLE001
        print(f"  ! {fn.__name__}: {e}", file=sys.stderr)
        return None


def main() -> None:
    (OUT / "companies").mkdir(parents=True, exist_ok=True)
    asof = datetime.now(timezone.utc).date().isoformat()

    print("macro...")
    fx = safe(lambda: prices(yf.Ticker("BRL=X")))
    macro = {
        "asOf": asof,
        "us10y": safe(fred_last, "DGS10"),
        "selic": safe(bcb_sgs_last, 432),
        "ipcaFocus": safe(focus_ipca),
        "usInflationLongRun": 0.025,  # meta implícita do Fed; editável no site
        "damodaran": safe(damodaran),
        "usdbrl": {"date": fx["dates"][-1], "value": fx["close"][-1]} if fx else None,
        # quanto 1 unidade da moeda vale em USD
        "toUsd": {"USD": 1.0, **{cur: v for cur, v in ((c, safe(fx_to_usd, c)) for c in ("BRL", "EUR", "TWD")) if v}},
        "sources": {
            "us10y": "FRED DGS10",
            "selic": "BCB SGS 432",
            "ipcaFocus": "BCB Focus (Olinda) — mediana IPCA",
            "damodaran": "Damodaran Online — ctryprem.xlsx",
            "usdbrl": "Yahoo Finance BRL=X",
        },
    }
    (OUT / "macro.json").write_text(json.dumps(macro, indent=1))

    # benchmarks para Monte Carlo
    bench = {}
    for tk, label in (("^GSPC", "S&P 500"), ("^IXIC", "Nasdaq"), ("^BVSP", "Ibovespa"), ("SOXX", "Semis ETF (SOXX)"), ("BRL=X", "USD/BRL")):
        p = safe(lambda: prices(yf.Ticker(tk)))
        if p:
            bench[tk] = {"label": label, **p}
    (OUT / "benchmarks.json").write_text(json.dumps(bench))

    index = []
    for meta in UNIVERSE:
        print(meta["ticker"], "...")
        c = company(meta)
        if not c:
            print(f"  ! pulando {meta['ticker']}", file=sys.stderr)
            continue
        slug = meta["ticker"].replace(".", "_")
        c["asOf"] = asof
        (OUT / "companies" / f"{slug}.json").write_text(json.dumps(c))
        p = c["profile"]
        fin = c["financials"]
        index.append({
            "ticker": meta["ticker"], "slug": slug, "country": meta["country"],
            "segment": meta["segment"], "chain": meta["chain"], "bank": meta.get("bank", False),
            "name": p.get("longName") or p.get("shortName") or meta["ticker"],
            "currency": p.get("currency"), "financialCurrency": p.get("financialCurrency"),
            "marketCap": p.get("marketCap"), "price": p.get("price"),
            "evToEbitda": ev_to_ebitda(c, macro["toUsd"]), "ebitdaMargin": p.get("ebitdaMargins"),
            "grossMargin": p.get("grossMargins"), "operatingMargin": p.get("operatingMargins"),
            "revenueGrowth": p.get("revenueGrowth"), "trailingPE": p.get("trailingPE"),
            "revenue": (fin["is"]["revenue"][-1] if fin else None),
            "netIncome": (fin["is"]["netIncome"][-1] if fin else None),
            "hasFinancials": bool(fin and any(v is not None for v in fin["is"]["revenue"])),
            "spark": c["prices"]["close"][-260::5],
        })
    (OUT / "universe.json").write_text(json.dumps({"asOf": asof, "companies": index}))
    print(f"ok: {len(index)}/{len(UNIVERSE)} empresas -> {OUT}")


if __name__ == "__main__":
    main()
