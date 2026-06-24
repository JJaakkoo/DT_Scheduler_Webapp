'''
Processes the excel schedule file and returns a list of shifts in a format
Jako Zeng
August 19, 2025
'''

import pandas as pd
from datetime import datetime

def shift_sync_instructions(given_shifts, existing_shifts):
    sync_instructions = []
    for day in range(given_shifts["start_date"], given_shifts["end_date"]+1):
        day = str(day)
        if len(day) == 1:
            day = "0" + day
        #print(f"{day}: given   : {given_shifts[day]}\n{day}: existing: {existing_shifts[day]}")
        if given_shifts[day] == None and existing_shifts[day] != None:
            #print(f"Delete shift on {day}: {existing_shifts[day]}")
            sync_instructions.append({
                "instruction": "delete",
                "event": existing_shifts[day],
                "event_id": existing_shifts[day].split(" ")[-1][1:-1]
            })
        elif given_shifts[day] != None and existing_shifts[day] == None:
            print(f"Add shift on {day}: {given_shifts[day]}")
            sync_instructions.append({
                "instruction": "add",
                "event": {
                        "summary": f"{given_shifts[day].split(': ')[-1]}",
                        "description": f"Dream Tea Shift. This was added automatically by my schedule script.",
                        "start": {
                            "dateTime": given_shifts[day].split(" ")[0],
                            "timeZone": "America/Edmonton"
                        },
                        "end": {
                            "dateTime": given_shifts[day].split(" ")[2][:-1],
                            "timeZone": "America/Edmonton"
                        },
                        "colorId": "11"
                    }
            })
        elif given_shifts[day] != None and existing_shifts[day] != None:
            if given_shifts[day] not in existing_shifts[day]:
                print(f"Update shift on {day}: from {existing_shifts[day]} to {given_shifts[day]}")
                sync_instructions.append({
                    "instruction": "delete",
                    "event": existing_shifts[day],
                    "event_id": existing_shifts[day].split(" ")[-1][1:-1]
                })
                sync_instructions.append({
                    "instruction": "add",
                    "event": {
                            "summary": f"{given_shifts[day].split(': ')[-1]}",
                            "description": f"Dream Tea Shift. This was added automatically by my schedule script.",
                            "start": {
                                "dateTime": given_shifts[day].split(" ")[0],
                                "timeZone": "America/Edmonton"
                            },
                            "end": {
                                "dateTime": given_shifts[day].split(" ")[2][:-1],
                                "timeZone": "America/Edmonton"
                            },
                            "colorId": "11"
                            }
                })
            else:
                print(f"No change needed for shift on day: {day}")
                
        else:
            
            print(f"No shift on day: {day}")
        
    print("\nSync instructions created: ")
    if len(sync_instructions) == 0:
        print("No changes needed, calendar is already up to date!")
    else:
        for instruction in sync_instructions:
            print(instruction)
    return sync_instructions

def map_shifts (start, end, shifts):
    mapped_shifts = {
        "start_date": start,
        "end_date": end
    }
    for i in range(start,end+1):
        if len(str(i)) == 1:
            mapped_shifts["0"+str(i)] = None
        else:
            mapped_shifts[str(i)] = None
    for shift in shifts:
        mapped_shifts[str(shift.split(" ")[0].split("T")[0].split("-")[-1])] = shift
        
    return mapped_shifts

def get_lower_bound_period(lower_bound, upper_bound):
    try:
        if type(lower_bound) != int:
            lower_bound = int(lower_bound.split(":")[0])
        if type(upper_bound) != int:
            upper_bound = int(upper_bound.split(":")[0])
        lower_bound, upper_bound = int(lower_bound), int(upper_bound)
        if 9 <= lower_bound < 12:
            return "am"
        else:
            return "pm"

    except ValueError:
        print("int conversion error")
        return "pm"
    
def process_month_day(date_str=str):
    '''
    takes string containing month and day and returns a string in the format "day month"
    '''
    date_str = date_str.split(" ")
    try:
        int(date_str[0])
        return f"{date_str[0]} {date_str[1][:3]}"
    except ValueError:
        return f"{date_str[1]} {date_str[0][:3]}"


def process_time_cell(cell):
    #print(f"Processing cell: {cell}")
    # clean up the cell and splits it into start and end times
    cell = str(cell).strip()
    cell_times = cell.split("-")

    # get the location
    for i, cell_time in enumerate(cell_times):
        holder = 0
        location_holder = []
        for j,char in enumerate(cell_time):
            if type(char) == str and char.isalpha():
                location_holder.append(char)
        if location_holder != []:
            location = "".join(location_holder)
            holder = len(location)
        cell_times[i] = cell_times[i][holder:]

    #print(f"location: {location}, cell_times: {cell_times}")
    return location, cell_times

