from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SALES_PATH = BASE_DIR / "ERA-ANALYTICS-V2" / "Sales vs Stock 01 - 15 April 2026 R5_Master.xlsx"
CURRENT_SALES_PATH = BASE_DIR / "data" / "current" / "Sales_vs_Stock_R5_Latest.xlsx"
PNL_PATH = (
    BASE_DIR
    / "ERA-ANALYTICS-V2"
    / "PNL EAR YTD JANUARI 2026"
    / "1. EAR by Store Jan 26-2 - pake yang ini.xlsx"
)
REGION_SUMMARY_PATH = BASE_DIR / "ERA-ANALYTICS-V2" / "ERA_ANALYTICS_Region5_Summary.xlsx"
OUTPUT_PATH = BASE_DIR / "outputs" / "dashboard_data_v2.json"

VALID_CHANNELS = {"ERAFONE", "ERA & MORE"}


def resolve_sales_path() -> Path:
    return CURRENT_SALES_PATH if CURRENT_SALES_PATH.exists() else DEFAULT_SALES_PATH


def compact_idr(value: float) -> str:
    abs_value = abs(value)
    if abs_value >= 1_000_000_000_000:
        return f"Rp{value / 1_000_000_000_000:.2f} T"
    if abs_value >= 1_000_000_000:
        return f"Rp{value / 1_000_000_000:.1f} M"
    if abs_value >= 1_000_000:
        return f"Rp{value / 1_000_000:.1f} jt"
    return f"Rp{value:,.0f}".replace(",", ".")


def month_total_columns(ws):
    cols = []
    for col in range(9, ws.max_column + 1):
        month_value = ws.cell(2, col).value
        sub_value = ws.cell(3, col).value
        if isinstance(month_value, datetime) and sub_value is None:
            cols.append((col, month_value))
    return cols


def build_sales_data():
    wb = load_workbook(resolve_sales_path(), read_only=True, data_only=True)
    ws = wb["BY STORE"]
    total_cols = month_total_columns(ws)
    latest_month = max((month for _, month in total_cols if month.year == 2026), default=None)
    latest_month_num = latest_month.month if latest_month else 12

    totals_by_year = defaultdict(float)
    stores = []

    for row in ws.iter_rows(min_row=4, values_only=True):
        channel = row[3]
        if channel not in VALID_CHANNELS:
            continue

        monthly = {}
        for col, month_dt in total_cols:
            value = row[col - 1] or 0
            key = month_dt.strftime("%Y-%m")
            monthly[key] = float(value)
            totals_by_year[month_dt.year] += float(value)

        yearly = {
            "y2022": sum(monthly.get(f"2022-{m:02d}", 0) for m in range(1, 13)),
            "y2023": sum(monthly.get(f"2023-{m:02d}", 0) for m in range(1, 13)),
            "y2024": sum(monthly.get(f"2024-{m:02d}", 0) for m in range(1, 13)),
            "y2025": sum(monthly.get(f"2025-{m:02d}", 0) for m in range(1, 13)),
            "y2026": sum(monthly.get(f"2026-{m:02d}", 0) for m in range(1, latest_month_num + 1)),
        }

        q125 = sum(monthly.get(f"2025-{m:02d}", 0) for m in range(1, latest_month_num + 1))
        q126 = sum(monthly.get(f"2026-{m:02d}", 0) for m in range(1, latest_month_num + 1))
        latest_period_sales = monthly.get(latest_month.strftime("%Y-%m"), 0) if latest_month else 0
        bep = float(row[1] or 0)
        yoy = ((q126 / q125) - 1) if q125 else 0
        bep_ach = (latest_period_sales / bep) if bep else 0
        status = row[0] or "Unknown"
        tsh = row[4] or "Unknown"

        if status != "Aktif":
            cluster = "Recovery"
        elif bep_ach >= 1 and yoy >= 0.08:
            cluster = "Growth"
        elif bep_ach >= 1:
            cluster = "Stable"
        elif bep_ach >= 0.7:
            cluster = "Recovery"
        else:
            cluster = "Critical"

        health = max(
            30,
            min(
                92,
                round(
                    42
                    + (min(bep_ach, 1.4) * 18)
                    + (max(min(yoy, 0.45), -0.3) * 22)
                    + (5 if status == "Aktif" else -10)
                ),
            ),
        )

        stores.append(
            {
                "code": row[6],
                "name": row[7],
                "channel": "Erafone" if channel == "ERAFONE" else "ERA & More",
                "tsh": tsh,
                "status": status,
                "cluster": cluster,
                "health": health,
                "sales": yearly,
                "q125": q125,
                "q126": q126,
                "yoy": yoy * 100,
                "mar26": latest_period_sales,
                "latestPeriodSales": latest_period_sales,
                "latestPeriodLabel": latest_month.strftime("%b %Y") if latest_month else "Latest",
                "bep": bep,
                "bep_ach": bep_ach,
                "annualTotal": yearly["y2022"] + yearly["y2023"] + yearly["y2024"] + yearly["y2025"] + yearly["y2026"],
                "bepGap": latest_period_sales - bep if bep else 0,
            }
        )

    return {
        "stores": stores,
        "yearTotals": {str(year): value for year, value in sorted(totals_by_year.items())},
        "latestMonthLabel": latest_month.strftime("%b %Y") if latest_month else "Latest",
        "latestMonthNumber": latest_month_num,
    }


