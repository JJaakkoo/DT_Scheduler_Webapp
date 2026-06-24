'''
Pulls shifts from my calendar
Jako Zeng
August 26, 2025
'''

from datetime import datetime, timezone
from googleapiclient.errors import HttpError

def get_existing_events(calendar_service, start_date, end_date):
    print("Pulling existing events in calendar...")
    
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
            print("No events found")
            return []
        
        # for printing
        if True:
            print(f"Found {len(events)} events:")
            for event in events:
                start = event["start"].get("dateTime", event["start"].get("date"))
                print(f"{start}: {event.get('summary', 'No Title')}")
            #print("\n")

        #print(start_date)
        #print(end_date)
        return events

    except HttpError as e:
        print(f"An error occurred: {e}")
        return []
    
def find_existing_shifts(events):
    existing_shifts = []
    #print("Pulling existing shifts...")
    for event in events:
        if "work" in event.get("summary", "").lower():
            start = "-".join(event["start"]["dateTime"].split("-")[:-1])
            end = "-".join(event["end"]["dateTime"].split("-")[:-1])
            #start = event["start"].get("dateTime", event["start"].get("dateTime"))
            #end = event["end"].get("dateTime", event["end"].get("dateTime"))
            existing_shifts.append(f"{start} to {end}: {event.get('summary', 'No Title')} ({event["id"]})")
    return existing_shifts
    
if __name__ == "__main__":
    get_existing_events(None, "16 Aug 2025", "31 Aug 2025")