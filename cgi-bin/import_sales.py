#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import tempfile
from email.parser import BytesParser
from email.policy import default
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
IMPORT_SCRIPT = BASE_DIR / "scripts" / "import_daily_sales.py"
OUTPUT_JSON = BASE_DIR / "outputs" / "dashboard_data_v2.json"


def send_json(payload: dict, status: int = 200) -> None:
    print(f"Status: {status}")
    print("Content-Type: application/json")
    print()
    print(json.dumps(payload, ensure_ascii=False))


def parse_uploaded_file() -> tuple[str, bytes]:
    content_type = os.environ.get("CONTENT_TYPE", "")
    content_length = int(os.environ.get("CONTENT_LENGTH", "0") or 0)
    if "multipart/form-data" not in content_type or content_length <= 0:
        raise ValueError("Request upload tidak valid.")

    body = os.fdopen(0, "rb").read(content_length)
    raw = f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode() + body
    message = BytesParser(policy=default).parsebytes(raw)

    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") != "file":
            continue
        filename = part.get_filename() or "sales_import.xlsx"
        payload = part.get_payload(decode=True) or b""
        if not payload:
            raise ValueError("File upload kosong.")
        return filename, payload

    raise ValueError("Field file tidak ditemukan.")


def run_import(source_path: Path | None = None) -> subprocess.CompletedProcess:
    args = ["python3", str(IMPORT_SCRIPT)]
    if source_path:
        args.append(str(source_path))
    return subprocess.run(
        args,
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> None:
    if os.environ.get("REQUEST_METHOD", "GET").upper() != "POST":
        send_json({"ok": False, "error": "Gunakan POST untuk import file."}, 405)
        return

    content_length = int(os.environ.get("CONTENT_LENGTH", "0") or 0)
    tmp_path: Path | None = None
    filename = "latest-auto-import"

    if content_length > 0:
        filename, payload = parse_uploaded_file()
        suffix = Path(filename).suffix or ".xlsx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(payload)
            tmp_path = Path(tmp.name)

    try:
        result = run_import(tmp_path)
        if result.returncode != 0:
            send_json(
                {
                    "ok": False,
                    "error": result.stderr.strip() or result.stdout.strip() or "Import gagal.",
                },
                500,
            )
            return

        source = {}
        if OUTPUT_JSON.exists():
            source = json.loads(OUTPUT_JSON.read_text()).get("source", {})

        send_json(
            {
                "ok": True,
                "message": "Import berhasil.",
                "filename": filename,
                "source": source,
                "log": result.stdout.strip(),
            }
        )
    finally:
        if tmp_path:
            tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        send_json({"ok": False, "error": str(exc)}, 500)