def parse_r5_summary():
    wb = load_workbook(PNL_PATH, read_only=True, data_only=True)
    ws = wb["R5"]

    grand = {
        "netSales": ws.cell(5, 11).value or 0,
        "grossProfit": ws.cell(5, 15).value or 0,
        "gpPct": ws.cell(5, 16).value or 0,
        "totalOpex": ws.cell(5, 84).value or 0,
        "operatingIncome": ws.cell(5, 86).value or 0,
        "netBeforeHo": ws.cell(5, 97).value or 0,
        "hoCost": ws.cell(5, 104).value or 0,
        "netAfterHo": ws.cell(5, 106).value or 0,
        "financeCost": ws.cell(5, 110).value or 0,
        "netAfterFinance": ws.cell(5, 112).value or 0,
        "hoFinanceCost": ws.cell(5, 116).value or 0,
        "netFinal": ws.cell(5, 118).value or 0,
    }

    erafone_total = {"netFinal": ws.cell(11, 118).value or 0}
    eam_total = {"netFinal": ws.cell(21, 118).value or 0}

    cost_drivers = [
        ("Selling salary", ws.cell(5, 21).value or 0),
        ("ROU depreciation", ws.cell(5, 19).value or 0),
        ("Credit card", ws.cell(5, 23).value or 0),
        ("Fixed asset dep.", ws.cell(5, 43).value or 0),
    ]

    return {
        "periodLabel": "Profitability Check YTD Januari 2026",
        "grand": grand,
        "erafoneNetFinal": erafone_total["netFinal"],
        "eraMoreNetFinal": eam_total["netFinal"],
        "costDrivers": cost_drivers,
    }


def parse_analysis_of_store_ear():
    wb = load_workbook(PNL_PATH, read_only=True, data_only=True)
    ws = wb["Analysis of Store EAR"]

    rows = []
    for row_idx in range(121, 137):
        remark = str(ws.cell(row_idx, 3).value or "").strip()
        rows.append(
            {
                "rank": str(ws.cell(row_idx, 1).value or "").strip(),
                "remark": remark,
                "regionTotal": int(ws.cell(row_idx, 40).value or 0),  # AN
                "mallTotal": int(ws.cell(row_idx, 79).value or 0),  # CA
                "streetTotal": int(ws.cell(row_idx, 118).value or 0),  # DN
            }
        )

    grand = {
        "regionTotal": int(ws.cell(138, 40).value or 0),
        "mallTotal": int(ws.cell(138, 79).value or 0),
        "streetTotal": int(ws.cell(138, 118).value or 0),
        "erafoneTotal": sum(int(ws.cell(138, col).value or 0) for col in range(5, 9)),
        "eraMoreTotal": sum(int(ws.cell(138, col).value or 0) for col in range(10, 14)),
    }

    top_profit = max((row for row in rows if "PROFIT" in row["remark"]), key=lambda x: x["regionTotal"], default=None)
    top_loss = max((row for row in rows if "LOSS" in row["remark"]), key=lambda x: x["regionTotal"], default=None)

    return {
        "regionLabel": str(ws.cell(118, 3).value or "REGION 5"),
        "grand": grand,
        "topProfit": top_profit,
        "topLoss": top_loss,
        "rows": rows,
    }


def parse_pnl_store_details():
    wb = load_workbook(PNL_PATH, read_only=True, data_only=True)
    ws = wb["Report YTD"]
    mapping = {}

    for row in ws.iter_rows(min_row=6, values_only=True):
        region = row[6]
        category = row[4]
        if region != "REGION 5" or category not in {"ERAFONE", "ERAFONE AND MORE"}:
            continue
        code = row[0]
        mapping[code] = {
            "pnlCategory": "Erafone" if category == "ERAFONE" else "ERA & More",
            "netSalesPnl": row[17] or 0,
            "grossProfitPnl": row[21] or 0,
            "totalOpexPnl": row[84] or 0,
            "operatingIncomePnl": row[86] or 0,
            "netBeforeHo": row[103] or 0,
            "hoCost": row[107] or 0,
            "netAfterHo": row[109] or 0,
            "financeCost": row[113] or 0,
            "netAfterFinance": row[115] or 0,
            "hoFinanceCost": row[119] or 0,
            "netFinal": row[121] or 0,
        }

    return mapping


