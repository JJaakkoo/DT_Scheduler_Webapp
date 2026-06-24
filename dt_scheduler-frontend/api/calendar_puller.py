'''
Pulls shifts from my calendar
Jako Zeng
August 26, 2025
'''

from datetime import datetime
from googleapiclient.errors import HttpError

def get_existing_events(calendar_service, start_date, end_date):
    '''
    Retrieves all existing events from the calendar within a specified date range.
    returns a list of events.
    '''
    format_code = "%d %b %Y"

    start_date = f"{datetime.strptime(start_date, format_code).isoformat()}Z"
    end_date = f"{datetime.strptime(end_date, format_code).isoformat()}Z"

    try:
        events_result = calendar_service.events().list(
            calendarId="primary",
            timeMin=start_date,
            timeMax=end_date,
            singleEvents=True,
            orderBy="startTime"
        ).execute()

        events = events_result.get('items', [])

        if not events:
            return []

        return events

    except HttpError as e:
        print(f"An error occurred: {e}")
        return []
    
def find_existing_shifts(events,query="work"):
    '''
    Finds existing shifts in the list of events.
    returns a list of existing shifts.
    '''
    existing_shifts = []

    for event in events:
        if query in event.get("summary", "").lower():
            start = "-".join(event["start"]["dateTime"].split("-")[:-1])
            end = "-".join(event["end"]["dateTime"].split("-")[:-1])
            existing_shifts.append(f"{start} to {end}: {event.get('summary', 'No Title')} ({event["id"]})")

    return existing_shifts
