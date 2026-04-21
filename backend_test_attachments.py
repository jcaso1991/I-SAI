"""
Backend tests for Event Attachments (POST/GET/DELETE /api/events/{eid}/attachments[/{aid}]).
Also performs sanity checks on existing calendar endpoints.

Target: http://localhost:8001/api
"""
import os
import sys
import time
import base64
import requests
from datetime import datetime

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001") + "/api"

ADMIN_EMAIL = "admin@materiales.com"
ADMIN_PASS = "Admin1234"

ts = int(time.time())
TECH_ASSIGNED_EMAIL = f"tech_assigned_{ts}@materiales.com"
TECH_OUTSIDE_EMAIL = f"tech_outside_{ts}@materiales.com"
TECH_PASS = "Tech1234"

results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {detail}")
    results.append((name, ok, detail))


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]


def create_user(admin_token, email, password, name, role="user"):
    r = requests.post(
        f"{BASE}/users",
        headers=hdr(admin_token),
        json={"email": email, "password": password, "name": name, "role": role},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def delete_user(admin_token, uid):
    try:
        requests.delete(f"{BASE}/users/{uid}", headers=hdr(admin_token), timeout=30)
    except Exception:
        pass


def delete_event(admin_token, eid):
    try:
        requests.delete(f"{BASE}/events/{eid}", headers=hdr(admin_token), timeout=30)
    except Exception:
        pass


def create_event(admin_token, title, assigned_user_ids=None, start="2026-05-04T09:00:00Z", end="2026-05-04T10:00:00Z"):
    body = {
        "title": title,
        "start_at": start,
        "end_at": end,
        "assigned_user_ids": assigned_user_ids or [],
    }
    r = requests.post(f"{BASE}/events", headers=hdr(admin_token), json=body, timeout=30)
    r.raise_for_status()
    return r.json()


# Small valid PDF bytes (minimal valid-ish PDF header/body works for size validation; the backend
# only checks mime_type and size, not content validity)
SMALL_PDF_BYTES = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
# Minimal 1x1 PNG (valid)
TINY_PNG_BYTES = base64.b64decode(
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
# Minimal 1x1 JPEG (valid header)
TINY_JPEG_BYTES = base64.b64decode(
    b"/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5/ooooA//2Q=="
)


def b64(bytes_: bytes) -> str:
    return base64.b64encode(bytes_).decode()


def main():
    created_event_ids = []
    created_user_ids = []

    print(f"BASE={BASE}")

    # ---- Login admin
    admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASS)
    log("admin_login", True, f"id={admin_user['id']}")

    # ---- Create tech users (assigned + outside)
    tech_a = create_user(admin_token, TECH_ASSIGNED_EMAIL, TECH_PASS, "Tech Assigned")
    tech_o = create_user(admin_token, TECH_OUTSIDE_EMAIL, TECH_PASS, "Tech Outside")
    created_user_ids.extend([tech_a["id"], tech_o["id"]])
    tech_a_token, _ = login(TECH_ASSIGNED_EMAIL, TECH_PASS)
    tech_o_token, _ = login(TECH_OUTSIDE_EMAIL, TECH_PASS)

    # =========================================================
    # Sanity: previous calendar endpoints still work
    # =========================================================
    # Create a base event with weekly recurrence for sanity
    sanity_body = {
        "title": "Sanity weekly",
        "start_at": "2026-04-06T09:00:00Z",
        "end_at": "2026-04-06T10:00:00Z",
        "recurrence": {"type": "weekly", "until": "2026-04-27"},
    }
    r = requests.post(f"{BASE}/events", headers=hdr(admin_token), json=sanity_body, timeout=30)
    assert r.status_code == 200, r.text
    sanity_ev = r.json()
    created_event_ids.append(sanity_ev["id"])

    # List events with window containing 4 weeks
    r = requests.get(
        f"{BASE}/events",
        headers=hdr(admin_token),
        params={"from": "2026-04-06T00:00:00Z", "to": "2026-04-28T00:00:00Z"},
        timeout=30,
    )
    ok = r.status_code == 200
    if ok:
        evs = r.json()
        occ = [
            e for e in evs
            if e.get("base_event_id") == sanity_ev["id"]
            or e["id"] == sanity_ev["id"]
            or e["id"].startswith(sanity_ev["id"] + ":")
        ]
        dates = sorted({e["start_at"][:10] for e in occ})
        ok = dates == ["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"]
        log("sanity_recurrence_expansion_weekly_4_occurrences", ok, f"dates={dates}")
    else:
        log("sanity_recurrence_expansion_weekly_4_occurrences", False, f"status={r.status_code}")

    # Sanity: attachments metadata only on list
    r = requests.get(
        f"{BASE}/events",
        headers=hdr(admin_token),
        params={"from": "2026-04-06T00:00:00Z", "to": "2026-04-28T00:00:00Z"},
        timeout=30,
    )
    has_att_field = all("attachments" in e for e in r.json())
    log("sanity_list_has_attachments_field", has_att_field)

    # Non-admin visibility sanity (outside tech should NOT see sanity_ev)
    r = requests.get(
        f"{BASE}/events",
        headers=hdr(tech_o_token),
        params={"from": "2026-04-06T00:00:00Z", "to": "2026-04-28T00:00:00Z"},
        timeout=30,
    )
    ok_vis = r.status_code == 200 and sanity_ev["id"] not in {e["id"].split(":")[0] for e in r.json()}
    log("sanity_non_admin_visibility_filter", ok_vis)

    # =========================================================
    # Setup event for attachments (admin, no assignments yet)
    # =========================================================
    ev = create_event(admin_token, "ATT Event Admin", assigned_user_ids=[])
    created_event_ids.append(ev["id"])
    log("0_create_event_initial_attachments_empty", ev.get("attachments") == [], f"attachments={ev.get('attachments')}")

    # =========================================================
    # 1. Upload small PDF
    # =========================================================
    pdf_b64 = b64(SMALL_PDF_BYTES)
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(admin_token),
        json={"filename": "test.pdf", "mime_type": "application/pdf", "base64": pdf_b64},
        timeout=60,
    )
    ok = r.status_code == 200
    pdf_meta = r.json() if ok else {}
    ok_fields = (
        ok
        and "id" in pdf_meta
        and pdf_meta.get("filename") == "test.pdf"
        and pdf_meta.get("mime_type") == "application/pdf"
        and isinstance(pdf_meta.get("size"), int)
        and pdf_meta.get("size") > 0
        and "uploaded_at" in pdf_meta
        and "uploaded_by" in pdf_meta
        and "base64" not in pdf_meta
    )
    log("1_upload_small_pdf_200_metadata_only", ok_fields,
        f"status={r.status_code}, keys={list(pdf_meta.keys())}, size={pdf_meta.get('size')}")
    pdf_aid = pdf_meta.get("id")

    # =========================================================
    # 2. List events — attachments metadata only (no base64)
    # =========================================================
    r = requests.get(
        f"{BASE}/events",
        headers=hdr(admin_token),
        params={"from": "2026-05-01T00:00:00Z", "to": "2026-05-10T00:00:00Z"},
        timeout=30,
    )
    ok = r.status_code == 200
    found = None
    for e in r.json():
        if e["id"] == ev["id"]:
            found = e
            break
    ok_list = (
        ok
        and found is not None
        and isinstance(found.get("attachments"), list)
        and len(found["attachments"]) == 1
        and found["attachments"][0].get("id") == pdf_aid
        and "base64" not in found["attachments"][0]
    )
    log("2_list_events_attachments_metadata_only", ok_list,
        f"found_attachments={found.get('attachments') if found else None}")

    # =========================================================
    # 3. GET full payload with base64
    # =========================================================
    r = requests.get(
        f"{BASE}/events/{ev['id']}/attachments/{pdf_aid}",
        headers=hdr(admin_token),
        timeout=30,
    )
    ok = r.status_code == 200
    full = r.json() if ok else {}
    returned_b64 = (full.get("base64") or "").split(",")[-1].strip()
    sent_b64 = pdf_b64.split(",")[-1].strip()
    ok_payload = ok and returned_b64 == sent_b64 and full.get("mime_type") == "application/pdf"
    log("3_get_full_attachment_base64_matches", ok_payload,
        f"status={r.status_code}, match={returned_b64 == sent_b64}, len_sent={len(sent_b64)}, len_got={len(returned_b64)}")

    # =========================================================
    # 4. Upload JPEG
    # =========================================================
    jpg_b64 = b64(TINY_JPEG_BYTES)
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(admin_token),
        json={"filename": "test.jpg", "mime_type": "image/jpeg", "base64": jpg_b64},
        timeout=30,
    )
    log("4_upload_jpeg_200", r.status_code == 200, f"status={r.status_code}")
    jpg_aid = r.json().get("id") if r.status_code == 200 else None

    # =========================================================
    # 5. Upload PNG
    # =========================================================
    png_b64 = b64(TINY_PNG_BYTES)
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(admin_token),
        json={"filename": "tiny.png", "mime_type": "image/png", "base64": png_b64},
        timeout=30,
    )
    log("5_upload_png_200", r.status_code == 200, f"status={r.status_code}")
    png_aid = r.json().get("id") if r.status_code == 200 else None

    # =========================================================
    # 6. Reject unsupported mime (text/plain)
    # =========================================================
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(admin_token),
        json={"filename": "notes.txt", "mime_type": "text/plain", "base64": b64(b"hello")},
        timeout=30,
    )
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    log("6_reject_unsupported_mime_400", r.status_code == 400 and ("soportado" in detail.lower() or "supported" in detail.lower() or "PDF" in detail),
        f"status={r.status_code}, detail={detail!r}")

    # =========================================================
    # 7. Reject oversized (>15MB raw) — 413
    # =========================================================
    # Need raw_size > 15*1024*1024. raw_size = (len(b64)*3)//4 > 15*1024*1024
    # → len(b64) > 15*1024*1024*4/3 = 20,971,520 chars
    # Build fake base64 of ~21M 'A' chars (all 'A' = valid base64 chars)
    over_chars = 15 * 1024 * 1024 * 4 // 3 + 100  # ~20.97M + margin
    big_b64 = "A" * over_chars
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(admin_token),
        json={"filename": "huge.pdf", "mime_type": "application/pdf", "base64": big_b64},
        timeout=120,
    )
    log("7_reject_oversized_413", r.status_code == 413, f"status={r.status_code}, len_b64={len(big_b64)}")

    # =========================================================
    # 8. Virtual id accepted — upload using <eid>:YYYY-MM-DD
    # =========================================================
    virtual_id = f"{ev['id']}:2026-05-04"
    r = requests.post(
        f"{BASE}/events/{virtual_id}/attachments",
        headers=hdr(admin_token),
        json={"filename": "viaVirtual.png", "mime_type": "image/png", "base64": png_b64},
        timeout=30,
    )
    ok = r.status_code == 200
    virtual_aid = r.json().get("id") if ok else None
    # Verify stored on base event
    r2 = requests.get(
        f"{BASE}/events",
        headers=hdr(admin_token),
        params={"from": "2026-05-01T00:00:00Z", "to": "2026-05-10T00:00:00Z"},
        timeout=30,
    )
    stored_on_base = False
    if r2.status_code == 200 and virtual_aid:
        for e in r2.json():
            if e["id"] == ev["id"]:
                ids = [a["id"] for a in e.get("attachments", [])]
                stored_on_base = virtual_aid in ids
                break
    log("8_virtual_id_accepted_and_stored_on_base", ok and stored_on_base,
        f"status={r.status_code}, virtual_aid={virtual_aid}, stored_on_base={stored_on_base}")

    # =========================================================
    # 9. Delete attachment
    # =========================================================
    r = requests.delete(
        f"{BASE}/events/{ev['id']}/attachments/{pdf_aid}",
        headers=hdr(admin_token),
        timeout=30,
    )
    ok_del = r.status_code == 200 and r.json().get("ok") is True
    log("9_delete_attachment_200_ok_true", ok_del, f"status={r.status_code}, body={r.text[:200]}")

    # GET deleted attachment → 404
    r = requests.get(
        f"{BASE}/events/{ev['id']}/attachments/{pdf_aid}",
        headers=hdr(admin_token),
        timeout=30,
    )
    log("9_get_deleted_attachment_404", r.status_code == 404, f"status={r.status_code}")

    # List events → attachments no longer contains pdf_aid
    r = requests.get(
        f"{BASE}/events",
        headers=hdr(admin_token),
        params={"from": "2026-05-01T00:00:00Z", "to": "2026-05-10T00:00:00Z"},
        timeout=30,
    )
    gone_in_list = True
    for e in r.json():
        if e["id"] == ev["id"]:
            ids = [a["id"] for a in e.get("attachments", [])]
            gone_in_list = pdf_aid not in ids
            break
    log("9_deleted_not_in_list", gone_in_list)

    # =========================================================
    # 10. Permissions
    # =========================================================
    # Use jpg_aid which still exists on ev
    # 10a. No token → 401
    for method, url in [
        ("POST", f"{BASE}/events/{ev['id']}/attachments"),
        ("GET", f"{BASE}/events/{ev['id']}/attachments/{jpg_aid}"),
        ("DELETE", f"{BASE}/events/{ev['id']}/attachments/{jpg_aid}"),
    ]:
        if method == "POST":
            r = requests.post(url, json={"filename": "x.pdf", "mime_type": "application/pdf", "base64": pdf_b64}, timeout=30)
        elif method == "GET":
            r = requests.get(url, timeout=30)
        else:
            r = requests.delete(url, timeout=30)
        log(f"10a_no_token_{method}_401", r.status_code == 401, f"status={r.status_code}")

    # 10b. Non-admin outside assigned_user_ids → 403
    # ev is admin-owned with no assignments. tech_o is NOT assigned.
    r = requests.post(
        f"{BASE}/events/{ev['id']}/attachments",
        headers=hdr(tech_o_token),
        json={"filename": "x.pdf", "mime_type": "application/pdf", "base64": pdf_b64},
        timeout=30,
    )
    log("10b_non_assigned_user_POST_403", r.status_code == 403, f"status={r.status_code}")

    r = requests.get(f"{BASE}/events/{ev['id']}/attachments/{jpg_aid}", headers=hdr(tech_o_token), timeout=30)
    log("10b_non_assigned_user_GET_403", r.status_code == 403, f"status={r.status_code}")

    r = requests.delete(f"{BASE}/events/{ev['id']}/attachments/{jpg_aid}", headers=hdr(tech_o_token), timeout=30)
    log("10b_non_assigned_user_DELETE_403", r.status_code == 403, f"status={r.status_code}")

    # 10c. Non-admin IN assigned_user_ids → 200
    # Create an event with tech_a assigned
    ev2 = create_event(admin_token, "ATT Event for Tech A", assigned_user_ids=[tech_a["id"]])
    created_event_ids.append(ev2["id"])

    # Tech A uploads
    r = requests.post(
        f"{BASE}/events/{ev2['id']}/attachments",
        headers=hdr(tech_a_token),
        json={"filename": "from_tech.pdf", "mime_type": "application/pdf", "base64": pdf_b64},
        timeout=30,
    )
    ok = r.status_code == 200
    tech_aid = r.json().get("id") if ok else None
    log("10c_assigned_user_POST_200", ok, f"status={r.status_code}")

    # Tech A gets full
    r = requests.get(f"{BASE}/events/{ev2['id']}/attachments/{tech_aid}", headers=hdr(tech_a_token), timeout=30)
    ok = r.status_code == 200 and r.json().get("base64") is not None
    log("10c_assigned_user_GET_200", ok, f"status={r.status_code}")

    # Tech A deletes
    r = requests.delete(f"{BASE}/events/{ev2['id']}/attachments/{tech_aid}", headers=hdr(tech_a_token), timeout=30)
    log("10c_assigned_user_DELETE_200", r.status_code == 200 and r.json().get("ok") is True, f"status={r.status_code}")

    # =========================================================
    # 11. Non-existing event → 404
    # =========================================================
    bogus_eid = "00000000-0000-0000-0000-000000000000"
    r = requests.post(
        f"{BASE}/events/{bogus_eid}/attachments",
        headers=hdr(admin_token),
        json={"filename": "x.pdf", "mime_type": "application/pdf", "base64": pdf_b64},
        timeout=30,
    )
    log("11_bogus_event_POST_404", r.status_code == 404, f"status={r.status_code}")

    r = requests.get(f"{BASE}/events/{bogus_eid}/attachments/{bogus_eid}", headers=hdr(admin_token), timeout=30)
    log("11_bogus_event_GET_404", r.status_code == 404, f"status={r.status_code}")

    r = requests.delete(f"{BASE}/events/{bogus_eid}/attachments/{bogus_eid}", headers=hdr(admin_token), timeout=30)
    log("11_bogus_event_DELETE_404", r.status_code == 404, f"status={r.status_code}")

    # =========================================================
    # 12. Non-existing attachment on valid event → 404
    # =========================================================
    r = requests.get(f"{BASE}/events/{ev['id']}/attachments/{bogus_eid}", headers=hdr(admin_token), timeout=30)
    log("12_bogus_attachment_GET_404", r.status_code == 404, f"status={r.status_code}")

    r = requests.delete(f"{BASE}/events/{ev['id']}/attachments/{bogus_eid}", headers=hdr(admin_token), timeout=30)
    log("12_bogus_attachment_DELETE_404", r.status_code == 404, f"status={r.status_code}")

    # =========================================================
    # Cleanup
    # =========================================================
    for eid in created_event_ids:
        delete_event(admin_token, eid)
    for uid in created_user_ids:
        delete_user(admin_token, uid)

    # Summary
    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [r for r in results if not r[1]]
    print(f"PASSED {passed}/{len(results)}")
    if failed:
        print("FAILED:")
        for name, _, detail in failed:
            print(f"  - {name}: {detail}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