def parse_region_summary():
    wb = load_workbook(REGION_SUMMARY_PATH, read_only=True, data_only=True)

    ws_tsh = wb["1. TSH Summary"]
    tsh_summary = {}
    meta = {"grandTotalStores": 0, "annualBep": 0, "annualRugi": 0, "grand2025": 0, "active2025": 0}
    excluded_rows = {"Close", "GRAND TOTAL", "YoY Growth"}

    for row in ws_tsh.iter_rows(min_row=3, values_only=True):
        if not row[0]:
            continue
        name = str(row[0]).strip()
        if name == "GRAND TOTAL":
            meta["grand2025"] = float(row[4] or 0)
            continue
        if name in excluded_rows:
            continue
        tsh_summary[name] = {
            "tsh": name,
            "y2022": float(row[1] or 0),
            "y2023": float(row[2] or 0),
            "y2024": float(row[3] or 0),
            "y2025": float(row[4] or 0),
            "y2026": float(row[5] or 0),
            "annualTotal": float(row[6] or 0),
        }
        meta["active2025"] += float(row[4] or 0)

    ws_bep = wb["2. BEP Status"]
    bep_status_map = {}
    for row in ws_bep.iter_rows(min_row=3, values_only=True):
        if not row[1]:
            continue
        code = str(row[1]).strip()
        status = str(row[7] or "").strip()
        bep_status_map[code] = {
            "bepTarget": float(row[5] or 0),
            "bestMonthSales": float(row[6] or 0),
            "annualBepStatus": status,
        }
        if status == "BEP REACHED":
            meta["annualBep"] += 1
        elif status == "BELOW BEP":
            meta["annualRugi"] += 1

    ws_store = wb["3. Store Annual"]
    store_summary_map = {}
    for row in ws_store.iter_rows(min_row=3, values_only=True):
        if not row[1]:
            continue
        code = str(row[1]).strip()
        store_summary_map[code] = {
            "code": code,
            "name": row[2],
            "channel": "Erafone" if row[3] == "ERAFONE" else "ERA & More",
            "tsh": row[4] or "Unknown",
            "sales": {
                "y2022": float(row[5] or 0),
                "y2023": float(row[6] or 0),
                "y2024": float(row[7] or 0),
                "y2025": float(row[8] or 0),
                "y2026": float(row[9] or 0),
            },
            "annualTotal": float(row[10] or 0),
            "annualStatus": str(row[11] or "").strip(),
        }
        meta["grandTotalStores"] += 1

    return {
        "tshSummary": tsh_summary,
        "storeSummaryMap": store_summary_map,
        "bepStatusMap": bep_status_map,
        "meta": meta,
    }


def enrich_stores(sales_stores, pnl_map, region_summary):
    enriched = []
    store_summary_map = region_summary["storeSummaryMap"]
    bep_status_map = region_summary["bepStatusMap"]
    for store in sales_stores:
        summary_store = store_summary_map.get(store["code"], {})
        if summary_store:
            store["name"] = summary_store["name"] or store["name"]
            store["channel"] = summary_store["channel"] or store["channel"]
            store["tsh"] = summary_store["tsh"] or store["tsh"]
            store["sales"] = summary_store["sales"]
            store["annualTotal"] = summary_store["annualTotal"]
            store["annualStatus"] = summary_store["annualStatus"]
        else:
            store["annualStatus"] = "N/A"

        annual_bep = bep_status_map.get(store["code"], {})
        store["annualBepStatus"] = annual_bep.get("annualBepStatus", "N/A")
        store["bestMonthSales"] = float(annual_bep.get("bestMonthSales", 0))
        if annual_bep.get("bepTarget"):
            store["bep"] = float(annual_bep["bepTarget"])

        pnl = pnl_map.get(store["code"], {})
        net_final = float(pnl.get("netFinal", 0))
        store["pnl"] = "Profit" if net_final > 0 else "Loss" if net_final < 0 else "Flat"
        store["netFinal"] = net_final
        store["operatingIncomePnl"] = float(pnl.get("operatingIncomePnl", 0))

        if store["tsh"] == "VACANT":
            action = "Assign owner + review cost"
        elif store["cluster"] == "Critical" and store["bepGap"] < -1_000_000_000:
            action = "Traffic + cost review"
        elif store["cluster"] == "Critical":
            action = "Conversion + bundle"
        elif store["cluster"] == "Recovery":
            action = "Push recovery plan"
        elif store["cluster"] == "Growth":
            action = "Scale best practice"
        else:
            action = "Maintain performance"

        store["action"] = action
        enriched.append(store)
    return enriched


