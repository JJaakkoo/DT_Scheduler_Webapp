'''
Pulls emails from my email acocunt
Jako Zeng
August 14, 2025
'''
import base64
import time
import io

def FDprocess(gmail_service, search_query='from:dreamteahousejacky@gmail.com subject:"Schedule" has:attachment'):
    '''
    Pulls emails from the Gmail account using the Gmail API.
    returns the filename of the latest attachment if found, otherwise None.
    '''

    # look for email matching the search query
    tries = 10
    while tries > 0:
        try:
            results = gmail_service.users().threads().list(userId="me", q=search_query).execute()
            break
        except TimeoutError as e:
            print(f"Connection attempt failed ({11-tries}/10): {e}")
            tries -= 1
            if tries > 0:
                time.sleep(3)
                print("Trying again...")
            else:
                print("All 10 attempts failed. Please check your internet connection")
                return None, None
    
    threads = results.get("threads", [])

    # did we find any emails?
    if not threads:
        return None, None
    
    latest_thread_id = threads[0]["id"]

    # get the full thread
    thread = gmail_service.users().threads().get(userId="me", id=latest_thread_id).execute()

    # get the latest attachment
    for message in reversed(thread["messages"]):
        attachment_part = None
        filename = None

        # look for the filename
        for part in message["payload"]["parts"]:
            filename = part.get("filename")

            if filename and filename.endswith('.xlsx'):
                attachment_part = part
                attachment_id = attachment_part["body"]["attachmentId"]
                data = gmail_service.users().messages().attachments().get(userId='me', messageId=message['id'], id=attachment_id).execute()['data']
                
                # decode and load file into memory buffer
                file_data = base64.urlsafe_b64decode(data.encode('UTF-8'))
                file_stream = io.BytesIO(file_data)

                return filename, file_stream
            
    return None, None
