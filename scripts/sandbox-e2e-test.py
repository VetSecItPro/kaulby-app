#!/usr/bin/env python3
"""
Comprehensive Polar sandbox e2e test driver.

Drives the deployed sandbox webhook URL with synthetically-signed events
covering every payment lifecycle scenario, queries the DB after each event
to verify expected state transitions, and reports per-scenario pass/fail.

Test user IDs prefixed with `sandbox_test_` for easy cleanup at the end.

Usage:
    python3 scripts/sandbox-e2e-test.py

Requires .env.local with:
    DATABASE_URL                            (production - test users go here, prefixed)
    POLAR_SANDBOX_WEBHOOK_SECRET            (Polar sandbox webhook signing secret)
    POLAR_SANDBOX_*_PRODUCT_ID              (sandbox product IDs)
"""

import hmac
import hashlib
import json
import os
import sys
import time
import uuid
from urllib import request as urlreq
from urllib.error import HTTPError
import re
import psycopg2

# --- Config ---------------------------------------------------------------

WEBHOOK_URL = "https://kaulby-app-git-sandbox-vetsecitpro.vercel.app/api/webhooks/polar"

# Load .env.local
ENV = {}
with open(".env.local") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            ENV[k.strip()] = v.strip()

WEBHOOK_SECRET = ENV.get("POLAR_SANDBOX_WEBHOOK_SECRET") or ""
DB_URL = ENV.get("DATABASE_URL") or ""

PRODUCTS = {
    "solo_monthly":          ENV.get("POLAR_SANDBOX_SOLO_MONTHLY_PRODUCT_ID"),
    "solo_annual":           ENV.get("POLAR_SANDBOX_SOLO_ANNUAL_PRODUCT_ID"),
    "scale_monthly":         ENV.get("POLAR_SANDBOX_SCALE_MONTHLY_PRODUCT_ID"),
    "scale_annual":          ENV.get("POLAR_SANDBOX_SCALE_ANNUAL_PRODUCT_ID"),
    "growth_monthly":        ENV.get("POLAR_SANDBOX_GROWTH_MONTHLY_PRODUCT_ID"),
    "growth_annual":         ENV.get("POLAR_SANDBOX_GROWTH_ANNUAL_PRODUCT_ID"),
    "growth_seat_monthly":   ENV.get("POLAR_SANDBOX_GROWTH_SEAT_MONTHLY_PRODUCT_ID"),
    "growth_seat_annual":    ENV.get("POLAR_SANDBOX_GROWTH_SEAT_ANNUAL_PRODUCT_ID"),
    "day_pass":              ENV.get("POLAR_SANDBOX_DAY_PASS_PRODUCT_ID"),
}

# --- Helpers --------------------------------------------------------------

def sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

def post_event(event_type: str, data: dict, override_sig: str | None = None) -> tuple[int, dict]:
    """Send a signed webhook event. Returns (status_code, response_json)."""
    body = json.dumps({"type": event_type, "data": data})
    sig = override_sig if override_sig is not None else sign(body, WEBHOOK_SECRET)
    req = urlreq.Request(
        WEBHOOK_URL,
        data=body.encode(),
        headers={"Content-Type": "application/json", "x-polar-signature": sig},
        method="POST",
    )
    try:
        with urlreq.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")

def get_db():
    return psycopg2.connect(DB_URL)

def db_user(user_id: str) -> dict | None:
    with get_db() as c:
        with c.cursor() as cur:
            cur.execute(
                "SELECT id, email, subscription_status, polar_customer_id, polar_subscription_id, current_period_end FROM users WHERE id = %s",
                (user_id,),
            )
            r = cur.fetchone()
            if not r: return None
            return dict(zip(["id","email","subscription_status","polar_customer_id","polar_subscription_id","current_period_end"], r))

def db_workspace(owner_id: str) -> dict | None:
    with get_db() as c:
        with c.cursor() as cur:
            cur.execute(
                "SELECT id, owner_id, seat_limit, seat_count FROM workspaces WHERE owner_id = %s",
                (owner_id,),
            )
            r = cur.fetchone()
            if not r: return None
            return dict(zip(["id","owner_id","seat_limit","seat_count"], r))

def create_test_user(user_id: str, email: str) -> None:
    with get_db() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, subscription_status) VALUES (%s, %s, 'free') ON CONFLICT (id) DO NOTHING",
                (user_id, email),
            )
            c.commit()

