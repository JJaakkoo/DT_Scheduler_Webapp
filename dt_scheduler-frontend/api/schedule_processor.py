import pandas as pd
from datetime import datetime

# --- Helper Functions ---
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
        print("DEBUG [Helper]: int conversion error in get_lower_bound_period")
        return "pm"
    
def process_month_day(date_str=str):
    date_str = date_str.split(" ")
    try:
        int(date_str[0])
        return f"{date_str[0]} {date_str[1][:3]}"
    except ValueError:
        return f"{date_str[1]} {date_str[0][:3]}"

def process_time_cell(cell):
    cell = str(cell).strip()
    cell_times = cell.split("-")

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

    return location, cell_times


# --- Main Processing Function ---
def process_schedule_file(file_stream, file_name, name="jako"):
    print("\n" + "="*50)
    print(f"DEBUG: Starting schedule processing for: '{name}'")
    print(f"DEBUG: Filename received from email: '{file_name}'")

    name = str(name).lower().strip()
    locations = {
        "H": "Heritage Square",
        "S": "Whyte Avenue",
        "N": "North Location",
        "DT": "Downtown"
        }
    
    # 1. Safely extract the year
    try:
        year = str(file_name).split(" ")[5]
        print(f"DEBUG: Extracted year from filename: '{year}'")
    except IndexError:
        year = str(datetime.now().year)
        print(f"DEBUG: Filename split failed. Defaulting year to: '{year}'")

    try:
        shifts = []
        format_code = "%I:%M%p %d %b"
        added_shifts = False

        # 2. Read the excel data directly from the memory stream
        print("DEBUG: Loading Excel file into pandas dataframe...")
        df = pd.read_excel(file_stream)
        print(f"DEBUG: Excel file loaded successfully. Grid size: {df.shape}")

        # 3. Find the column the target name is in
        my_col = None
        for i, cell in enumerate(df.iloc[0]):
            try:
                if str(cell).lower().strip() == name:
                    my_col = i
                    print(f"DEBUG: Success! Found '{name}' at column index: {i}")
                    break
            except AttributeError:
                continue
                
        if my_col is None:
            print(f"DEBUG: ERROR. Could not find column for '{name}'.")
            return f"Could not find {name} in the schedule", "", ""

        # 4. Find the range of cells that contains dates
        start_row, end_row = None, None
        for i, cell in enumerate(df.iloc[:,0]):
            if start_row is None and type(cell) == str:
                start_row = i
            elif start_row is not None and type(cell) != str:
                end_row = i-1
                break
                
        print(f"DEBUG: Schedule date rows detected from row {start_row} to {end_row}")

        # 5. Process the individual shifts
        print(f"DEBUG: Scanning column {my_col} for shifts containing a hyphen...")
        for i, cell in enumerate(df.iloc[:,my_col]):
            
            if "-" in str(cell).lower():
                print(f"\nDEBUG: --- Analyzing cell at row {i} ---")
                print(f"DEBUG: Raw cell data: '{cell}'")
                print(f"DEBUG: Corresponding date column data: '{df.iloc[i,0]}'")
                
                location, time_bounds = process_time_cell(cell)
                print(f"DEBUG: Parsed Location Code: '{location}' | Time Bounds: {time_bounds}")
                
                if ":" not in time_bounds[0]:
                    time_bounds[0] = time_bounds[0]+":00"
                if ":" not in time_bounds[1]:
                    time_bounds[1] = time_bounds[1]+":00"
                    
                try:
                    raw_start_string = f"{time_bounds[0]}{get_lower_bound_period(time_bounds[0],time_bounds[1])} {process_month_day(df.iloc[i,0])} {year}"
                    raw_end_string = f"{time_bounds[1]}pm {process_month_day(df.iloc[i,0])} {year}"
                    
                    print(f"DEBUG: Attempting to convert string to datetime: '{raw_start_string}'")
                    
                    start_time = f"{datetime.strptime(raw_start_string, f'{format_code} %Y')}"
                    end_time = f"{datetime.strptime(raw_end_string, f'{format_code} %Y')}"
                    
                    start_time = start_time.replace(" ", "T")
                    end_time = end_time.replace(" ", "T")

                    shifts.append({
                        "summary": f"Work at {locations.get(location, 'Unknown Location')}",
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
                    print(f"DEBUG: Shift successfully added! ({start_time} to {end_time})")
                    
                except Exception as oops:
                    # Broadened from KeyError to Exception to catch ValueError during datetime conversion
                    print(f"DEBUG: [CRITICAL ERROR] Failed to parse shift on row {i}!")
                    print(f"DEBUG: Error details: {oops}")
                    continue
                    
        if not added_shifts:  
            print("DEBUG: Loop finished. Zero shifts were successfully parsed.")
            return [], "", ""
        
        print(f"\nDEBUG: Processing complete. Total shifts found: {len(shifts)}")
        print("="*50 + "\n")
        return shifts, f"{process_month_day(df.iloc[start_row,0])} {year}", f"{process_month_day(df.iloc[end_row,0])} {year}"
    
    except Exception as e:
        print(f"DEBUG: [FATAL ERROR] An unexpected error crashed the main processor: {e}")
        return [], "", ""