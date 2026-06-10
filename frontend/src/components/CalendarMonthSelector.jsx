import React from "react";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import chevrondleft from "../assets/dashboard/chevron-left.svg";
import {
  CALENDAR_MONTHS,
  DEFAULT_MIN_YEAR,
  buildYearOptions,
  getDefaultMaxYear,
} from "../utils/calendarNavUtils";
import "./CalendarMonthSelector.css";

function CalendarMonthSelector({
  currentDate,
  onMonthChange,
  onYearChange,
  onPrevious,
  onNext,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = getDefaultMaxYear(),
  className = "",
}) {
  const years = buildYearOptions(minYear, maxYear);

  return (
    <div className={`calendar-month-selector ${className}`.trim()}>
      {onPrevious && (
        <button type="button" className="calendar-nav-btn" onClick={onPrevious} aria-label="Previous month">
          <img src={chevrondleft} alt="" className="calendar-nav-icon" />
        </button>
      )}

      <div className="calendar-month-year-selects">
        <select
          className="calendar-month-select"
          value={currentDate.getMonth()}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          aria-label="Select month"
        >
          {CALENDAR_MONTHS.map((month, index) => (
            <option key={month} value={index}>{month}</option>
          ))}
        </select>

        <select
          className="calendar-year-select"
          value={currentDate.getFullYear()}
          onChange={(e) => onYearChange(Number(e.target.value))}
          aria-label="Select year"
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {onNext && (
        <button type="button" className="calendar-nav-btn" onClick={onNext} aria-label="Next month">
          <img src={chevrondright} alt="" className="calendar-nav-icon" />
        </button>
      )}
    </div>
  );
}

export default CalendarMonthSelector;