def create_test_workspace(owner_id: str, name: str) -> str:
    """Create a workspace and return its (auto-generated UUID) id."""
    with get_db() as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO workspaces (owner_id, name, seat_limit, seat_count) VALUES (%s, %s, 3, 1) RETURNING id",
                (owner_id, name),
            )
            wsid = cur.fetchone()[0]
            c.commit()
            return str(wsid)

def cleanup_sandbox_data() -> None:
    """Remove all sandbox_test_* users and their workspaces."""
    with get_db() as c:
        with c.cursor() as cur:
            cur.execute("DELETE FROM workspaces WHERE owner_id LIKE 'sandbox_test_%'")
            cur.execute("DELETE FROM users WHERE id LIKE 'sandbox_test_%'")
            cur.execute("DELETE FROM webhook_events WHERE event_id LIKE 'sandbox-e2e-%'")
            c.commit()

# --- Test recording -------------------------------------------------------

results = []  # list of (name, passed, detail)

def expect(name: str, passed: bool, detail: str = "") -> None:
    results.append((name, passed, detail))
    mark = "✅" if passed else "❌"
    print(f"  {mark} {name}" + (f"  — {detail}" if detail else ""))

# --- Scenarios ------------------------------------------------------------

def scenario_solo_monthly_subscribe():
    print("\n[A] Solo Monthly subscribe")
    uid = f"sandbox_test_solo_m_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")

    # checkout.updated succeeded
    code, _ = post_event("checkout.updated", {
        "id": f"sandbox-e2e-co-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["solo_monthly"],
        "metadata": {"userId": uid},
    })
    expect("checkout.updated returns 200", code == 200, f"got {code}")

    user = db_user(uid)
    expect("polar_customer_id stored", bool(user and user["polar_customer_id"]),
           f"got {user['polar_customer_id'] if user else None}")

    # subscription.active sets the tier
    code, _ = post_event("subscription.active", {
        "id": f"sandbox-e2e-sub-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["solo_monthly"],
        "currentPeriodEnd": "2099-01-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    expect("subscription.active returns 200", code == 200, f"got {code}")
    user = db_user(uid)
    expect("subscription_status = solo", user and user["subscription_status"] == "solo",
           f"got {user['subscription_status'] if user else None}")
    return uid

def scenario_scale_subscribe():
    print("\n[B] Scale Monthly subscribe")
    uid = f"sandbox_test_scale_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    code, _ = post_event("checkout.updated", {
        "id": f"sandbox-e2e-co-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["scale_monthly"],
        "metadata": {"userId": uid},
    })
    code2, _ = post_event("subscription.active", {
        "id": f"sandbox-e2e-sub-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["scale_monthly"],
        "currentPeriodEnd": "2099-01-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    expect("scale checkout+subscribe both 200", code == 200 and code2 == 200, f"{code}/{code2}")
    expect("subscription_status = scale", user and user["subscription_status"] == "scale",
           f"got {user['subscription_status'] if user else None}")
    return uid

def scenario_growth_subscribe_then_seats():
    print("\n[C] Growth subscribe + seat addons + cancel + revoke")
    uid = f"sandbox_test_growth_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    wsid = create_test_workspace(uid, "Sandbox Test WS")

    # Subscribe to Growth
    post_event("checkout.updated", {
        "id": f"sandbox-e2e-co-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "metadata": {"userId": uid},
    })
    post_event("subscription.active", {
        "id": f"sandbox-e2e-sub-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "currentPeriodEnd": "2099-01-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    ws = db_workspace(uid)
    expect("growth subscription_status set", user and user["subscription_status"] == "growth")
    expect("workspace seatLimit baseline = 3", ws and ws["seat_limit"] == 3, f"got {ws['seat_limit'] if ws else None}")

    # Add 2 seats
    for i in range(2):
        post_event("checkout.updated", {
            "id": f"sandbox-e2e-seat{i}-{uid}",
            "status": "succeeded",
            "customerId": f"sandbox_cust_{uid}",
            "productId": PRODUCTS["growth_seat_monthly"],
            "metadata": {"userId": uid, "type": "team_seat", "workspaceId": wsid},
        })
    ws = db_workspace(uid)
    expect("seatLimit = 5 after +2 seat addons", ws and ws["seat_limit"] == 5, f"got {ws['seat_limit'] if ws else None}")

    # Revoke 1 seat (Approach B: subscription.revoked when period ends)
    post_event("subscription.revoked", {
        "id": f"sandbox-e2e-seatsub1-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_seat_monthly"],
        "metadata": {"userId": uid},
    })
    ws = db_workspace(uid)
    expect("seatLimit = 4 after seat revoke", ws and ws["seat_limit"] == 4, f"got {ws['seat_limit'] if ws else None}")

    # User must still be growth (NOT downgraded by seat revoke)
    user = db_user(uid)
    expect("user still on growth after seat revoke", user and user["subscription_status"] == "growth",
           f"got {user['subscription_status'] if user else None}")

    # Revoke 2nd and 3rd to test floor
    post_event("subscription.revoked", {
        "id": f"sandbox-e2e-seatsub2-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_seat_monthly"],
        "metadata": {"userId": uid},
    })
    ws = db_workspace(uid)
    expect("seatLimit = 3 after 2nd seat revoke (= baseline)", ws and ws["seat_limit"] == 3, f"got {ws['seat_limit'] if ws else None}")

    # 3rd revoke should NOT drop below 3 (GREATEST guard)
    post_event("subscription.revoked", {
        "id": f"sandbox-e2e-seatsub3-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_seat_monthly"],
        "metadata": {"userId": uid},
    })
    ws = db_workspace(uid)
    expect("seatLimit floor at 3 (cannot go below baseline)", ws and ws["seat_limit"] == 3, f"got {ws['seat_limit'] if ws else None}")

    # Now cancel the main growth subscription (period end)
    post_event("subscription.canceled", {
        "id": f"sandbox-e2e-sub-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "currentPeriodEnd": "2099-02-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    expect("user still growth after .canceled (honors paid period)", user and user["subscription_status"] == "growth",
           f"got {user['subscription_status'] if user else None}")
    expect("currentPeriodEnd updated on .canceled", user and user["current_period_end"] is not None)

    # Then revoke at actual period end → downgrade to free
    post_event("subscription.revoked", {
        "id": f"sandbox-e2e-sub-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    expect("user downgraded to free after main subscription.revoked",
           user and user["subscription_status"] == "free",
           f"got {user['subscription_status'] if user else None}")

    return uid

def scenario_day_pass():
    print("\n[D] Day Pass purchase")
    uid = f"sandbox_test_dp_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    code, _ = post_event("checkout.updated", {
        "id": f"sandbox-e2e-dp-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["day_pass"],
        "metadata": {"userId": uid, "type": "day_pass"},
    })
    expect("day pass checkout returns 200", code == 200, f"got {code}")
    return uid

def scenario_refund():
    print("\n[E] Order refunded")
    uid = f"sandbox_test_refund_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    # First subscribe to scale
    post_event("checkout.updated", {
        "id": f"sandbox-e2e-co-r-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["scale_monthly"],
        "metadata": {"userId": uid},
    })
    post_event("subscription.active", {
        "id": f"sandbox-e2e-sub-r-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["scale_monthly"],
        "currentPeriodEnd": "2099-01-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    expect("scale active before refund", user and user["subscription_status"] == "scale")

    # Refund
    code, _ = post_event("order.refunded", {
        "id": f"sandbox-e2e-refund-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "subscriptionId": f"sandbox-e2e-sub-r-{uid}",
    })
    user = db_user(uid)
    expect("user downgraded to free after refund",
           user and user["subscription_status"] == "free",
           f"got {user['subscription_status'] if user else None}")

def scenario_idempotency_replay():
    print("\n[F] Idempotency / replay protection")
    uid = f"sandbox_test_replay_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    payload_data = {
        "id": f"sandbox-e2e-replay-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["solo_monthly"],
        "metadata": {"userId": uid},
    }
    code1, body1 = post_event("checkout.updated", payload_data)
    code2, body2 = post_event("checkout.updated", payload_data)
    expect("first delivery 200", code1 == 200, f"got {code1}")
    expect("replay returns 200 + duplicate=true", code2 == 200 and body2.get("duplicate") is True, f"got {code2} {body2}")

def scenario_security_bad_sig():
    print("\n[G] Bad signature")
    code, body = post_event("checkout.updated", {"id": "x"}, override_sig="not_a_real_signature")
    expect("bad signature returns 400", code == 400, f"got {code} {body}")

def scenario_missing_user_id():
    print("\n[H] Missing userId in metadata (graceful handling)")
    code, _ = post_event("checkout.updated", {
        "id": f"sandbox-e2e-nouid-{uuid.uuid4().hex[:8]}",
        "status": "succeeded",
        "productId": PRODUCTS["solo_monthly"],
        "metadata": {},  # no userId
    })
    expect("missing userId returns 200 (logged + no-op)", code == 200, f"got {code}")

def scenario_unknown_event():
    print("\n[I] Unknown event type (graceful no-op)")
    code, _ = post_event("totally.unknown.event", {"id": f"sandbox-e2e-unk-{uuid.uuid4().hex[:8]}"})
    expect("unknown event returns 200 (no-op)", code == 200, f"got {code}")

def scenario_growth_to_solo_downgrade():
    print("\n[J] Growth subscribe → revoke → user downgrades cleanly (no orphan workspace)")
    uid = f"sandbox_test_dg_{uuid.uuid4().hex[:8]}"
    create_test_user(uid, f"{uid}@test.example")
    wsid = create_test_workspace(uid, "Downgrade Test WS")
    post_event("checkout.updated", {
        "id": f"sandbox-e2e-co-d-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "metadata": {"userId": uid},
    })
    post_event("subscription.active", {
        "id": f"sandbox-e2e-sub-d-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "currentPeriodEnd": "2099-01-01T00:00:00Z",
        "metadata": {"userId": uid},
    })
    # Add a paid seat
    post_event("checkout.updated", {
        "id": f"sandbox-e2e-seatd-{uid}",
        "status": "succeeded",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_seat_monthly"],
        "metadata": {"userId": uid, "type": "team_seat", "workspaceId": wsid},
    })
    ws = db_workspace(uid)
    expect("workspace seatLimit = 4 with paid seat", ws and ws["seat_limit"] == 4, f"got {ws['seat_limit'] if ws else None}")

    # Now main growth subscription is revoked (e.g. after voluntary cancel + period end)
    post_event("subscription.revoked", {
        "id": f"sandbox-e2e-sub-d-{uid}",
        "customerId": f"sandbox_cust_{uid}",
        "productId": PRODUCTS["growth_monthly"],
        "metadata": {"userId": uid},
    })
    user = db_user(uid)
    ws = db_workspace(uid)
    expect("user downgraded to free", user and user["subscription_status"] == "free")
    # The seat-addon subscription would still be active in Polar's eyes - but the
    # user lost growth tier so the seats are stranded paid-for capacity. This is
    # a real concern: should main-tier revoke also cancel seat-addons? Track it.
    expect("workspace still has seatLimit=4 (paid addons not auto-canceled)",
           ws and ws["seat_limit"] == 4,
           f"got {ws['seat_limit'] if ws else None} - FLAG: orphaned paid seats after main downgrade")

# --- Run ------------------------------------------------------------------

if __name__ == "__main__":
    if not WEBHOOK_SECRET:
        print("ERROR: POLAR_SANDBOX_WEBHOOK_SECRET not set in .env.local")
        sys.exit(2)
    if not DB_URL:
        print("ERROR: DATABASE_URL not set in .env.local")
        sys.exit(2)
    if not all(PRODUCTS.values()):
        missing = [k for k,v in PRODUCTS.items() if not v]
        print(f"ERROR: missing product IDs: {missing}")
        sys.exit(2)

    print("Cleaning up any leftover sandbox test data...")
    cleanup_sandbox_data()

    try:
        scenario_solo_monthly_subscribe()
        scenario_scale_subscribe()
        scenario_growth_subscribe_then_seats()
        scenario_day_pass()
        scenario_refund()
        scenario_idempotency_replay()
        scenario_security_bad_sig()
        scenario_missing_user_id()
        scenario_unknown_event()
        scenario_growth_to_solo_downgrade()
    finally:
        print("\nCleaning up sandbox test data...")
        cleanup_sandbox_data()

    print("\n" + "=" * 70)
    passed = sum(1 for _,p,_ in results if p)
    failed = sum(1 for _,p,_ in results if not p)
    print(f"  RESULTS: {passed}/{len(results)} passed, {failed} failed")
    print("=" * 70)
    if failed:
        print("\nFailures:")
        for name, p, detail in results:
            if not p:
                print(f"  ❌ {name}  — {detail}")
        sys.exit(1)
