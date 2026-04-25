// ERA-ANALYTICS — Store Health Check Backend
// Google Apps Script Web App
// Deploy: Execute as "Me", Access: "Anyone"

const SHEET_NAME = "HealthCheck";
const VALID_STATUSES = ["Excellent", "Good", "Critical"];
const VALID_DECISIONS = ["KEEP", "IMPROVE", "RELOCATE", "CLOSE"];
const SCORE_MIN = 0;
const SCORE_MAX = 100;

const DIM_COLUMNS = [
  "Dim1_Location",
  "Dim2_Visibility",
  "Dim3_Financial",
  "Dim4_Product_Mix",
  "Dim5_People",
  "Dim6_Promo",
  "Dim7_Digital",
  "Dim8_Store_Activity",
  "Dim9_Traffic",
  "Dim10_Competitor",
  "Dim11_Customer",
  "Dim12_Operational",
];

const COLUMNS = [
  "Timestamp",
  "Store_Code",
  "Store_Name",
  "TSH",
  "Filled_By",
  "Assessment_Date",
  ...DIM_COLUMNS,
  "Overall_Score",
  "Status",
  "Decision",
  "Detailed_Responses",
];

// ─── Sheet bootstrap ──────────────────────────────────────────────────────────

function initSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Write header if missing
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);

    const header = sheet.getRange(1, 1, 1, COLUMNS.length);
    header.setFontWeight("bold");
    header.setBackground("#8B0000");
    header.setFontColor("#FFFFFF");
    header.setHorizontalAlignment("center");

    sheet.setFrozenRows(1);

    // Column widths
    sheet.setColumnWidth(1, 160);  // Timestamp
    sheet.setColumnWidth(2, 100);  // Store_Code
    sheet.setColumnWidth(3, 180);  // Store_Name
    sheet.setColumnWidth(4, 140);  // TSH
    sheet.setColumnWidth(5, 140);  // Filled_By
    sheet.setColumnWidth(6, 130);  // Assessment_Date

    // Dimension score columns (7–18) — narrow
    for (let c = 7; c <= 18; c++) sheet.setColumnWidth(c, 90);

    sheet.setColumnWidth(19, 110); // Overall_Score
    sheet.setColumnWidth(20, 100); // Status
    sheet.setColumnWidth(21, 100); // Decision
    sheet.setColumnWidth(22, 300); // Detailed_Responses

    SpreadsheetApp.getUi().alert("Sheet '" + SHEET_NAME + "' initialized.");
  }

  return sheet;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateScore(value, fieldName) {
  const n = Number(value);
  if (isNaN(n) || n < SCORE_MIN || n > SCORE_MAX) {
    throw new Error(fieldName + " must be a number between 0 and 100, got: " + value);
  }
  return Math.round(n * 10) / 10; // Round to 1 decimal
}

function validateRequired(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(fieldName + " is required");
  }
  return String(value).trim();
}

function computeStatus(overall) {
  if (overall >= 80) return "Excellent";
  if (overall >= 60) return "Good";
  return "Critical";
}

function computeDecision(overall) {
  if (overall >= 80) return "KEEP";
  if (overall >= 60) return "IMPROVE";
  if (overall >= 40) return "RELOCATE";
  return "CLOSE";
}

// ─── CORS helper ─────────────────────────────────────────────────────────────

function corsResponse(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── doPost — receive assessment submission ───────────────────────────────────

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Empty request body");
    }

    const body = JSON.parse(e.postData.contents);

    // Required string fields
    const storeCode     = validateRequired(body.store_code,     "store_code");
    const storeName     = validateRequired(body.store_name,     "store_name");
    const tsh           = validateRequired(body.tsh,            "tsh");
    const filledBy      = validateRequired(body.filled_by,      "filled_by");
    const assessmentDate = validateRequired(body.assessment_date, "assessment_date");

    // Dimension scores
    const dimKeys = [
      "dim1_location", "dim2_visibility", "dim3_financial", "dim4_product_mix",
      "dim5_people", "dim6_promo", "dim7_digital", "dim8_store_activity",
      "dim9_traffic", "dim10_competitor", "dim11_customer", "dim12_operational",
    ];

    const dimScores = dimKeys.map((key, i) =>
      validateScore(body[key], DIM_COLUMNS[i])
    );

    // Compute or accept overall score
    const computedOverall = dimScores.reduce((a, b) => a + b, 0) / dimScores.length;
    const overallScore = body.overall_score !== undefined
      ? validateScore(body.overall_score, "overall_score")
      : Math.round(computedOverall * 10) / 10;

    // Status & Decision — auto-compute if not provided
    const status   = body.status   || computeStatus(overallScore);
    const decision = body.decision || computeDecision(overallScore);

    if (!VALID_STATUSES.includes(status)) {
      throw new Error("status must be one of: " + VALID_STATUSES.join(", "));
    }
    if (!VALID_DECISIONS.includes(decision)) {
      throw new Error("decision must be one of: " + VALID_DECISIONS.join(", "));
    }

    const detailedResponses = body.detailed_responses
      ? JSON.stringify(body.detailed_responses)
      : "{}";

    // Duplicate check — same store_code + assessment_date
    const sheet = getOrCreateSheet();
    if (isDuplicate(sheet, storeCode, assessmentDate)) {
      return corsResponse({
        success: false,
        error: "Duplicate entry: assessment for " + storeCode + " on " + assessmentDate + " already exists",
        code: "DUPLICATE",
      });
    }

    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      storeCode,
      storeName,
      tsh,
      filledBy,
      assessmentDate,
      ...dimScores,
      overallScore,
      status,
      decision,
      detailedResponses,
    ];

    sheet.appendRow(row);

    return corsResponse({
      success: true,
      message: "Assessment saved successfully",
      data: {
        timestamp,
        store_code: storeCode,
        store_name: storeName,
        overall_score: overallScore,
        status,
        decision,
      },
    });

  } catch (err) {
    console.error("doPost error:", err.message);
    return corsResponse({
      success: false,
      error: err.message,
      code: "VALIDATION_ERROR",
    });
  }
}