def build_tsh_stats(stores, tsh_summary):
    active_operational = defaultdict(lambda: {"stores": 0, "bepOperational": 0, "lossOperational": 0, "avgHealth": 0})
    for store in stores:
        if store["status"] != "Aktif":
            continue
        tsh = store["tsh"]
        active_operational[tsh]["stores"] += 1
        active_operational[tsh]["bepOperational"] += 1 if store["bepGap"] >= 0 else 0
        active_operational[tsh]["lossOperational"] += 1 if store["pnl"] == "Loss" else 0
        active_operational[tsh]["avgHealth"] += store["health"]

    result = []
    for tsh, summary in tsh_summary.items():
        active = active_operational.get(tsh, {})
        active_stores = active.get("stores", 0)
        annual_stores = sum(1 for s in stores if s["tsh"] == tsh)
        annual_bep = sum(1 for s in stores if s["tsh"] == tsh and s.get("annualStatus") == "BEP")
        annual_loss = sum(1 for s in stores if s["tsh"] == tsh and s.get("annualStatus") == "RUGI")
        result.append(
            {
                "tsh": tsh,
                "stores": annual_stores,
                "activeStores": active_stores,
                "bep": annual_bep,
                "loss": annual_loss,
                "bepOperational": active.get("bepOperational", 0),
                "lossOperational": active.get("lossOperational", 0),
                "total2025": summary["y2025"],
                "total2026": summary["y2026"],
                "avgHealth": round(active.get("avgHealth", 0) / active_stores, 1) if active_stores else 0,
            }
        )
    return sorted(result, key=lambda x: x["total2025"], reverse=True)


def build_actions(stores, tsh_stats, analysis_summary):
    critical = sorted(
        [s for s in stores if s["cluster"] == "Critical" and s["status"] == "Aktif"],
        key=lambda x: x["bepGap"],
    )[:25]
    biggest_gap = critical[0] if critical else None
    worst_tsh = sorted(tsh_stats, key=lambda x: x["loss"], reverse=True)[0] if tsh_stats else None
    top_loss = analysis_summary.get("topLoss")
    return [
        {
            "title": f"Review {len(critical)} toko critical",
            "note": "Prioritaskan store yang gap BEP paling besar dan P&L final masih negatif.",
            "tag": "Urgent",
        },
        {
            "title": f"{biggest_gap['name']} - gap {compact_idr(abs(biggest_gap['bepGap']))}" if biggest_gap else "Gap terbesar",
            "note": "Store dengan jarak paling jauh dari target BEP bulanannya.",
            "tag": "Kritis",
        },
        {
            "title": f"{top_loss['regionTotal']} toko masuk loss pattern utama" if top_loss else f"{sum(1 for s in stores if s['bepGap'] >= 0)} toko sudah capai BEP",
            "note": top_loss["remark"].replace("This store is ", "") if top_loss else "Gunakan toko sehat sebagai benchmark bundle, attach, dan cadangan best practice.",
            "tag": "Info",
        },
        {
            "title": f"{worst_tsh['tsh']} - {worst_tsh['loss']} toko loss" if worst_tsh else "Watchlist TSH",
            "note": "Owner dengan toko rugi terbanyak perlu weekly review khusus.",
            "tag": "Review",
        },
    ]


