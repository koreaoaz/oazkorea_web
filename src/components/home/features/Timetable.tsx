import React from "react";

const hours = Array.from({ length: 14 }, (_, i) => i + 9);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const Timetable = () => {
  return (
    <div className="flex justify-center items-center w-full">
      <div className="rounded-xl bg-white shadow-md p-6 w-[300px] mx-auto">
        <div className="overflow-auto w-full max-w-full text-sm">
          <div
            className="grid border border-gray-300 text-[12px]"
            style={{
              gridTemplateColumns: "60px repeat(5, 1fr)", 
              gridTemplateRows: "30px repeat(14, 1.5rem)", 
            }}
          >
            
            <div className="bg-white"></div>
            {days.map((day) => (
              <div
                key={day}
                className="text-center font-medium border-l border-b border-gray-300 bg-gray-100 flex items-center justify-center"
              >
                {day}
              </div>
            ))}

          {hours.map((hour) => (
            <React.Fragment key={hour}>
              
              <div className="text-center border-t border-r border-gray-300 bg-gray-50 flex items-center justify-center">
                {hour}:00
              </div>

              
              {days.map((day) => (
                <div
                  key={`${day}-${hour}`}
                  className="border border-gray-200"
                ></div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>  
  </div>   
  );
};

export default Timetable;