// ─── doGet — retrieve data for dashboard ──────────────────────────────────────

function doGet(e) {
  try {
    const params = e ? (e.parameter || {}) : {};
    const action = params.action || "list";

    switch (action) {
      case "list":    return handleList(params);
      case "summary": return handleSummary(params);
      case "store":   return handleStore(params);
      case "ping":    return corsResponse({ success: true, message: "ERA Health Check API is online" });
      default:
        return corsResponse({ success: false, error: "Unknown action: " + action });
    }

  } catch (err) {
    console.error("doGet error:", err.message);
    return corsResponse({ success: false, error: err.message });
  }
}

// ─── GET handlers ─────────────────────────────────────────────────────────────

function handleList(params) {
  const sheet = getOrCreateSheet();
  const rows  = getDataRows(sheet);

  let data = rows;

  // Optional filters
  if (params.store_code) {
    const code = params.store_code.toUpperCase();
    data = data.filter(r => r.Store_Code.toUpperCase() === code);
  }
  if (params.status) {
    data = data.filter(r => r.Status === params.status);
  }
  if (params.decision) {
    data = data.filter(r => r.Decision === params.decision);
  }
  if (params.date_from) {
    data = data.filter(r => r.Assessment_Date >= params.date_from);
  }
  if (params.date_to) {
    data = data.filter(r => r.Assessment_Date <= params.date_to);
  }

  // Pagination
  const limit  = Math.min(parseInt(params.limit  || "500"), 1000);
  const offset = parseInt(params.offset || "0");
  const paged  = data.slice(offset, offset + limit);

  return corsResponse({
    success: true,
    total: data.length,
    limit,
    offset,
    data: paged,
  });
}

function handleSummary(params) {
  const sheet = getOrCreateSheet();
  const rows  = getDataRows(sheet);

  if (rows.length === 0) {
    return corsResponse({ success: true, data: { total: 0 } });
  }

  const statusCount   = { Excellent: 0, Good: 0, Critical: 0 };
  const decisionCount = { KEEP: 0, IMPROVE: 0, RELOCATE: 0, CLOSE: 0 };
  let totalScore = 0;

  const dimAverages = {};
  DIM_COLUMNS.forEach(d => { dimAverages[d] = 0; });

  rows.forEach(r => {
    statusCount[r.Status]     = (statusCount[r.Status]   || 0) + 1;
    decisionCount[r.Decision] = (decisionCount[r.Decision] || 0) + 1;
    totalScore += Number(r.Overall_Score);
    DIM_COLUMNS.forEach(d => { dimAverages[d] += Number(r[d]); });
  });

  const n = rows.length;
  DIM_COLUMNS.forEach(d => { dimAverages[d] = Math.round((dimAverages[d] / n) * 10) / 10; });

  return corsResponse({
    success: true,
    data: {
      total: n,
      avg_overall_score: Math.round((totalScore / n) * 10) / 10,
      status_distribution: statusCount,
      decision_distribution: decisionCount,
      dimension_averages: dimAverages,
    },
  });
}

function handleStore(params) {
  if (!params.store_code) {
    return corsResponse({ success: false, error: "store_code parameter is required" });
  }

  const sheet = getOrCreateSheet();
  const rows  = getDataRows(sheet);
  const code  = params.store_code.toUpperCase();
  const store = rows
    .filter(r => r.Store_Code.toUpperCase() === code)
    .sort((a, b) => b.Assessment_Date.localeCompare(a.Assessment_Date));

  if (store.length === 0) {
    return corsResponse({ success: false, error: "Store not found: " + code, code: "NOT_FOUND" });
  }

  return corsResponse({
    success: true,
    data: {
      store_code: code,
      store_name: store[0].Store_Name,
      latest: store[0],
      history: store,
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    const header = sheet.getRange(1, 1, 1, COLUMNS.length);
    header.setFontWeight("bold");
    header.setBackground("#8B0000");
    header.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getDataRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  return values
    .filter(row => row[0] !== "") // skip empty rows
    .map(row => {
      const obj = {};
      COLUMNS.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
}

function isDuplicate(sheet, storeCode, assessmentDate) {
  const rows = getDataRows(sheet);
  return rows.some(
    r => r.Store_Code === storeCode && r.Assessment_Date === assessmentDate
  );
}

// ─── Utility: manual test from Apps Script editor ────────────────────────────

function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        store_code: "E123",
        store_name: "Erafone BSD",
        tsh: "Budi Santoso",
        filled_by: "Admin",
        assessment_date: "2026-04-25",
        dim1_location: 85,
        dim2_visibility: 78,
        dim3_financial: 90,
        dim4_product_mix: 72,
        dim5_people: 88,
        dim6_promo: 65,
        dim7_digital: 70,
        dim8_store_activity: 80,
        dim9_traffic: 75,
        dim10_competitor: 60,
        dim11_customer: 82,
        dim12_operational: 77,
        detailed_responses: { q1: "Good location near mall entrance" },
      }),
    },
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

function testDoGet() {
  const result = doGet({ parameter: { action: "summary" } });
  Logger.log(result.getContent());
}