def process_schedule_file(file_path,name="jako"):

    print(f"Processing schedule file for {name}...")

    name = str(name).lower().strip()
    locations = {
        "H": "Heritage Square",
        "S": "Whyte Avenue",
        "N": "North Location",
        "DT": "Downtown"
        }
    year = str(file_path).split(" ")[5]

    try:

        shifts = []
        format_code = "%I:%M%p %d %b"
        added_shifts = False

        df = pd.read_excel(file_path)
        #print("Excel File read successfully")

        # Finds the coloumn my name is in
        my_col = None
        for i,cell in enumerate(df.iloc[0]):
            try:
                if cell.lower().strip() == name:
                    #print(f"Found {name} in column {i}: {cell.lower().strip()}")
                    my_col = i
                    break
            except AttributeError:
                continue
        if my_col is None:
            return f"Could not find {name} in the schedule"

        # Finds the range of cells that contains shifts
        start_row, end_row = None, None
        for i, cell in enumerate(df.iloc[:,0]):
            if start_row is None and type(cell) == str:
                start_row = i
            elif start_row is not None and type(cell) != str:
                end_row = i-1
                break

        # processes the individual shifts and puts it into a list
        

        for i, cell in enumerate(df.iloc[:,my_col]):
            #print(df.iloc[i,0], i)

            if "-" in str(cell).lower():

                location, time_bounds = process_time_cell(cell)
                #print(f"time_bounds: {time_bounds}")
                if ":" not in time_bounds[0]:
                    #print(f"adding :00 to {time_bounds[0]}")
                    time_bounds[0] = time_bounds[0]+":00"
                if ":" not in time_bounds[1]:
                    #print(f"adding :00 to {time_bounds[1]}")
                    time_bounds[1] = time_bounds[1]+":00"
                try:
                    
                    start_time = f"{datetime.strptime(
                                start := f"{time_bounds[0]}{get_lower_bound_period(time_bounds[0],time_bounds[1])} {process_month_day(df.iloc[i,0])} {year}", 
                                f"{format_code} %Y"
                                )}"
                    end_time = f"{datetime.strptime(
                                end := f"{time_bounds[1]}pm {process_month_day(df.iloc[i,0])} {year}", 
                                f"{format_code} %Y"
                                )}"
                    
                    start_time = start_time.replace(" ", "T")
                    end_time = end_time.replace(" ", "T")

                    shifts.append({
                        "summary": f"Work at {locations[location]}",
                        "description": f"Dream Tea Shift. This was added automatically by my schedule script.",
                        "start": {
                            "dateTime": start_time,
                            "timeZone": "America/Edmonton"
                        },
                        "end": {
                            "dateTime": end_time,
                            "timeZone": "America/Edmonton"
                        },
                        "colorId": "11"
                    })
                    added_shifts = True
                    print(f"{start} to {end}")
                    print(f"{df.iloc[i,0]} {time_bounds[0]}{get_lower_bound_period(time_bounds[0],time_bounds[1])}-{time_bounds[1]}pm ({locations[location]})")
                except KeyError as oops:
                    print(f"KeyError occurred: {oops}")
                    continue
        if not added_shifts:  
            #print("No shifts found in the schedule for the given name")
            return shifts, "", ""
        
        # Range of the given schedule
        #print(f"\n{df.iloc[1,0]} {df.iloc[i-1,0]}")

        return shifts, f"{process_month_day(df.iloc[start_row,0])} {year}", f"{process_month_day(df.iloc[end_row,0])} {year}"
    
    except FileNotFoundError:
        print(f"couldnt find the file: {file_path}")
    except Exception as e:
        print(f"An error occured: {e}")

if __name__ == "__main__":
    test_string = "Bobby, Kim, Hyo, Kristen, Chelsey, Jeremy, Sonja, Reane, Yujung, Tricia, Katrina, Jason, Jako, Nick, Alina, Sophia.H, Katelyn, Michael, Jessie, Emily, Phoebe, Terence, Amy, Ervin, Holly, Jacky, Rocky, Gian, Thomas, Sherry, Natalie, Rachel, Cathy".split(", ")
    file_name = "Dream Tea Schedule Aug 16-31 2025 Final for all locationstest.xlsx"
    if False:
        for test_name in test_string:
            process_schedule_file(file_name, name=test_name)
            print("\n")
    else:
        process_schedule_file(file_name, name="jako")  
