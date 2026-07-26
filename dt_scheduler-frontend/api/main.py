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

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    """Authenticates the user and returns the Gmail API service object."""
    creds = None
    token_json = os.environ.get("GOOGLE_TOKEN")
    
    if token_json:
        creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)
    elif os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
    return build('gmail', 'v1', credentials=creds)

def fetch_latest_schedule_email(service):
    """
    Replaces email_puller.py. Grabs the latest email with an attachment,
    extracts the exact Sent Date metadata, and returns the Excel file stream.
    """
    try:
        # 1. Search for the newest email with an excel attachment
        results = service.users().messages().list(userId='me', q='has:attachment filename:xlsx', maxResults=1).execute()
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

def get_schedule_data(employee_name, force_sync=False):
    """
    Core Logic: Implements the 24-hour TTL Cache and the Timestamp Gatekeeper.
    Returns: (shifts_list, metadata_dict, error_message)
    """
    employee_key = employee_name.strip().lower()
    
    if not supabase:
        return None, None, "Database connection failed."

    try:
        # 1. FETCH LATEST CACHE FROM DATABASE
        response = supabase.table('schedules').select('*').order('year', desc=True).order('month', desc=True).order('period', desc=True).limit(1).execute()
        db_record = response.data[0] if len(response.data) > 0 else None

        current_time = datetime.now(timezone.utc)
        needs_sync = True

        if db_record and db_record.get('last_synced_at'):
            last_synced = datetime.fromisoformat(db_record['last_synced_at'].replace('Z', '+00:00'))
            # If the cache is less than 24 hours old, and the user didn't hit Force Sync, we skip Gmail!
            if not force_sync and (current_time - last_synced) < timedelta(hours=24):
                needs_sync = False
                print(f"CACHE HIT: TTL active. Skipping Gmail for {employee_name}.")

        # 2. THE GATEKEEPER (If cache is stale or user forced a sync)
        if needs_sync:
            print(f"SYNC TRIGGERED (Force: {force_sync}). Checking Gmail...")
            gmail_service = get_gmail_service()
            filename, file_stream, email_date = fetch_latest_schedule_email(gmail_service)
            
            if not file_stream:
                # Fallback to cache if no emails exist
                if db_record:
                    return db_record.get('schedule_data', {}).get(employee_key, []), db_record, None
                return None, None, "No schedule found in email or database."

            db_email_time = None
            if db_record and db_record.get('email_timestamp'):
                db_email_time = datetime.fromisoformat(db_record['email_timestamp'].replace('Z', '+00:00'))

            # COMPARE TIMESTAMPS: Is this email actually newer than our database?
            if db_record and db_email_time and email_date <= db_email_time:
                print("GATEKEEPER: Email is stale (older or same). Ignoring attachment. Resetting TTL clock.")
                # We just update last_synced_at so the 24 hour timer starts over
                supabase.table('schedules').update({
                    "last_synced_at": current_time.isoformat()
                }).eq('id', db_record['id']).execute()
                
                # Fetch fresh record metadata
                db_record['last_synced_at'] = current_time.isoformat()
            else:
                print("GATEKEEPER: Brand new email detected! Parsing Excel and updating database...")
                # 3. NEW SCHEDULE FOUND! Parse everyone's data.
                master_schedule_dict, start_date, end_date = process_full_schedule(file_stream, file_name=filename)
                
                if master_schedule_dict:
                    # Find the first shift to determine the month/period
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

                        # Upsert the new schedule
                        period_check = supabase.table('schedules').select('*').eq('year', year).eq('month', month).eq('period', period).execute()
                        if len(period_check.data) > 0:
                            supabase.table('schedules').update(new_record_data).eq('id', period_check.data[0]['id']).execute()
                        else:
                            supabase.table('schedules').insert(new_record_data).execute()

                        # Update our local db_record so we can return the fresh data
                        db_record = new_record_data

        # 4. RETURN THE DATA
        if not db_record:
             return None, None, "Database is completely empty and no emails found."
             
        if employee_key == "master":
            # If the frontend asks for the MASTER schedule, flatten the dictionary
            # and inject the employee's name into every single shift!
            shifts = []
            for emp, emp_shifts in db_record.get('schedule_data', {}).items():
                for shift in emp_shifts:
                    shift_with_name = shift.copy()
                    shift_with_name['employee'] = emp
                    shifts.append(shift_with_name)
        else:
            # Otherwise, just return the specific user's array
            shifts = db_record.get('schedule_data', {}).get(employee_key, [])
            
        return shifts, db_record, None

    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, None, str(e)


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


@app.route('/api/status', methods=['GET'])
def status_check():
    return jsonify({"status": "online", "service": "Dream Tea Nexus API", "version": "3.0-Cache"})

@app.route('/api/schedule', methods=['GET'])
def get_schedule_json():
    """NEW JSON ENDPOINT: Used by the React Dashboard to display the schedule visually."""
    employee_name = request.args.get('name')
    force_sync = request.args.get('force_sync', 'false').lower() == 'true'
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    shifts, metadata, error = get_schedule_data(employee_name, force_sync)
    
    if error:
        return jsonify({"error": error}), 500
        
    return jsonify({
        "employee": employee_name,
        "shifts": shifts,
        "metadata": {
            "email_timestamp": metadata.get('email_timestamp'),
            "last_synced_at": metadata.get('last_synced_at'),
            "year": metadata.get('year'),
            "month": metadata.get('month'),
            "period": metadata.get('period')
        }
    })

@app.route('/api/download-schedule', methods=['GET'])
def download_schedule():
    """LEGACY ICS ENDPOINT: Still works identically, but now routes through the cache!"""
    employee_name = request.args.get('name')
    force_sync = request.args.get('force_sync', 'false').lower() == 'true'
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    shifts, metadata, error = get_schedule_data(employee_name, force_sync)

    if error:
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