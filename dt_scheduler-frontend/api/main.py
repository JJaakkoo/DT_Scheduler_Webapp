import os
import sys
import json
import base64
import io
from email.utils import parsedate_to_datetime
from flask import Flask, jsonify, request, Response
from icalendar import Calendar, Event
from datetime import datetime, timedelta, timezone
import pytz
from dotenv import load_dotenv

from supabase import create_client, Client
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# VERCEL FIX: Add the current directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import the master schedule processor we built together!
from schedule_processor import process_full_schedule 

# Load local environment variables (ignored in Vercel production)
load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("WARNING: Supabase credentials are missing!")
    supabase = None


def get_gmail_service(access_token):
    """Authenticates using the crowd-sourced token passed from the frontend."""
    # We no longer use local token.json. We trust the Google access_token from the browser!
    creds = Credentials(token=access_token)
    return build('gmail', 'v1', credentials=creds)


def fetch_latest_schedule_email(service):
    """
    Grabs the latest email with an attachment, strictly from Jacky's email to prevent spoofing.
    """
    try:
        # SECURITY PATCH: Hardcoded to ONLY accept emails from Jacky's known address.
        query = 'from:dreamteahousejacky@gmail.com has:attachment filename:xlsx'
        results = service.users().messages().list(userId='me', q=query, maxResults=1).execute()
        messages = results.get('messages', [])
        
        if not messages:
            return None, None, None

        msg_id = messages[0]['id']
        msg = service.users().messages().get(userId='me', id=msg_id).execute()

        # 2. Extract the exact Date it was sent
        email_date_str = None
        for header in msg['payload']['headers']:
            if header['name'] == 'Date':
                email_date_str = header['value']
                break

        # Convert the string to a timezone-aware datetime object
        email_timestamp = parsedate_to_datetime(email_date_str) if email_date_str else datetime.now(timezone.utc)

        # 3. Find and extract the Excel attachment ID
        attachment_id = None
        filename = "schedule.xlsx"
        
        for part in msg['payload'].get('parts', []):
            if part.get('filename') and part['filename'].endswith('.xlsx'):
                filename = part['filename']
                if 'attachmentId' in part['body']:
                    attachment_id = part['body']['attachmentId']
                break

        if not attachment_id:
            return None, None, None

        # 4. Download the actual file bytes
        attachment = service.users().messages().attachments().get(userId='me', messageId=msg_id, id=attachment_id).execute()
        file_data = base64.urlsafe_b64decode(attachment['data'].encode('UTF-8'))
        file_stream = io.BytesIO(file_data)

        return filename, file_stream, email_timestamp
    
    except Exception as e:
        print(f"Error fetching email: {e}")
        return None, None, None


def get_schedule_data(employee_name, force_sync=False, access_token=None):
    """
    Core Logic: Implements the 24-hour TTL Cache and Crowd-Sourced Sync.
    Returns: (shifts_list, metadata_dict, sync_status, error_message)
    """
    employee_key = employee_name.strip().lower()
    
    if not supabase:
        return None, None, "ERROR", "Database connection failed."

    try:
        # 1. FETCH LATEST CACHE FROM DATABASE
        response = supabase.table('schedules').select('*').order('year', desc=True).order('month', desc=True).order('period', desc=True).limit(1).execute()
        db_record = response.data[0] if len(response.data) > 0 else None

        current_time = datetime.now(timezone.utc)
        needs_sync = True
        sync_status = "OK"

        if db_record and db_record.get('last_synced_at'):
            last_synced = datetime.fromisoformat(db_record['last_synced_at'].replace('Z', '+00:00'))
            if not force_sync and (current_time - last_synced) < timedelta(hours=24):
                needs_sync = False
                print(f"CACHE HIT: TTL active. Skipping Gmail for {employee_name}.")

        # 2. CROWD-SOURCED SYNC ENGINE
        if needs_sync:
            print(f"SYNC TRIGGERED (Force: {force_sync}).")
            if not access_token:
                print("SYNC BLOCKED: No Google access token provided by the client.")
                sync_status = "TOKEN_REQUIRED"
            else:
                try:
                    print("SYNC AUTHORIZED: Access token provided. Checking inbox...")
                    gmail_service = get_gmail_service(access_token)
                    filename, file_stream, email_date = fetch_latest_schedule_email(gmail_service)
                    
                    if not file_stream:
                        print("SYNC FAILED: Could not find schedule email from Jacky in this inbox.")
                        sync_status = "EMAIL_NOT_FOUND"
                    else:
                        db_email_time = None
                        if db_record and db_record.get('email_timestamp'):
                            db_email_time = datetime.fromisoformat(db_record['email_timestamp'].replace('Z', '+00:00'))

                        # COMPARE TIMESTAMPS
                        if db_record and db_email_time and email_date <= db_email_time:
                            print("GATEKEEPER: Email is stale (older or same). Ignoring attachment. Resetting TTL clock.")
                            supabase.table('schedules').update({
                                "last_synced_at": current_time.isoformat()
                            }).eq('id', db_record['id']).execute()
                            db_record['last_synced_at'] = current_time.isoformat()
                        else:
                            print("GATEKEEPER: Brand new email detected! Parsing Excel and updating database...")
                            master_schedule_dict, start_date, end_date = process_full_schedule(file_stream, file_name=filename)
                            
                            if master_schedule_dict:
                                first_shift_dt = None
                                for emp, emp_shifts in master_schedule_dict.items():
                                    if emp_shifts and len(emp_shifts) > 0:
                                        first_shift_dt = datetime.strptime(emp_shifts[0]['start']['dateTime'], "%Y-%m-%dT%H:%M:%S")
                                        break
                                
                                if first_shift_dt:
                                    year = first_shift_dt.year
                                    month = first_shift_dt.month
                                    period = 1 if first_shift_dt.day <= 15 else 2

                                    new_record_data = {
                                        "year": year,
                                        "month": month,
                                        "period": period,
                                        "email_timestamp": email_date.isoformat(),
                                        "last_synced_at": current_time.isoformat(),
                                        "schedule_data": master_schedule_dict
                                    }

                                    period_check = supabase.table('schedules').select('*').eq('year', year).eq('month', month).eq('period', period).execute()
                                    if len(period_check.data) > 0:
                                        supabase.table('schedules').update(new_record_data).eq('id', period_check.data[0]['id']).execute()
                                    else:
                                        supabase.table('schedules').insert(new_record_data).execute()

                                    db_record = new_record_data
                except Exception as e:
                    print(f"SYNC FAILED: Token error or Gmail API rejected request: {e}")
                    sync_status = "TOKEN_EXPIRED"

        # 4. RETURN THE DATA (Even if sync failed, we return the stale cache if we have it)
        if not db_record:
             return None, None, sync_status, "Database is completely empty and no emails found."
             
        if employee_key == "master":
            shifts = []
            for emp, emp_shifts in db_record.get('schedule_data', {}).items():
                for shift in emp_shifts:
                    shift_with_name = shift.copy()
                    shift_with_name['employee'] = emp
                    shifts.append(shift_with_name)
        else:
            shifts = db_record.get('schedule_data', {}).get(employee_key, [])
            
        return shifts, db_record, sync_status, None

    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, None, "ERROR", str(e)


