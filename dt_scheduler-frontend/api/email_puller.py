'''
Pulls emails from my email acocunt
Jako Zeng
August 14, 2025
'''
import base64
import time

def FDprocess(gmail_service):
    print("Finding Dream Tea Schedule email...")
    search_query = 'from:dreamteahousejacky@gmail.com subject:"Schedule" has:attachment'

    # look for email matching the search query
    print(f"Search query: {search_query}")
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
                return None
    
    threads = results.get("threads", [])

    # did we find any emaisl?
    if not threads:
        print("No threads found")
        return None
    
    latest_thread_id = threads[0]["id"]
    print(f"Found a thread!! ID: {latest_thread_id}")

    # get the full thread
    thread = gmail_service.users().threads().get(userId="me", id=latest_thread_id).execute()

    # get the latest attachemtn
    for message in reversed(thread["messages"]):
        attachment_part = None
        filename = None

        # look for the filename
        for part in message["payload"]["parts"]:
            filename = part.get("filename")

            if filename and filename.endswith('.xlsx'):
                attachment_part = part
                print(f"Found an attachment: {filename}")
                attachment_id = attachment_part["body"]["attachmentId"]
                data = gmail_service.users().messages().attachments().get(userId='me', messageId=message['id'], id=attachment_id).execute()['data']
                
                # decode and save file
                file_data = base64.urlsafe_b64decode(data.encode('UTF-8'))
                with open(filename, "wb") as f:
                    f.write(file_data)

                print(f"Attachement saved")
                return filename
            
    print("Couldn't find an excel attachment :(")
    return None