def build_executive(stores, sales_year_totals, tsh_stats, region_meta, analysis_summary, sales_meta):
    active = [s for s in stores if s["status"] == "Aktif"]
    growth = sum(1 for s in stores if s["cluster"] == "Growth" and s["status"] == "Aktif")
    stable = sum(1 for s in stores if s["cluster"] == "Stable" and s["status"] == "Aktif")
    recovery = sum(1 for s in stores if s["cluster"] == "Recovery" and s["status"] == "Aktif")
    critical = sum(1 for s in stores if s["cluster"] == "Critical" and s["status"] == "Aktif")
    avg_health = round(sum(s["health"] for s in active) / len(active), 1) if active else 0
    yoy = (
        (
            sum(s["q126"] for s in stores if s["status"] == "Aktif")
            / max(sum(s["q125"] for s in stores if s["status"] == "Aktif"), 1)
        )
        - 1
    ) * 100
    critical_tsh = sorted(tsh_stats, key=lambda x: x["loss"], reverse=True)[0]["tsh"] if tsh_stats else "-"
    top_profit = analysis_summary.get("topProfit")
    top_loss = analysis_summary.get("topLoss")

    summary_title = "Good - On Track Recovery" if critical < recovery + growth else "Mixed - Turnaround Needed"
    condition = f"{growth + stable} dari {len(active)} toko aktif masuk Growth/Stable. Fokus review ada pada {critical} toko critical dengan gap BEP terbesar."
    analysis = f"TSH {critical_tsh} memiliki konsentrasi toko loss tertinggi. Store format besar dan owner vacant menjadi sinyal utama root cause operasional."
    action = "Mulai dari cluster Critical, validasi cost structure, dorong traffic lokal, lalu replikasi best practice dari store Growth."
    if top_profit and top_loss:
        condition = (
            f"{analysis_summary['grand']['regionTotal']} toko Region 5 terbaca di Analysis EAR. "
            f"Loss pattern terbesar ada di {top_loss['regionTotal']} toko, sedangkan profit pattern terbesar ada di {top_profit['regionTotal']} toko."
        )
        analysis = (
            f"Pattern dominan profit: {top_profit['remark'].replace('This store is ', '')}. "
            f"Pattern dominan loss: {top_loss['remark'].replace('This store is ', '')}."
        )
        action = "Prioritaskan toko yang masuk loss pattern terbesar, terutama yang sales masih below dan OPEX masih above, lalu tindak lanjutkan per owner dan format toko."

    return {
        "totalStores": len(stores),
        "activeStores": len(active),
        "bepReached": growth + stable,
        "belowBep": recovery + critical,
        "annualBepReached": region_meta["annualBep"],
        "annualBelowBep": region_meta["annualRugi"],
        "closedStores": len(stores) - len(active),
        "revenue2025": compact_idr(region_meta["active2025"] or sales_year_totals.get("2025", 0)),
        "yoy": round(yoy, 1),
        "avgHealth": avg_health,
        "dataPeriod": sales_meta["latestMonthLabel"],
        "dataRange": "2022 - 2026",
        "totalStoresNote": f"{len(active)} aktif + {len(stores) - len(active)} close (summary 2022-2026)",
        "bepReachedNote": f"{growth + stable} Growth/Stable aktif · annual BEP {region_meta['annualBep']}",
        "belowBepNote": f"{critical + recovery} recovery/critical aktif · annual rugi {region_meta['annualRugi']}",
        "revenue2025Note": "Historical annual resmi dari workbook summary",
        "yoyNote": f"Jan-{sales_meta['latestMonthLabel'].split()[0]} 2026 vs Jan-{sales_meta['latestMonthLabel'].split()[0]} 2025",
        "summarySubtitle": "Hybrid view: REPORT YTD + Analysis of Store EAR REGION 5 + sales operational",
        "clusters": {"Growth": growth, "Stable": stable, "Recovery": recovery, "Critical": critical},
        "summaryTitle": summary_title,
        "condition": condition,
        "analysis": analysis,
        "action": action,
    }


def build_dashboard_data():
    sales = build_sales_data()
    pnl_summary = parse_r5_summary()
    analysis_summary = parse_analysis_of_store_ear()
    pnl_store_map = parse_pnl_store_details()
    region_summary = parse_region_summary()
    stores = enrich_stores(sales["stores"], pnl_store_map, region_summary)
    tsh_stats = build_tsh_stats(stores, region_summary["tshSummary"])
    actions = build_actions(stores, tsh_stats, analysis_summary)
    executive = build_executive(stores, sales["yearTotals"], tsh_stats, region_summary["meta"], analysis_summary, sales)

    pnl_summary["analysis"] = analysis_summary

    top_critical = sorted([s for s in stores if s["cluster"] == "Critical"], key=lambda x: x["bepGap"])[:6]

    return {
        "executive": executive,
        "actions": actions,
        "stores": stores,
        "tshStats": tsh_stats,
        "topCritical": top_critical,
        "pnl": pnl_summary,
        "source": {
            "salesWorkbook": str(DEFAULT_SALES_PATH.relative_to(BASE_DIR)),
            "salesWorkbookActive": str(resolve_sales_path().relative_to(BASE_DIR)),
            "pnlWorkbook": str(PNL_PATH.relative_to(BASE_DIR)),
            "summaryWorkbook": str(REGION_SUMMARY_PATH.relative_to(BASE_DIR)),
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
        },
    }


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = build_dashboard_data()
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
