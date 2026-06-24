'''
Adds shifts to Google Calendar from a list of shifts in a format
Jako Zeng
August 14, 2025'''

from googleapiclient.errors import HttpError   

def add_events_to_calendar(calendar_service, events):
    '''
    Adds a list of events to the Google Calendar.
    returns the number of failed events.
    '''
    failed_events = 0

    for event in events:
        try:
            event = calendar_service.events().insert(
                calendarId='primary', 
                body=event
            ).execute()

        except HttpError as error:
            print(f"Failed to add shift: {error}")
            failed_events += 1

    return failed_events

def delete_events_from_calendar(calendar_service, events):
    '''
    Deletes a list of events from the Google Calendar.
    returns the number of failed deletions.
    '''
    failed_events = 0

    for event in events:
        event_id = event.get("event_id")
        try:
            calendar_service.events().delete(
                calendarId='primary',
                eventId=event_id
            ).execute()

        except HttpError as error:
            print(f"Failed to delete event: {error}")
            failed_events += 1

    return failed_events