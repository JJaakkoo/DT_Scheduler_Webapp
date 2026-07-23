import os
import sys
import json
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from dotenv import load_dotenv
from icalendar import Calendar, Event
from datetime import datetime
import pytz

# Google API Imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import your existing custom functions
from email_puller import FDprocess
from schedule_processor import process_schedule_file

# 1. Initialize Flask and enable CORS for the Next.js frontend
app = Flask(__name__)
CORS(app)

# 2. Load the .env.local file automatically for local testing
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, '..', '.env.local')
load_dotenv(env_path)

# --- Google Authentication Setup ---
# If modifying these scopes, delete the token.json variable/file.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service():
    """Authenticates the user and returns the Gmail API service object via Env Variables."""
    creds = None
    
    # Try to load the authorized token from the environment first (Best for Vercel)
    token_env = os.environ.get('GOOGLE_TOKEN')
    if token_env:
        token_info = json.loads(token_env)
        creds = Credentials.from_authorized_user_info(token_info, SCOPES)
    # Fallback to local file if the env variable isn't set yet
    elif os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Load the Client Credentials from the environment instead of a file
            creds_env = os.environ.get('GOOGLE_CREDENTIALS')
            if not creds_env:
                raise ValueError("GOOGLE_CREDENTIALS environment variable is missing.")
            
            client_config = json.loads(creds_env)
            flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Safely try to save the token locally for future runs
        # We use try/except because Vercel is a read-only environment and will block file writing
        try:
            with open('token.json', 'w') as token:
                token.write(creds.to_json())
        except OSError:
            pass # Ignore file write errors in production
            
    return build('gmail', 'v1', credentials=creds)

# --- Helper Functions ---
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
def server_status():
    """Health check route to verify the server is alive"""
    return jsonify({
        "status": "success",
        "message": "Flask is running securely on its own local server!"
    })

@app.route('/api/download-schedule', methods=['GET'])
def download_schedule():
    """The schedule generator route"""
    employee_name = request.args.get('name')
    
    if not employee_name:
        return jsonify({"error": "Name parameter is required"}), 400

    try:
        # Initialize the Gmail service 
        gmail_service = get_gmail_service()
        
        # Fetch the latest schedule from Gmail
        filename, file_stream = FDprocess(gmail_service) 
        
        if not file_stream:
             return jsonify({"error": "Could not find a recent schedule in email"}), 404
             
        # Parse the Excel file in memory
        shifts, start_date, end_date = process_schedule_file(file_stream, file_name=filename, name=employee_name)
        
        if not shifts:
            return jsonify({"message": f"No shifts found for {employee_name}"}), 404

        # Generate the iCalendar file
        ics_data = generate_ics_from_shifts(shifts, employee_name)
        
        # Return it as a downloadable file
        return Response(
            ics_data,
            mimetype='text/calendar',
            headers={
                "Content-Disposition": f"attachment; filename=DreamTea_Schedule_{employee_name}.ics"
            }
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5328)