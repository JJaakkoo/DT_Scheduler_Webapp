import os
import sys
import json
from flask import Flask, jsonify, request, Response
from icalendar import Calendar, Event
from datetime import datetime
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

# Import your existing custom functions
from email_puller import FDprocess
from schedule_processor import process_schedule_file

# Load local environment variables (ignored in Vercel production)
load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Create the Supabase client if the keys exist
if SUPABASE_URL and SUPABASE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("WARNING: Supabase credentials are missing!")
    supabase = None


# --- Google Authentication Setup ---
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    """Authenticates the user and returns the Gmail API service object."""
    creds = None
    # We load directly from environment in production, or fallback to file locally
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

def generate_ics_from_shifts(shifts, employee_name):
    cal = Calendar()
    cal.add('prodid', '-//Dream Tea Schedule Portal//jakozeng.ca//')
    cal.add('version', '2.0')
    
    edmonton_tz = pytz.timezone('America/Edmonton')

    for shift in shifts:
        event = Event()
        event.add('summary', shift['summary'])
        event.add('description', shift['description'])
        
        # Parse the string format your parser outputs: "2025-08-16T12:00:00"
        start_dt = datetime.strptime(shift['start']['dateTime'], "%Y-%m-%dT%H:%M:%S")
        end_dt = datetime.strptime(shift['end']['dateTime'], "%Y-%m-%dT%H:%M:%S")
        
        # Localize to Edmonton timezone
        start_dt = edmonton_tz.localize(start_dt)
        end_dt = edmonton_tz.localize(end_dt)
        
        event.add('dtstart', start_dt)
        event.add('dtend', end_dt)
        event.add('dtstamp', datetime.now(pytz.utc))
        
        cal.add_component(event)

    return cal.to_ical()


# --- API Endpoints ---
@app.route('/api/status', methods=['GET'])
def status_check():
    return jsonify({"status": "online", "service": "Dream Tea Nexus API"})

@app.route('/api/download-schedule', methods=['GET'])
def download_schedule():
    """The main schedule generator route with Supabase Caching"""
    employee_name = request.args.get('name')
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    # Standardize the name to lowercase for the database key
    employee_key = employee_name.strip().lower()

    try:
        cached_shifts = None
        db_record = None

        # 1. ATTEMPT TO FETCH FROM SUPABASE CACHE
        if supabase:
            # Get the single most recent schedule period in the database
            response = supabase.table('schedules').select('*').order('year', desc=True).order('month', desc=True).order('period', desc=True).limit(1).execute()
            
            if len(response.data) > 0:
                db_record = response.data[0]
                schedule_data = db_record.get('schedule_data', {})
                
                # Check if this specific employee has already been parsed and saved
                if employee_key in schedule_data:
                    cached_shifts = schedule_data[employee_key]
                    print(f"CACHE HIT: Found {employee_name} in Supabase!")

        # 2. IF CACHE MISS: FALLBACK TO GMAIL
        if cached_shifts:
            shifts = cached_shifts
        else:
            print(f"CACHE MISS: Pulling from Gmail for {employee_name}...")
            
            gmail_service = get_gmail_service()
            filename, file_stream = FDprocess(gmail_service) 
            
            if not file_stream:
                 return jsonify({"error": "Could not find a recent schedule in email"}), 404
                 
            # Parse the Excel file in memory
            shifts, start_date, end_date = process_schedule_file(file_stream, file_name=filename, name=employee_name)
            
            # Error checking for no shifts
            if isinstance(shifts, str) or len(shifts) == 0:
                return jsonify({"error": f"No shifts found for {employee_name}."}), 404

            # 3. UPSERT INTO SUPABASE FOR THE NEXT USER
            if supabase:
                # Figure out the exact year/month/period based on their first shift
                first_shift_dt = datetime.strptime(shifts[0]['start']['dateTime'], "%Y-%m-%dT%H:%M:%S")
                year = first_shift_dt.year
                month = first_shift_dt.month
                period = 1 if first_shift_dt.day <= 15 else 2

                # Check if this period exists yet
                period_check = supabase.table('schedules').select('*').eq('year', year).eq('month', month).eq('period', period).execute()

                if len(period_check.data) > 0:
                    # Update existing period with this new employee's data
                    existing_record = period_check.data[0]
                    existing_data = existing_record.get('schedule_data', {})
                    existing_data[employee_key] = shifts # Add their shifts to the JSON
                    
                    supabase.table('schedules').update({
                        "schedule_data": existing_data
                    }).eq('id', existing_record['id']).execute()
                else:
                    # Create a brand new period record
                    new_data = {employee_key: shifts}
                    supabase.table('schedules').insert({
                        "year": year,
                        "month": month,
                        "period": period,
                        "email_timestamp": datetime.now(pytz.utc).isoformat(),
                        "schedule_data": new_data
                    }).execute()


        # Generate the iCalendar file using either cached or fresh shifts
        ics_data = generate_ics_from_shifts(shifts, employee_name)
        
        # Return it as a downloadable file (Inline for Apple Calendar)
        return Response(
            ics_data,
            mimetype='text/calendar',
            headers={
                "Content-Disposition": f"inline; filename=schedule_{employee_name.title()}.ics"
            }
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5328)