def generate_ics_from_shifts(shifts, employee_name):
    """Helper to convert JSON shifts back into a downloadable .ics file"""
    cal = Calendar()
    cal.add('prodid', '-//Dream Tea Schedule Portal//jakozeng.ca//')
    cal.add('version', '2.0')
    edmonton_tz = pytz.timezone('America/Edmonton')

    for shift in shifts:
        event = Event()
        event.add('summary', shift['summary'])
        event.add('description', shift['description'])
        start_dt = edmonton_tz.localize(datetime.strptime(shift['start']['dateTime'], "%Y-%m-%dT%H:%M:%S"))
        end_dt = edmonton_tz.localize(datetime.strptime(shift['end']['dateTime'], "%Y-%m-%dT%H:%M:%S"))
        event.add('dtstart', start_dt)
        event.add('dtend', end_dt)
        event.add('dtstamp', datetime.now(timezone.utc))
        cal.add_component(event)

    return cal.to_ical()


def get_token_from_header():
    """Extracts the Bearer token from the incoming request headers."""
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header.split(' ')[1]
    return None


@app.route('/api/status', methods=['GET'])
def status_check():
    return jsonify({"status": "online", "service": "Dream Tea Nexus API", "version": "4.0-Crowdsourced"})


@app.route('/api/schedule', methods=['GET'])
def get_schedule_json():
    """JSON ENDPOINT: Used by the React Dashboard to display the schedule visually."""
    employee_name = request.args.get('name')
    force_sync = request.args.get('force_sync', 'false').lower() == 'true'
    access_token = get_token_from_header()
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    shifts, metadata, sync_status, error = get_schedule_data(employee_name, force_sync, access_token)
    
    if error and not shifts:
        return jsonify({"error": error, "sync_status": sync_status}), 500
        
    return jsonify({
        "employee": employee_name,
        "shifts": shifts,
        "sync_status": sync_status,
        "metadata": {
            "email_timestamp": metadata.get('email_timestamp') if metadata else None,
            "last_synced_at": metadata.get('last_synced_at') if metadata else None,
            "year": metadata.get('year') if metadata else None,
            "month": metadata.get('month') if metadata else None,
            "period": metadata.get('period') if metadata else None
        }
    })


@app.route('/api/download-schedule', methods=['GET'])
def download_schedule():
    """ICS ENDPOINT: Still works identically, routing through the cache."""
    employee_name = request.args.get('name')
    force_sync = request.args.get('force_sync', 'false').lower() == 'true'
    access_token = get_token_from_header()
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    shifts, metadata, sync_status, error = get_schedule_data(employee_name, force_sync, access_token)

    if error and not shifts:
        return jsonify({"error": error}), 500
    if not shifts or len(shifts) == 0:
        return jsonify({"error": f"No shifts found for {employee_name}."}), 404

    ics_data = generate_ics_from_shifts(shifts, employee_name)
    
    return Response(
        ics_data,
        mimetype='text/calendar',
        headers={"Content-Disposition": f"inline; filename=schedule_{employee_name.title()}.ics"}
    )


if __name__ == '__main__':
    app.run(port=5328)