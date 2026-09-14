#!/usr/bin/env python3

############################################################
#
# CROWE SCHEDULING — ALERT SYSTEM
# Runs every day at 8am UTC via GitHub Actions
# Checks all active mandates for upcoming deadlines
# Sends email alerts to assigned staff
# Records alerts in TblAlert via Supabase REST API
#
############################################################

import os
import json
import smtplib
import requests
from datetime import datetime, date, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# CONFIGURATION
# ============================================================

SUPABASE_URL     = os.environ.get("SUPABASE_URL")
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_KEY")
GMAIL_USER       = os.environ.get("GMAIL_USER")
GMAIL_PASSWORD   = os.environ.get("GMAIL_APP_PASSWORD")
FROM_EMAIL       = os.environ.get("ALERT_FROM_EMAIL")

SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}

# Alert thresholds in days
ALERT_THRESHOLDS = [30, 14, 7, 3, 0]

# ============================================================
# FETCH ALL ACTIVE MANDATES FROM SUPABASE
# ============================================================

def get_active_mandates():
    url = f"{SUPABASE_URL}/rest/v1/TblJob"
    params = {
        "IsActive": "eq.true",
        "select":   "*",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200:
        return response.json()
    print(f"❌ Failed to fetch mandates: {response.status_code}")
    return []


def get_staff_email(staff_id):
    if not staff_id:
        return None
    url = f"{SUPABASE_URL}/rest/v1/TblStaff"
    params = {
        "StaffID": f"eq.{staff_id}",
        "select":  "Email,FirstName,LastName",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200 and response.json():
        return response.json()[0]
    return None


def get_partner_email(partner_id):
    if not partner_id:
        return None
    url = f"{SUPABASE_URL}/rest/v1/TblPartner"
    params = {
        "PartnerID": f"eq.{partner_id}",
        "select":    "Email,PartnerName",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200 and response.json():
        return response.json()[0]
    return None


def get_manager_email(manager_id):
    if not manager_id:
        return None
    url = f"{SUPABASE_URL}/rest/v1/TblManager"
    params = {
        "ManagerID": f"eq.{manager_id}",
        "select":    "Email,ManagerName",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200 and response.json():
        return response.json()[0]
    return None


def get_client_name(client_id):
    if not client_id:
        return "Unknown Client"
    url = f"{SUPABASE_URL}/rest/v1/TblClient"
    params = {
        "ClientID": f"eq.{client_id}",
        "select":   "ClientName",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200 and response.json():
        return response.json()[0]["ClientName"]
    return "Unknown Client"

# ============================================================
# CHECK IF ALERT ALREADY SENT TODAY
# ============================================================

def alert_already_sent(job_id, alert_type):
    url = f"{SUPABASE_URL}/rest/v1/TblAlert"
    today = date.today().isoformat()
    params = {
        "JobID":      f"eq.{job_id}",
        "AlertType":  f"eq.{alert_type}",
        "AlertDate":  f"gte.{today}",
        "select":     "AlertID",
    }
    response = requests.get(url, headers=SUPABASE_HEADERS, params=params)
    if response.status_code == 200:
        return len(response.json()) > 0
    return False

# ============================================================
# RECORD ALERT IN TblAlert
# ============================================================

def record_alert(job_id, staff_id, alert_type, email, subject, message):
    url = f"{SUPABASE_URL}/rest/v1/TblAlert"
    payload = {
        "JobID":       job_id,
        "StaffID":     staff_id or 1,
        "AlertType":   alert_type,
        "AlertDate":   datetime.now().isoformat(),
        "EmailAddress": email,
        "Subject":     subject,
        "Message":     message,
        "IsSent":      True,
        "SentDate":    datetime.now().isoformat(),
        "IsRead":      False,
    }
    requests.post(url, headers=SUPABASE_HEADERS, json=payload)

# ============================================================
# SEND EMAIL
# ============================================================

def send_email(to_email, subject, body):
    if not all([GMAIL_USER, GMAIL_PASSWORD, FROM_EMAIL]):
        print("❌ Email credentials not configured")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = FROM_EMAIL
        msg["To"]      = to_email

        # Plain text version
        text_part = MIMEText(body, "plain")

        # HTML version
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f97316; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0;">Crowe Scheduling — Deadline Alert</h2>
            </div>
            <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">{body}</pre>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 10px;">
                This is an automated alert from Crowe Scheduling.
                Please do not reply to this email.
            </p>
        </body>
        </html>
        """
        html_part = MIMEText(html_body, "html")

        msg.attach(text_part)
        msg.attach(html_part)

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(GMAIL_USER, GMAIL_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())

        print(f"   ✅ Email sent to {to_email}")
        return True

    except Exception as e:
        print(f"   ❌ Failed to send email to {to_email}: {e}")
        return False

# ============================================================
# CALCULATE DAYS TO DEADLINE
# ============================================================

def days_to_deadline(deadline_str):
    if not deadline_str:
        return None
    try:
        deadline = datetime.fromisoformat(deadline_str.replace("Z", "")).date()
        today    = date.today()
        return (deadline - today).days
    except Exception:
        return None

# ============================================================
# BUILD ALERT MESSAGE
# ============================================================

def build_alert_message(mandate, client_name, deadline_type, days, deadline_str):
    if days < 0:
        urgency = "⚠️  OVERDUE"
    elif days == 0:
        urgency = "🔴 DUE TODAY"
    elif days <= 3:
        urgency = "🔴 CRITICAL"
    elif days <= 7:
        urgency = "🟠 URGENT"
    elif days <= 14:
        urgency = "🟡 UPCOMING"
    else:
        urgency = "🟢 REMINDER"

    deadline_date = datetime.fromisoformat(
        deadline_str.replace("Z", "")
    ).strftime("%B %d, %Y")

    if days < 0:
        days_text = f"{abs(days)} days overdue"
    elif days == 0:
        days_text = "Due TODAY"
    else:
        days_text = f"{days} days remaining"

    body = f"""
{urgency} — {days_text}

Mandate:    {mandate.get('JobName', 'Unknown')}
Client:     {client_name}
Form Type:  {mandate.get('FormType', '')}
Tax Year:   {mandate.get('TaxYear', '')}

{deadline_type}: {deadline_date}

Please log in to Crowe Scheduling to update the status:
https://crowe-scheduling.vercel.app/mandates

---
This alert was sent because this mandate has a deadline approaching.
If you have already completed this return, please mark it as Completed
in the system to stop receiving alerts.
"""
    return body

# ============================================================
# PROCESS ONE MANDATE
# ============================================================

def process_mandate(mandate):
    job_id      = mandate.get("JobID")
    client_name = get_client_name(mandate.get("ClientID"))
    job_name    = mandate.get("JobName", "Unknown")

    print(f"\n📋 Processing: {job_name} — {client_name}")

    # Determine active deadline
    deadline_type = mandate.get("DeadlineType")

    if deadline_type == "DISASTER":
        deadline_str  = mandate.get("DisasterDeadline")
        deadline_label = "Disaster Deadline"
    elif mandate.get("ExtensionFiled"):
        deadline_str  = mandate.get("ExtensionDeadline")
        deadline_label = "Extended Due Date"
    else:
        deadline_str  = mandate.get("OriginalDeadline")
        deadline_label = "Legal Due Date"

    if not deadline_str:
        print(f"   ⏭ No deadline found — skipping")
        return

    days = days_to_deadline(deadline_str)
    if days is None:
        return

    print(f"   📅 {deadline_label}: {deadline_str} ({days} days)")

    # Determine alert type
    alert_type = None
    if days <= 0:
        alert_type = "overdue"
    elif days <= 3:
        alert_type = "3day"
    elif days <= 7:
        alert_type = "7day"
    elif days <= 14:
        alert_type = "14day"
    elif days <= 30:
        alert_type = "30day"
    else:
        print(f"   ✅ No alert needed ({days} days away)")
        return

    # Check if alert already sent today
    if alert_already_sent(job_id, alert_type):
        print(f"   ⏭ Alert {alert_type} already sent today — skipping")
        return

    # Build message
    body    = build_alert_message(mandate, client_name, deadline_label, days, deadline_str)
    subject = f"[{alert_type.upper()}] {job_name} — {deadline_label}"

    # Determine recipients based on urgency
    recipients = []

    # Always notify assigned staff
    assigned = get_staff_email(mandate.get("AssignedStaffID"))
    if assigned:
        recipients.append(assigned)

    # 14 days or less — also notify manager
    if days <= 14:
        manager = get_manager_email(mandate.get("MandateManagerID"))
        if manager:
            recipients.append(manager)

    # 7 days or less — also notify mandate partner
    if days <= 7:
        partner = get_partner_email(mandate.get("MandatePartnerID"))
        if partner:
            recipients.append(partner)

    # 3 days or less — also notify client partner
    if days <= 3:
        client_partner = get_partner_email(mandate.get("ClientPartnerID"))
        if client_partner:
            recipients.append(client_partner)

    if not recipients:
        # Fallback to alert email for testing
       fallback_email = FROM_EMAIL
       if fallback_email:
           print(f"   ⚠️  No recipients found — sending to fallback: {fallback_email}")
           recipients = [{"Email": fallback_email}]
       else:
            print(f"   ⚠️  No recipients found — skipping")
            return

    # Send emails
    print(f"   📧 Sending {alert_type} alert to {len(recipients)} recipient(s)...")
    sent = False
    for recipient in recipients:
        email = recipient.get("Email") or recipient.get("email")
        if email:
            success = send_email(email, subject, body)
            if success:
                sent = True
                record_alert(
                    job_id,
                    mandate.get("AssignedStaffID"),
                    alert_type,
                    email,
                    subject,
                    body
                )

    if sent:
        print(f"   ✅ Alerts sent for {job_name}")


# ============================================================
# ALSO CHECK INTERNAL DUE DATE (StaffDueDate)
# ============================================================

def process_internal_deadline(mandate):
    staff_due = mandate.get("StaffDueDate")
    if not staff_due:
        return

    days = days_to_deadline(staff_due)
    if days is None or days > 14:
        return

    job_id      = mandate.get("JobID")
    job_name    = mandate.get("JobName", "Unknown")
    client_name = get_client_name(mandate.get("ClientID"))
    alert_type  = f"internal_{days}day" if days > 0 else "internal_overdue"

    if alert_already_sent(job_id, alert_type):
        return

    body    = build_alert_message(mandate, client_name, "Internal Due Date", days, staff_due)
    subject = f"[INTERNAL] {job_name} — Internal deadline in {days} days"

    assigned = get_staff_email(mandate.get("AssignedStaffID"))
    if assigned:
        email = assigned.get("Email") or assigned.get("email")
        if email:
            success = send_email(email, subject, body)
            if success:
                record_alert(job_id, mandate.get("AssignedStaffID"), alert_type, email, subject, body)


# ============================================================
# MAIN
# ============================================================

def main():
    print(f"\n{'='*60}")
    print(f"CROWE SCHEDULING — ALERT SYSTEM")
    print(f"Run date: {date.today().strftime('%B %d, %Y')}")
    print(f"{'='*60}")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not configured")
        return

    if not GMAIL_USER or not GMAIL_PASSWORD:
        print("❌ Gmail credentials not configured")
        return

    mandates = get_active_mandates()
    print(f"\n📋 Found {len(mandates)} active mandates")

    alerts_sent = 0
    skipped     = 0

    for mandate in mandates:
        # Skip completed mandates
        stage_id = mandate.get("CurrentStageID")
        if mandate.get("Completion"):
            skipped += 1
            continue

        process_mandate(mandate)
        process_internal_deadline(mandate)
        alerts_sent += 1

    print(f"\n{'='*60}")
    print(f"ALERT SUMMARY")
    print(f"{'='*60}")
    print(f"Mandates processed: {alerts_sent}")
    print(f"Mandates skipped:   {skipped}")
    print(f"Run complete:       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()