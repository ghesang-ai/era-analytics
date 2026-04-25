# ERA Health Check — Google Apps Script Setup

## 1. Create the Google Sheet

1. Go to **sheets.google.com** → New Spreadsheet
2. Rename it: `ERA Store Health Check`
3. Note the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`

---

## 2. Open Apps Script

Inside the sheet: **Extensions → Apps Script**

- Rename project to: `ERA Health Check API`
- Delete default `myFunction()` and paste the full contents of `Code.gs`
- Save (Ctrl+S)

---

## 3. Initialize the Sheet

In the Apps Script editor toolbar:
1. Select function: `initSheet`
2. Click **Run**
3. Grant permissions when prompted (Google will warn about unverified app — click "Advanced → Go to ERA Health Check API")

This creates the `HealthCheck` tab with headers, formatting, and frozen row.

---

## 4. Deploy as Web App

1. Click **Deploy → New Deployment**
2. Click the gear icon → **Web App**
3. Configure:
   - **Description**: `ERA Health Check API v1`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. Copy the **Web App URL** — looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

> **Important**: Every time you update Code.gs, you must create a **New Deployment** (not update existing) to get the latest code. Or use "Manage Deployments → Edit" and bump the version.

---

## 5. Set the URL in ERA-ANALYTICS

In your dashboard config (e.g., `config.js` or `.env`):
```js
const HEALTH_CHECK_API = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

---

## 6. API Reference

### Base URL
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

---

### POST — Submit Assessment

**Body** (JSON):
```json
{
  "store_code": "E123",
  "store_name": "Erafone BSD",
  "tsh": "Budi Santoso",
  "filled_by": "Admin ERA",
  "assessment_date": "2026-04-25",
  "dim1_location": 85,
  "dim2_visibility": 78,
  "dim3_financial": 90,
  "dim4_product_mix": 72,
  "dim5_people": 88,
  "dim6_promo": 65,
  "dim7_digital": 70,
  "dim8_store_activity": 80,
  "dim9_traffic": 75,
  "dim10_competitor": 60,
  "dim11_customer": 82,
  "dim12_operational": 77,
  "detailed_responses": { "q1": "Good location near mall entrance" }
}
```

- `status` and `decision` are **auto-computed** from `overall_score`
- `overall_score` is **auto-computed** as average of 12 dimensions if omitted

**Auto-compute rules:**

| Overall Score | Status    | Decision  |
|---------------|-----------|-----------|
| ≥ 80          | Excellent | KEEP      |
| 60–79         | Good      | IMPROVE   |
| 40–59         | Critical  | RELOCATE  |
| < 40          | Critical  | CLOSE     |

**Success response:**
```json
{
  "success": true,
  "message": "Assessment saved successfully",
  "data": {
    "timestamp": "2026-04-25T10:00:00.000Z",
    "store_code": "E123",
    "store_name": "Erafone BSD",
    "overall_score": 77.5,
    "status": "Good",
    "decision": "IMPROVE"
  }
}
```

**Error response:**
```json
{
  "success": false,
  "error": "dim1_location must be a number between 0 and 100",
  "code": "VALIDATION_ERROR"
}
```

---

### GET — List Assessments

```
GET ?action=list
GET ?action=list&store_code=E123
GET ?action=list&status=Critical
GET ?action=list&decision=CLOSE
GET ?action=list&date_from=2026-01-01&date_to=2026-04-30
GET ?action=list&limit=50&offset=0
```

---

### GET — Dashboard Summary

```
GET ?action=summary
```

Response:
```json
{
  "success": true,
  "data": {
    "total": 42,
    "avg_overall_score": 71.3,
    "status_distribution": { "Excellent": 10, "Good": 25, "Critical": 7 },
    "decision_distribution": { "KEEP": 10, "IMPROVE": 25, "RELOCATE": 5, "CLOSE": 2 },
    "dimension_averages": {
      "Dim1_Location": 78.5,
      "Dim2_Visibility": 72.1,
      ...
    }
  }
}
```

---

### GET — Single Store Detail + History

```
GET ?action=store&store_code=E123
```

---

### GET — Health Ping

```
GET ?action=ping
```

---

## 7. Test with curl

### Ping
```bash
curl "https://script.google.com/macros/s/YOUR_ID/exec?action=ping"
```

### Submit assessment
```bash
curl -X POST \
  "https://script.google.com/macros/s/YOUR_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "store_code": "E123",
    "store_name": "Erafone BSD",
    "tsh": "Budi Santoso",
    "filled_by": "Admin ERA",
    "assessment_date": "2026-04-25",
    "dim1_location": 85,
    "dim2_visibility": 78,
    "dim3_financial": 90,
    "dim4_product_mix": 72,
    "dim5_people": 88,
    "dim6_promo": 65,
    "dim7_digital": 70,
    "dim8_store_activity": 80,
    "dim9_traffic": 75,
    "dim10_competitor": 60,
    "dim11_customer": 82,
    "dim12_operational": 77,
    "detailed_responses": {}
  }'
```

### Get summary
```bash
curl "https://script.google.com/macros/s/YOUR_ID/exec?action=summary"
```

### Get store history
```bash
curl "https://script.google.com/macros/s/YOUR_ID/exec?action=store&store_code=E123"
```

---

## 8. Notes

- **Duplicate protection**: same `store_code` + `assessment_date` will be rejected with `code: "DUPLICATE"`
- **Scores**: validated as 0–100, stored with 1 decimal precision
- **Google Apps Script quota**: 6 min/execution, 20k URL fetch calls/day (free tier) — sufficient for normal usage
- **CORS**: Google Apps Script auto-handles CORS for `Anyone` deployments; no preflight config needed
