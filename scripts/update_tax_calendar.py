############################################################
#
# SCRIPT 3 - BUILDING ALL IRS / CRA TAX RULES
#
# DYNAMIC TAX DEADLINE + DISASTER ENGINE
# Option A+B: Historical lookup table + live IRS fetch
# BATCH MODE: Runs all 12 month-end FYEs for a given year
#
############################################################

import re
import io
import sys
import calendar
import requests
from datetime import datetime, date, timedelta
from urllib.parse import urljoin
import sys
import os
import psycopg2
from dotenv import load_dotenv

try:
    from dateutil.easter import easter
except ImportError:
    easter = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


# ============================================================
# USER INPUT
# ============================================================

# YEAR_INPUT = 2026

# Dynamic year — from command line, environment variable, or current year
if len(sys.argv) > 1:
    # Passed as command line argument: python script.py 2025
    YEAR_INPUT = int(sys.argv[1])
elif os.environ.get("TAX_YEAR"):
    # Passed as environment variable: TAX_YEAR=2025
    YEAR_INPUT = int(os.environ.get("TAX_YEAR"))
else:
    # Default to current year
    YEAR_INPUT = datetime.now().year

print(f"DEBUG: TAX_YEAR env = {os.environ.get('TAX_YEAR')}")
print(f"DEBUG: YEAR_INPUT = {YEAR_INPUT}")


# ============================================================
# IRS / CRA URLS
# ============================================================

IRS_PRIOR_BASE = "https://www.irs.gov/pub/irs-prior/"

IRS_DISASTER_MAIN = (
    "https://www.irs.gov/newsroom/"
    "tax-relief-in-disaster-situations"
)

CRA_FORMS_URL = (
    "https://www.canada.ca/en/revenue-agency/"
    "services/forms-publications.html"
)

MONTH_MAP = {
    "january": 1,  "february": 2,  "march": 3,
    "april": 4,    "may": 5,       "june": 6,
    "july": 7,     "august": 8,    "september": 9,
    "october": 10, "november": 11, "december": 12
}

MONTH_PATTERN = (
    r"(January|February|March|April|May|June|"
    r"July|August|September|October|November|December)"
    r"\s+(\d{1,2}),?\s+(\d{4})"
)


# ============================================================
# KNOWN US STATES AND TERRITORIES
# Used to reliably extract state name from IRS pages
# ============================================================

US_STATES = {
    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
    "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina",
    "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
    "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
    # Territories
    "Puerto Rico", "Virgin Islands", "Guam",
    "Northern Mariana Islands", "American Samoa",
    # Other
    "District of Columbia", "All States"
}


# ============================================================
# HISTORICAL DISASTER LOOKUP TABLE — OPTION A
# ============================================================

HISTORICAL_DISASTERS = [

    # 2017 — Hurricane Harvey (Texas)
    {
        "name":         "Hurricane Harvey",
        "location":     "Texas",
        "counties":     None,
        "window_start": date(2017,  8, 23),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-harvey-in-texas"
    },

    # 2017 — Tropical Storm Harvey (Louisiana)
    {
        "name":         "Tropical Storm Harvey",
        "location":     "Louisiana",
        "counties":     None,
        "window_start": date(2017,  8, 26),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-harvey-in-texas"
    },

    # 2017 — Hurricane Irma (Florida)
    {
        "name":         "Hurricane Irma",
        "location":     "Florida",
        "counties":     None,
        "window_start": date(2017,  9,  4),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-irma-in-florida"
    },

    # 2017 — Hurricane Irma (Georgia)
    {
        "name":         "Hurricane Irma",
        "location":     "Georgia",
        "counties":     None,
        "window_start": date(2017,  9,  7),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-irma-in-georgia"
    },

    # 2017 — Hurricane Irma (Puerto Rico)
    {
        "name":         "Hurricane Irma",
        "location":     "Puerto Rico",
        "counties":     None,
        "window_start": date(2017,  9,  5),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-irma-in-puerto-rico"
    },

    # 2017 — Hurricane Irma (Virgin Islands)
    {
        "name":         "Hurricane Irma",
        "location":     "Virgin Islands",
        "counties":     None,
        "window_start": date(2017,  9,  5),
        "window_end":   date(2018,  1, 31),
        "extended_to":  date(2018,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-irma"
    },

    # 2017 — Hurricane Maria (Puerto Rico)
    {
        "name":         "Hurricane Maria",
        "location":     "Puerto Rico",
        "counties":     None,
        "window_start": date(2017,  9, 17),
        "window_end":   date(2018,  6, 29),
        "extended_to":  date(2018,  6, 29),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-maria-in-puerto-rico"
    },

    # 2017 — Hurricane Maria (Virgin Islands)
    {
        "name":         "Hurricane Maria",
        "location":     "Virgin Islands",
        "counties":     None,
        "window_start": date(2017,  9, 17),
        "window_end":   date(2018,  6, 29),
        "extended_to":  date(2018,  6, 29),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-maria"
    },

    # 2017 — California Wildfires
    {
        "name":         "California Wildfires",
        "location":     "California",
        "counties":     None,
        "window_start": date(2017, 10,  8),
        "window_end":   date(2018,  4, 30),
        "extended_to":  date(2018,  4, 30),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-california-wildfires"
    },

    # 2018 — Hurricane Michael (Florida)
    {
        "name":         "Hurricane Michael",
        "location":     "Florida",
        "counties":     None,
        "window_start": date(2018, 10,  7),
        "window_end":   date(2019,  2, 28),
        "extended_to":  date(2019,  2, 28),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-michael-in-florida"
    },

    # 2018 — Hurricane Florence (North Carolina)
    {
        "name":         "Hurricane Florence",
        "location":     "North Carolina",
        "counties":     None,
        "window_start": date(2018,  9,  7),
        "window_end":   date(2019,  3, 15),
        "extended_to":  date(2019,  3, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-florence-in-north-carolina"
    },

    # 2018 — Hurricane Florence (South Carolina)
    {
        "name":         "Hurricane Florence",
        "location":     "South Carolina",
        "counties":     None,
        "window_start": date(2018,  9,  8),
        "window_end":   date(2019,  3, 15),
        "extended_to":  date(2019,  3, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-florence-in-south-carolina"
    },

    # 2019 — Tropical Storm Imelda (Texas)
    {
        "name":         "Tropical Storm Imelda",
        "location":     "Texas",
        "counties":     None,
        "window_start": date(2019,  9, 17),
        "window_end":   date(2020,  1, 31),
        "extended_to":  date(2020,  1, 31),
        "source_url":   "https://www.irs.gov/newsroom/irs-extends-oct-15-and-other-upcoming-deadlines-provides-other-tax-relief-for-victims-of-tropical-storm-imelda"
    },

    # 2020 — COVID-19 nationwide
    {
        "name":         "COVID-19 Pandemic",
        "location":     "All States",
        "counties":     None,
        "window_start": date(2020,  4,  1),
        "window_end":   date(2020,  7, 15),
        "extended_to":  date(2020,  7, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-day-now-july-15-treasury-irs-extend-filing-deadline-and-federal-tax-payments-regardless-of-amount-owed"
    },

    # 2021 — Hurricane Ida (Louisiana)
    {
        "name":         "Hurricane Ida",
        "location":     "Louisiana",
        "counties":     None,
        "window_start": date(2021,  8, 26),
        "window_end":   date(2022,  2, 15),
        "extended_to":  date(2022,  2, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ida-in-louisiana"
    },

    # 2021 — Hurricane Ida (New York)
    {
        "name":         "Hurricane Ida",
        "location":     "New York",
        "counties":     None,
        "window_start": date(2021,  9,  1),
        "window_end":   date(2022,  1,  3),
        "extended_to":  date(2022,  1,  3),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ida-in-new-york"
    },

    # 2021 — Hurricane Ida (New Jersey)
    {
        "name":         "Hurricane Ida",
        "location":     "New Jersey",
        "counties":     None,
        "window_start": date(2021,  9,  1),
        "window_end":   date(2022,  1,  3),
        "extended_to":  date(2022,  1,  3),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ida-in-new-jersey"
    },

    # 2021 — Hurricane Ida (Pennsylvania)
    {
        "name":         "Hurricane Ida",
        "location":     "Pennsylvania",
        "counties":     None,
        "window_start": date(2021,  9,  1),
        "window_end":   date(2022,  1,  3),
        "extended_to":  date(2022,  1,  3),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ida-in-pennsylvania"
    },

    # 2022 — Hurricane Ian (Florida)
    {
        "name":         "Hurricane Ian",
        "location":     "Florida",
        "counties":     None,
        "window_start": date(2022,  9, 23),
        "window_end":   date(2023,  2, 15),
        "extended_to":  date(2023,  2, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ian-in-florida"
    },

    # 2022 — Hurricane Ian (North Carolina)
    {
        "name":         "Hurricane Ian",
        "location":     "North Carolina",
        "counties":     None,
        "window_start": date(2022,  9, 28),
        "window_end":   date(2023,  2, 15),
        "extended_to":  date(2023,  2, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-ian-in-north-carolina"
    },

    # 2023 — Hawaii Wildfires
    {
        "name":         "Hawaii Wildfires",
        "location":     "Hawaii",
        "counties":     None,
        "window_start": date(2023,  8,  8),
        "window_end":   date(2024,  8,  7),
        "extended_to":  date(2024,  8,  7),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-wildfires-in-hawaii"
    },

    # 2024 — Hurricane Helene (North Carolina)
    {
        "name":         "Hurricane Helene",
        "location":     "North Carolina",
        "counties":     None,
        "window_start": date(2024,  9, 25),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Helene (South Carolina)
    {
        "name":         "Hurricane Helene",
        "location":     "South Carolina",
        "counties":     None,
        "window_start": date(2024,  9, 25),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Helene (Georgia)
    {
        "name":         "Hurricane Helene",
        "location":     "Georgia",
        "counties":     None,
        "window_start": date(2024,  9, 24),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Helene (Florida)
    {
        "name":         "Hurricane Helene",
        "location":     "Florida",
        "counties":     None,
        "window_start": date(2024,  9, 23),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Helene (Tennessee)
    {
        "name":         "Hurricane Helene",
        "location":     "Tennessee",
        "counties":     None,
        "window_start": date(2024,  9, 26),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Helene (Virginia)
    {
        "name":         "Hurricane Helene",
        "location":     "Virginia",
        "counties":     None,
        "window_start": date(2024,  9, 25),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-helene"
    },

    # 2024 — Hurricane Milton (Florida)
    {
        "name":         "Hurricane Milton",
        "location":     "Florida",
        "counties":     None,
        "window_start": date(2024, 10,  5),
        "window_end":   date(2025,  5,  1),
        "extended_to":  date(2025,  5,  1),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-hurricane-milton-in-florida"
    },

    # 2025 — California Wildfires
    {
        "name":         "California Wildfires 2025",
        "location":     "California",
        "counties":     None,
        "window_start": date(2025,  1,  7),
        "window_end":   date(2025, 10, 15),
        "extended_to":  date(2025, 10, 15),
        "source_url":   "https://www.irs.gov/newsroom/tax-relief-for-victims-of-wildfires-in-california"
    },
]


# ============================================================
# LIVE DISASTER CACHE — fetched once per script run
# ============================================================

_LIVE_DISASTERS_CACHE = None


# ============================================================
# CRA / IRS CALCULATION RULES
# ============================================================

CRA_RULES = {
    "T1":      "Apr 30 of following year (Jun 15 if self-employed)",
    "T2":      "6 months after FYE",
    "T3":      "90 days after FYE",
    "T4/T5":   "March 2 of following year",
    "T3010":   "6 months after FYE",
    "GST/HST": "3 months after FYE",
}

IRS_RULES = {
    "1040":     "Apr 15 of following year (Oct 15 extended)",
    "1120S":    "15th day of 3rd month after FYE (6 months extended)",
    "1065":     "15th day of 3rd month after FYE (6 months extended)",
    "1120":     "15th day of 4th month after FYE (6 months extended). June 30 FYE: 3rd month, 7 month extension",
    "990":      "15th day of 5th month after FYE (6 months extended)",
    "1041":     "15th day of 4th month after FYE (5.5 months extended)",
    "1120F":    "15th day of 4th month after FYE (6 months extended)",
    "941":      "Q1 Apr 30 / Q2 Jul 31 / Q3 Oct 31 / Q4 Jan 31",
    "W-2/1099": "Jan 31 of following year",
}


# ============================================================
# HTTP SESSION
# ============================================================

SESSION = requests.Session()

SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 "
        "(Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 "
        "(KHTML, like Gecko) "
        "Chrome/151.0 Safari/537.36"
    )
})


# ============================================================
# FORM CONFIGURATION
# ============================================================

TAX_FORMS = [

    {"Country": "US",     "Form": "1040",     "EntityType": "Individual"},
    {"Country": "US",     "Form": "1040",     "EntityType": "Self-employed"},
    {"Country": "US",     "Form": "1120S",    "EntityType": "S-Corporation"},
    {"Country": "US",     "Form": "1065",     "EntityType": "Partnership"},
    {"Country": "US",     "Form": "1120",     "EntityType": "C-Corporation"},
    {"Country": "US",     "Form": "990",      "EntityType": "Non-profit"},
    {"Country": "US",     "Form": "1041",     "EntityType": "Trust/Estate"},
    {"Country": "US",     "Form": "W-2/1099", "EntityType": "Employers"},
    {"Country": "US",     "Form": "941",      "EntityType": "Payroll quarterly"},
    {"Country": "US",     "Form": "1120F",    "EntityType": "Foreign-Corporation"},
    {"Country": "Canada", "Form": "T1",       "EntityType": "Individual"},
    {"Country": "Canada", "Form": "T1",       "EntityType": "Self-employed"},
    {"Country": "Canada", "Form": "T2",       "EntityType": "Corporation"},
    {"Country": "Canada", "Form": "T3",       "EntityType": "Trust"},
    {"Country": "Canada", "Form": "T4/T5",    "EntityType": "Employers"},
    {"Country": "Canada", "Form": "T3010",    "EntityType": "Registered charity"},
    {"Country": "Canada", "Form": "GST/HST",  "EntityType": "Annual filer"},
]


# ============================================================
# HOLIDAY HELPERS
# ============================================================

def _nth_weekday(year, month, weekday, n):
    first  = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    return first + timedelta(days=offset + 7 * (n - 1))


def _last_weekday(year, month, weekday):
    if month == 12:
        last = date(year, 12, 31)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    offset = (last.weekday() - weekday) % 7
    return last - timedelta(days=offset)


def _monday_before(year, month, day):
    d = date(year, month, day)
    while d.weekday() != 0:
        d -= timedelta(days=1)
    return d


def _shift_observed(holidays):
    shifted = set()
    for d in holidays:
        if d.weekday() == 5:
            shifted.add(d - timedelta(days=1))
        elif d.weekday() == 6:
            shifted.add(d + timedelta(days=1))
        else:
            shifted.add(d)
    return shifted


def get_us_federal_holidays(year):
    h = set()
    h.add(date(year, 1,  1))
    h.add(date(year, 4, 16))
    h.add(date(year, 6, 19))
    h.add(date(year, 7,  4))
    h.add(date(year, 11, 11))
    h.add(date(year, 12, 25))
    h.add(_nth_weekday(year, 1,  0, 3))
    h.add(_nth_weekday(year, 2,  0, 3))
    h.add(_last_weekday(year, 5, 0))
    h.add(_nth_weekday(year, 9,  0, 1))
    h.add(_nth_weekday(year, 10, 0, 2))
    h.add(_nth_weekday(year, 11, 3, 4))
    return _shift_observed(h)


def get_ca_federal_holidays(year):
    h = set()
    h.add(date(year, 1,  1))
    h.add(date(year, 6, 24))
    h.add(date(year, 7,  1))
    h.add(date(year, 9, 30))
    h.add(date(year, 11, 11))
    h.add(date(year, 12, 25))
    h.add(date(year, 12, 26))
    if easter is not None:
        e = easter(year)
        h.add(e - timedelta(days=2))
        h.add(e + timedelta(days=1))
    h.add(_monday_before(year, 5, 25))
    h.add(_nth_weekday(year, 8,  0, 1))
    h.add(_nth_weekday(year, 9,  0, 1))
    h.add(_nth_weekday(year, 10, 0, 2))
    return _shift_observed(h)


# ============================================================
# DATE HELPERS
# ============================================================

def parse_fye(value):
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%m/%d/%Y").date()


def next_business_day(d, jurisdiction="US"):

    def get_holidays(yr):
        if jurisdiction.upper() == "US":
            return (
                get_us_federal_holidays(yr) |
                get_us_federal_holidays(yr + 1)
            )
        else:
            return (
                get_ca_federal_holidays(yr) |
                get_ca_federal_holidays(yr + 1)
            )

    holidays = get_holidays(d.year)

    while d.weekday() >= 5 or d in holidays:
        d += timedelta(days=1)
        holidays = get_holidays(d.year)

    return d


def month_end(year, month):
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


def add_months(d, months):
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, month_end(year, month).day)
    return date(year, month, day)


# ============================================================
# DEADLINE CALCULATION (fallback only)
# ============================================================

def calculate_original_deadline(form, entity_type, fye):

    if form == "1040":
        return next_business_day(
            date(fye.year + 1, 4, 15), "US")

    if form == "1120S":
        return next_business_day(
            add_months(fye, 3).replace(day=15), "US")

    if form == "1065":
        return next_business_day(
            add_months(fye, 3).replace(day=15), "US")

    if form == "1120":
        if fye.month == 6:
            deadline = add_months(fye, 3).replace(day=15)
        else:
            deadline = add_months(fye, 4).replace(day=15)
        return next_business_day(deadline, "US")

    if form == "1041":
        return next_business_day(
            add_months(fye, 4).replace(day=15), "US")

    if form == "990":
        return next_business_day(
            add_months(fye, 5).replace(day=15), "US")

    if form == "1120F":
        return next_business_day(
            add_months(fye, 4).replace(day=15), "US")

    if form == "W-2/1099":
        return next_business_day(
            date(fye.year + 1, 1, 31), "US")

    if form == "T1":
        deadline = date(fye.year + 1, 4, 30)
        if entity_type == "Self-employed":
            deadline = date(fye.year + 1, 6, 15)
        return next_business_day(deadline, "CA")

    if form == "T2":
        return next_business_day(add_months(fye, 6), "CA")

    if form == "T3":
        return next_business_day(
            fye + timedelta(days=90), "CA")

    if form == "T3010":
        return next_business_day(add_months(fye, 6), "CA")

    if form == "GST/HST":
        return next_business_day(add_months(fye, 3), "CA")

    if form == "T4/T5":
        return next_business_day(
            date(fye.year + 1, 3, 2), "CA")

    return None


# ============================================================
# EXTENSION CALCULATION (fallback only)
# ============================================================

def calculate_extension_deadline(form, entity_type, original_deadline):

    if original_deadline is None:
        return None

    if form == "1040":
        return next_business_day(
            date(original_deadline.year, 10, 15), "US")

    if form in ("1120S", "1065", "990", "1120F"):
        return next_business_day(
            add_months(original_deadline, 6), "US")

    if form == "1120":
        if original_deadline.month == 9:
            return next_business_day(
                add_months(original_deadline, 7), "US")
        else:
            return next_business_day(
                add_months(original_deadline, 6), "US")

    if form == "1041":
        ext = add_months(original_deadline, 5)
        ext = ext + timedelta(days=15)
        return next_business_day(ext, "US")

    return None


# ============================================================
# 941 QUARTERLY DEADLINES
# ============================================================

def calculate_941_deadlines(
    fye, entity_type, source_type, source_url, source_text
):

    rule_year = fye.year

    quarters = [
        ("941 Q1", date(rule_year + 1,  4, 30)),
        ("941 Q2", date(rule_year + 1,  7, 31)),
        ("941 Q3", date(rule_year + 1, 10, 31)),
        ("941 Q4", date(rule_year + 2,  1, 31)),
    ]

    rows = []

    for q_label, q_date in quarters:

        orig             = next_business_day(q_date, "US")
        disaster_matches = find_all_applicable_disasters(orig)

        rows.append({
            "Country":           "US",
            "FormType":          q_label,
            "EntityType":        entity_type,
            "FYE":               fye,
            "TaxYear":           rule_year,
            "OriginalDeadline":  orig,
            "ExtensionDeadline": None,
            "HolidayLocation":   None,
            "HolidayEligible":   "No",
            "DisasterName":      None,
            "DisasterEligible":  "No",
            "DisasterLocation":  None,
            "DisasterCounties":  None,
            "DisasterDeadline":  None,
            "SourceType":        source_type,
            "SourceURL":         source_url,
            "DisasterSourceURL": None,
            "OriginalRule":      source_text
        })

        for d in disaster_matches:
            rows.append({
                "Country":           "US",
                "FormType":          q_label,
                "EntityType":        entity_type,
                "FYE":               fye,
                "TaxYear":           rule_year,
                "OriginalDeadline":  orig,
                "ExtensionDeadline": None,
                "HolidayLocation":   None,
                "HolidayEligible":   "No",
                "DisasterName":      d.get("name"),
                "DisasterEligible":  "Yes",
                "DisasterLocation":  d.get("location"),
                "DisasterCounties":  d.get("counties"),
                "DisasterDeadline":  d["extended_to"],
                "SourceType":        source_type,
                "SourceURL":         source_url,
                "DisasterSourceURL": d["source_url"],
                "OriginalRule":      source_text
            })

    return rows


# ============================================================
# IRS PRIOR-YEAR INSTRUCTIONS URL
# ============================================================

def build_irs_prior_url(form, year):
    if form == "1040":
        return IRS_PRIOR_BASE + f"i1040gi--{year}.pdf"
    normalized = form.lower().replace("-", "").replace("/", "")
    return IRS_PRIOR_BASE + f"i{normalized}--{year}.pdf"


# ============================================================
# IRS PDF DOWNLOAD
# ============================================================

def download_pdf(url):
    try:
        response = SESSION.get(url, timeout=30)
        if response.status_code != 200:
            return None
        if not response.content.startswith(b"%PDF"):
            return None
        return response.content
    except Exception:
        return None


# ============================================================
# READ IRS PDF
# ============================================================

def read_pdf_text(pdf_bytes):
    if pdf_bytes is None:
        return None
    if PdfReader is None:
        return None
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages  = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n".join(pages)
    except Exception:
        return None


# ============================================================
# FIND IRS INSTRUCTIONS
# ============================================================

def find_irs_form(form, rule_year):
    url = build_irs_prior_url(form, rule_year)
    pdf = download_pdf(url)
    if pdf is None:
        return {"Found": False, "URL": url, "Text": None}
    text = read_pdf_text(pdf)
    return {"Found": True, "URL": url, "Text": text}


# ============================================================
# EXTRACT HOLIDAY INFO
# ============================================================

def extract_holiday_info(section):

    all_states_match = re.search(
        r"even if you do not live in",
        section, re.IGNORECASE
    )

    if all_states_match:
        return {
            "HolidayLocation": "All States",
            "HolidayEligible": "Yes"
        }

    specific_match = re.search(
        r"holiday in\s+(?:the\s+)?"
        r"([A-Za-z][A-Za-z ,]+?)(?:\s+is|\s+observed|\s+and|\.|,)",
        section, re.IGNORECASE
    )

    if specific_match:
        return {
            "HolidayLocation": specific_match.group(1).strip(),
            "HolidayEligible": "Yes"
        }

    return {
        "HolidayLocation": None,
        "HolidayEligible": "No"
    }


# ============================================================
# EXTRACT DEADLINES FROM IRS PDF
# ============================================================

def extract_deadlines_from_pdf(text):

    if not text:
        return {
            "OriginalDeadline":  None,
            "ExtensionDeadline": None,
            "HolidayLocation":   None,
            "HolidayEligible":   "No"
        }

    original         = None
    extension        = None
    holiday_location = None
    holiday_eligible = "No"

    when_match = re.search(
        r"(?:When To File|Due date of return)",
        text, re.IGNORECASE
    )

    if when_match:

        section = text[
            when_match.start():
            when_match.start() + 2000
        ]

        deadline_patterns = [
            r"file\s+Form\s+\w+\s+by\s+" + MONTH_PATTERN,
            r"due date is\s+" + MONTH_PATTERN,
            r"must file.*?by\s+" + MONTH_PATTERN,
            r"file.*?by\s+" + MONTH_PATTERN,
            r"due\s+on\s+" + MONTH_PATTERN,
        ]

        for pattern in deadline_patterns:
            m = re.search(
                pattern, section, re.IGNORECASE | re.DOTALL
            )
            if m:
                try:
                    month    = MONTH_MAP[m.group(1).lower()]
                    day      = int(m.group(2))
                    year     = int(m.group(3))
                    original = date(year, month, day)
                    break
                except Exception:
                    pass

        if original:
            holiday_info     = extract_holiday_info(section)
            holiday_location = holiday_info["HolidayLocation"]
            holiday_eligible = holiday_info["HolidayEligible"]

    ext_match = re.search(
        r"Extension of Time To File",
        text, re.IGNORECASE
    )

    if ext_match:

        section = text[
            ext_match.start():
            ext_match.start() + 1000
        ]

        ext_patterns = [
            r"due date is\s+" + MONTH_PATTERN,
            r"extended.*?to\s+" + MONTH_PATTERN,
            r"until\s+" + MONTH_PATTERN,
            r"due\s+" + MONTH_PATTERN,
        ]

        for pattern in ext_patterns:
            m = re.search(
                pattern, section, re.IGNORECASE | re.DOTALL
            )
            if m:
                try:
                    month     = MONTH_MAP[m.group(1).lower()]
                    day       = int(m.group(2))
                    year      = int(m.group(3))
                    extension = date(year, month, day)
                    break
                except Exception:
                    pass

    return {
        "OriginalDeadline":  original,
        "ExtensionDeadline": extension,
        "HolidayLocation":   holiday_location,
        "HolidayEligible":   holiday_eligible
    }


# ============================================================
# DISASTER LOOKUP — OPTION A (historical table)
# ============================================================

def lookup_historical_disasters(original_deadline):
    matches = []
    for disaster in HISTORICAL_DISASTERS:
        if (
            disaster["window_start"]
            <= original_deadline
            <= disaster["window_end"]
        ):
            entry = dict(disaster)
            matches.append(entry)
    return matches


# ============================================================
# DISASTER LOOKUP — OPTION B (live IRS page)
# ============================================================

def get_irs_disaster_page():
    try:
        response = SESSION.get(IRS_DISASTER_MAIN, timeout=30)
        if response.status_code != 200:
            return None
        return response.text
    except Exception:
        return None


def extract_disaster_links(html):
    if not html:
        return []
    links   = []
    pattern = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)
    for match in pattern.finditer(html):
        href     = match.group(1)
        full_url = urljoin(IRS_DISASTER_MAIN, href)
        if (
            "irs.gov" in full_url
            and "/newsroom/" in full_url
            and "archive" not in full_url.lower()
            and "around-the-nation" not in full_url.lower()
            and "news-release-archive" not in full_url.lower()
        ):
            if full_url not in links:
                links.append(full_url)
    return links


def extract_dates_from_text(text):
    dates   = []
    if not text:
        return dates
    pattern = re.compile(
        r"\b(January|February|March|April|May|June|"
        r"July|August|September|October|November|December)"
        r"\s+(\d{1,2}),\s+(\d{4})",
        re.IGNORECASE
    )
    for match in pattern.finditer(text):
        try:
            d = datetime.strptime(match.group(0), "%B %d, %Y").date()
            dates.append(d)
        except Exception:
            pass
    return sorted(set(dates))


def extract_disaster_deadline(text):
    if not text:
        return None
    patterns = [
        r"until\s+(January|February|March|April|May|June|July|"
        r"August|September|October|November|December)"
        r"\s+(\d{1,2}),\s+(\d{4})",
        r"postponed\s+until\s+(January|February|March|April|May|June|July|"
        r"August|September|October|November|December)"
        r"\s+(\d{1,2}),\s+(\d{4})",
        r"deadline.*?(January|February|March|April|May|June|July|"
        r"August|September|October|November|December)"
        r"\s+(\d{1,2}),\s+(\d{4})"
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            try:
                return datetime.strptime(
                    f"{match.group(1)} {match.group(2)} {match.group(3)}",
                    "%B %d %Y"
                ).date()
            except Exception:
                pass
    return None


def clean_html_text(html):
    if not html:
        return ""
    text = re.sub(
        r"<script.*?</script>", " ", html,
        flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(
        r"<style.*?</style>", " ", text,
        flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ============================================================
# EXTRACT DISASTER NAME — cleaned up
# CHANGED: removes leading "A", "The", truncates properly
# ============================================================

def extract_disaster_name(text):
    patterns = [
        r"impacted by\s+([A-Za-z\s]+?)\s+(?:in\s+[A-Z]|that began)",
        r"victims of\s+([A-Za-z\s]+?)\s+in\s+[A-Z]",
        r"affected by\s+([A-Za-z\s,\-]+?)(?:\s+that began|\s+in\s+[A-Z]|\.|,)",
        r"relief for\s+([A-Za-z\s]+?)\s+victims",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            name = re.sub(r'\s+', ' ', name)
            name = re.sub(r',\s*$', '', name).strip()

            # Remove leading "A ", "An ", "The "
            name = re.sub(
                r'^(A|An|The)\s+',
                '', name, flags=re.IGNORECASE
            ).strip()

            # Truncate at conjunctions to avoid
            # overly long names
            name = re.sub(
                r'\s+(And|That|Which|Between|Occurring).*$',
                '', name, flags=re.IGNORECASE
            ).strip()

            # Skip if too short or too long
            if len(name) < 3 or len(name) > 80:
                continue

            # Skip generic single words
            if name.lower() in (
                "the", "a", "an", "this", "these",
                "those", "natural", "disaster"
            ):
                continue

            return name.title()

    return None


# ============================================================
# EXTRACT COUNTY LIST — from live IRS page
# ============================================================

def extract_county_list(text):
    """
    Extracts the list of affected areas from IRS disaster notices.
    Handles all US area types: counties, boroughs, parishes,
    municipalities, census areas, attendance areas, districts etc.
    Returns a comma-separated string or None if entire state affected.
    """

    # Check if entire state is affected — return None
    all_areas_match = re.search(
        r"all\s+\d+\s+\w+|"
        r"all\s+(?:counties|boroughs|parishes|municipalities|areas)|"
        r"statewide|entire\s+state|whole\s+state|all\s+areas",
        text, re.IGNORECASE
    )
    if all_areas_match:
        return None

    # All possible US area terminology
    area_term = (
        r"(?:counties|county|boroughs|borough|parishes|parish|"
        r"municipalities|municipality|census\s+areas|census\s+area|"
        r"regional\s+educational\s+attendance\s+areas|"
        r"regional\s+educational\s+attendance\s+area|"
        r"attendance\s+areas|attendance\s+area|"
        r"districts|district|regions|region|"
        r"divisions|division|areas|area|"
        r"independent\s+cities|independent\s+city|"
        r"municipios|municipio|"
        r"commonwealths|commonwealth)"
    )

    # Pattern 1: "following counties/boroughs/parishes: X, Y, Z"
    match = re.search(
        r"following\s+" + area_term + r"\s*[:\-]\s*"
        r"([A-Za-z][A-Za-z\s,\.'\-/]+?)(?:\.|;|\n\n|$)",
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    # Pattern 2: "reside or have a business in X, Y, and Z counties"
    match = re.search(
        r"(?:reside|live|located|businesses?)\s+(?:or\s+have\s+a\s+business\s+)?in\s+"
        r"([A-Za-z][A-Za-z\s,\.'\-/]+?)\s+" + area_term,
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    # Pattern 3: "in X, Y, and Z counties qualify/are eligible"
    match = re.search(
        r"\bin\s+([A-Za-z][A-Za-z\s,\.'\-/]+?)\s+" + area_term +
        r"\s+(?:qualify|are\s+eligible|will\s+receive)",
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    # Pattern 4: "X, Y, and Z counties in [state]"
    match = re.search(
        r"([A-Za-z][A-Za-z\s,\.'\-/]+?)\s+" + area_term +
        r"\s+(?:in|of)\s+[A-Za-z\s]+",
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    # Pattern 5: "taxpayers in X, Y, Z counties"
    match = re.search(
        r"taxpayers\s+in\s+([A-Za-z][A-Za-z\s,\.'\-/]+?)\s+" + area_term,
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    # Pattern 6: comma-separated list ending with area term
    match = re.search(
        r"([A-Za-z][A-Za-z\s]*"
        r"(?:,\s*(?:and\s+)?[A-Za-z][A-Za-z\s]*){2,})\s+" + area_term,
        text, re.IGNORECASE
    )
    if match:
        result = _clean_area_list(match.group(1))
        if result:
            return result

    return None


def _clean_area_list(text):
    """
    Cleans and normalizes a list of area names.
    Returns cleaned string or None if invalid.
    """
    if not text:
        return None

    # Remove leading/trailing whitespace and punctuation
    text = text.strip(' ,.\n\r\t')

    # Normalize "and" separators to commas
    text = re.sub(r',?\s+and\s+', ', ', text)

    # Normalize multiple spaces
    text = re.sub(r'\s+', ' ', text)

    # Remove any trailing "and"
    text = re.sub(r',?\s+and\s*$', '', text)

    # Skip if too short (not a real list)
    if len(text) < 3:
        return None

    # Skip if too long (probably grabbed wrong text)
    if len(text) > 2000:
        return None

    # Skip if it looks like a full sentence (too many words)
    word_count = len(text.split())
    if word_count > 100:
        return None

    return text

# ============================================================
# EXTRACT DISASTER STATE — using known US state list
# CHANGED: matches against US_STATES for reliable extraction
# ============================================================

def extract_disaster_state(text):
    """
    Extracts the US state name from IRS disaster notice
    by matching against the known US_STATES list.
    Much more reliable than regex alone.
    """

    # Try to find a known state name in the text
    # Search in order of longest name first to avoid
    # partial matches (e.g. "New York" before "New")
    sorted_states = sorted(
        US_STATES,
        key=len,
        reverse=True
    )

    # Look for state in key IRS phrases first
    key_phrases = [
        r"taxpayers in\s+(?:parts of\s+|all of\s+)?({state})",
        r"reside or have a business in\s+(?:the\s+)?(?:State of\s+)?({state})",
        r"victims in\s+(?:parts of\s+)?({state})",
        r"businesses in\s+({state})",
        r"relief for.*?in\s+({state})",
        r"in\s+the\s+State of\s+({state})",
        r"affected by.*?in\s+({state})",
    ]

    for state in sorted_states:
        escaped = re.escape(state)
        for phrase in key_phrases:
            pattern = phrase.replace("{state}", escaped)
            if re.search(pattern, text, re.IGNORECASE):
                return state

    # Fallback — look for any state mention near
    # disaster-related words
    for state in sorted_states:
        escaped = re.escape(state)
        pattern = (
            r"(?:disaster|relief|storm|hurricane|flood|"
            r"wildfire|tornado|earthquake).*?" +
            escaped
        )
        if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            return state

    return None


# ============================================================
# EXTRACT DISASTER LOCATION — returns state and counties
# CHANGED: uses extract_disaster_state for reliable state
# ============================================================

def extract_disaster_location(html):
    text = clean_html_text(html)

    # Get state using known state list
    state = extract_disaster_state(text)

    if state is None:
        return None, None

    # Get county list
    counties = extract_county_list(text)

    return state, counties


# ============================================================
# BUILD LIVE DISASTER CACHE — fetched ONCE per script run
# ============================================================

def get_live_disaster_cache():
    global _LIVE_DISASTERS_CACHE

    if _LIVE_DISASTERS_CACHE is not None:
        return _LIVE_DISASTERS_CACHE

    _LIVE_DISASTERS_CACHE = []

    html = get_irs_disaster_page()
    if not html:
        return _LIVE_DISASTERS_CACHE

    links = extract_disaster_links(html)

    for url in links:
        try:
            response = SESSION.get(url, timeout=20)
            if response.status_code != 200:
                continue

            text      = response.text
            clean     = clean_html_text(text)

            deadline  = extract_disaster_deadline(clean)
            if deadline is None:
                continue

            state, counties = extract_disaster_location(text)
            if state is None:
                continue

            disaster_name = extract_disaster_name(clean)
            dates         = extract_dates_from_text(clean)

            _LIVE_DISASTERS_CACHE.append({
                "name":        disaster_name or "Current Disaster",
                "location":    state,
                "counties":    counties,
                "extended_to": deadline,
                "dates":       dates,
                "source_url":  url
            })

        except Exception:
            continue

    return _LIVE_DISASTERS_CACHE


def fetch_live_disasters(original_deadline):
    cached  = get_live_disaster_cache()
    matches = []

    for item in cached:
        dates_before = [
            d for d in item["dates"]
            if d <= item["extended_to"]
        ]
        if not dates_before:
            continue
        if min(dates_before) <= original_deadline <= item["extended_to"]:
            matches.append(item)

    return matches


# ============================================================
# COMBINED DISASTER SEARCH — OPTION A + B
# ============================================================

def find_all_applicable_disasters(original_deadline):

    if original_deadline is None:
        return []

    all_matches = []

    historical = lookup_historical_disasters(original_deadline)
    all_matches.extend(historical)

    today         = date.today()
    two_years_ago = date(today.year - 2, today.month, today.day)

    if original_deadline >= two_years_ago:
        live = fetch_live_disasters(original_deadline)
        for item in live:
            already = any(
                m["location"]    == item["location"]
                and m["extended_to"] == item["extended_to"]
                for m in all_matches
            )
            if not already:
                all_matches.append(item)

    return all_matches


# ============================================================
# PROCESS ONE TAX RULE
# ============================================================

def process_tax_rule(form_config, fye):

    country     = form_config["Country"]
    form        = form_config["Form"]
    entity_type = form_config["EntityType"]
    rule_year   = fye.year

    pdf_original     = None
    pdf_extension    = None
    holiday_location = None
    holiday_eligible = "No"
    source_type      = None
    source_url       = None
    source_text      = None

    if country == "US":

        if form not in ["W-2/1099", "941"]:

            source = find_irs_form(form, rule_year)

            if source["Found"]:

                source_type = "HISTORICAL"
                source_url  = source["URL"]
                source_text = source["Text"]

                extracted = extract_deadlines_from_pdf(source_text)

                pdf_original     = extracted["OriginalDeadline"]
                pdf_extension    = extracted["ExtensionDeadline"]
                holiday_location = extracted["HolidayLocation"]
                holiday_eligible = extracted["HolidayEligible"]

            else:

                source_type = "CALCULATED"
                source_url  = (
                    "CALCULATED — IRS PDF not yet published "
                    "for tax year {}. Rule: {}".format(
                        rule_year,
                        IRS_RULES.get(form, "IRS standard rules")
                    )
                )

        elif form == "941":

            source_type = "CALCULATED"
            source_url  = (
                "CALCULATED — IRS standard rule: {}".format(
                    IRS_RULES.get("941", "Q1 Apr 30 / Q2 Jul 31 / Q3 Oct 31 / Q4 Jan 31")
                )
            )

        else:

            source_type = "CALCULATED"
            source_url  = (
                "CALCULATED — IRS standard rule: {}".format(
                    IRS_RULES.get(form, "Jan 31 of following year")
                )
            )

    else:

        source_type = "CALCULATED"
        source_url  = (
            "CALCULATED — CRA rule: {}".format(
                CRA_RULES.get(form, "CRA standard rules")
            )
        )

    if form == "941":
        return calculate_941_deadlines(
            fye, entity_type, source_type, source_url, source_text
        )

    if pdf_original is not None:
        original_deadline = pdf_original
    else:
        original_deadline = calculate_original_deadline(
            form, entity_type, fye
        )

    if pdf_extension is not None:
        extension_deadline = pdf_extension
    else:
        extension_deadline = calculate_extension_deadline(
            form, entity_type, original_deadline
        )

    disaster_matches = []

    if country == "US":
        disaster_matches = find_all_applicable_disasters(
            original_deadline
        )

    results = []

    # Base row — no disaster
    results.append({
        "Country":           country,
        "FormType":          form,
        "EntityType":        entity_type,
        "FYE":               fye,
        "TaxYear":           rule_year,
        "OriginalDeadline":  original_deadline,
        "ExtensionDeadline": extension_deadline,
        "HolidayLocation":   holiday_location,
        "HolidayEligible":   holiday_eligible,
        "DisasterName":      None,
        "DisasterEligible":  "No",
        "DisasterLocation":  None,
        "DisasterCounties":  None,
        "DisasterDeadline":  None,
        "SourceType":        source_type,
        "SourceURL":         source_url,
        "DisasterSourceURL": None,
        "OriginalRule":      source_text
    })

    # One row per disaster
    for d in disaster_matches:
        results.append({
            "Country":           country,
            "FormType":          form,
            "EntityType":        entity_type,
            "FYE":               fye,
            "TaxYear":           rule_year,
            "OriginalDeadline":  original_deadline,
            "ExtensionDeadline": extension_deadline,
            "HolidayLocation":   holiday_location,
            "HolidayEligible":   holiday_eligible,
            "DisasterName":      d.get("name"),
            "DisasterEligible":  "Yes",
            "DisasterLocation":  d.get("location"),
            "DisasterCounties":  d.get("counties"),
            "DisasterDeadline":  d["extended_to"],
            "SourceType":        source_type,
            "SourceURL":         source_url,
            "DisasterSourceURL": d["source_url"],
            "OriginalRule":      source_text
        })

    return results


# ============================================================
# GENERATE ALL 12 MONTH-END FYEs FOR A GIVEN YEAR
# ============================================================

def get_all_fyes(year):
    fyes = []
    for month in range(1, 13):
        last_day = calendar.monthrange(year, month)[1]
        fyes.append(date(year, month, last_day))
    return fyes


# ============================================================
# SCRIPT 3 — BATCH MODE
# ============================================================

def test_script_3():

    all_fyes    = get_all_fyes(YEAR_INPUT)
    all_results = []

    for fye in all_fyes:
        for form_config in TAX_FORMS:
            rows = process_tax_rule(form_config, fye)
            all_results.extend(rows)

    # ========================================================
    # SUMMARY — commented out, restore when needed
    # ========================================================

    # print("\n" + "=" * 60)
    # print("SCRIPT 3 SUMMARY")
    # print("=" * 60)
    # for result in all_results:
    #     disaster_tag = (
    #         f" *** {result['DisasterName']} — "
    #         f"{result['DisasterLocation']}"
    #         if result["DisasterEligible"] == "Yes"
    #         else ""
    #     )
    #     print(
    #         f"{result['Country']:<8} | "
    #         f"{result['FormType']:<8} | "
    #         f"{result['EntityType']:<25} | "
    #         f"FYE: {result['FYE']} | "
    #         f"Orig: {result['OriginalDeadline']} | "
    #         f"Dis: {result['DisasterDeadline']}"
    #         f"{disaster_tag}"
    #     )
    # print(f"\nTOTAL ROWS: {len(all_results)}")

    # ========================================================
    # FULL RESULTS — commented out, restore when needed
    # ========================================================

    # for result in all_results:
    #     print("\n" + "=" * 60)
    #     print(
    #         f"{result['Country']} | "
    #         f"{result['FormType']} | "
    #         f"{result['EntityType']}"
    #     )
    #     print("=" * 60)
    #     print(f"FYE:                {result['FYE']}")
    #     print(f"Tax Year:           {result['TaxYear']}")
    #     print(f"Original Deadline:  {result['OriginalDeadline']}")
    #     print(f"Extension Deadline: {result['ExtensionDeadline']}")
    #     print(f"Holiday Location:   {result['HolidayLocation']}")
    #     print(f"Holiday Eligible:   {result['HolidayEligible']}")
    #     print(f"Disaster Name:      {result['DisasterName']}")
    #     print(f"Disaster Eligible:  {result['DisasterEligible']}")
    #     print(f"Disaster Location:  {result['DisasterLocation']}")
    #     print(f"Disaster Counties:  {result['DisasterCounties']}")
    #     print(f"Disaster Deadline:  {result['DisasterDeadline']}")
    #     print(f"Source Type:        {result['SourceType']}")
    #     print(f"Source URL:         {result['SourceURL']}")
    #     print(f"Disaster Source URL:{result['DisasterSourceURL']}")

    # ========================================================
    # TblTaxCalendar TABLE DISPLAY
    # ========================================================

    headers = [
        "FYE",
        "TaxYear",
        "FormType",
        "EntityType",
        "Jurisdiction",
        "State/Province",
        "HolidayLocation",
        "HolidayEligible",
        "DisasterName",
        "DisasterEligible",
        "DisasterLocation",
        "DisasterCounties",
        "DisasterDeadline",
        "OriginalDeadline",
        "ExtensionDeadline",
        "SourceType",
        "SourceURL",
    ]

    widths = [12, 8, 10, 25, 12, 15, 20, 14, 30, 14, 20, 60, 16, 16, 17, 12, 80]

    header_row = " | ".join(
        str(h).ljust(widths[i])
        for i, h in enumerate(headers)
    )

    separator = "-" * len(header_row)

    print("\n")
    print(f"TblTaxCalendar — Year: {YEAR_INPUT} — All 12 FYEs")
    print(separator)
    print(header_row)
    print(separator)

    for result in all_results:

        row = [
            str(result["FYE"]                or ""),
            str(result["TaxYear"]            or ""),
            str(result["FormType"]           or ""),
            str(result["EntityType"]         or ""),
            str(result["Country"]            or ""),
            str(result.get("State/Province", "") or ""),
            str(result["HolidayLocation"]    or ""),
            str(result["HolidayEligible"]    or ""),
            str(result["DisasterName"]       or ""),
            str(result["DisasterEligible"]   or ""),
            str(result["DisasterLocation"]   or ""),
            str(result["DisasterCounties"]   or ""),
            str(result["DisasterDeadline"]   or ""),
            str(result["OriginalDeadline"]   or ""),
            str(result["ExtensionDeadline"]  or ""),
            str(result["SourceType"]         or ""),
            str(result["SourceURL"]          or ""),
        ]

        print(" | ".join(
            val.ljust(widths[i])
            for i, val in enumerate(row)
        ))

    print(separator)
    print(f"YEAR INPUT:  {YEAR_INPUT}")
    print(f"FYEs RUN:    {len(all_fyes)} (Jan 31 through Dec 31)")
    print(f"TOTAL ROWS:  {len(all_results)}")

    return all_results


# ============================================================
# RUN
# ============================================================

result = test_script_3()

# ============================================================
# DATABASE INSERT — Supabase PostgreSQL
# ============================================================

def insert_to_supabase(rows):
    load_dotenv()

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not found")
        return False

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    def to_date(val):
        if val is None:
            return None
        if isinstance(val, date):
            return val.isoformat()
        return str(val)

    try:
        print("\n🔌 Connecting to Supabase via REST API...")
        print("🗑️  Deleting existing TblTaxCalendar rows...")

        delete_response = requests.delete(
            f"{SUPABASE_URL}/rest/v1/TblTaxCalendar",
            headers={**headers, "Prefer": "return=representation"},
            params={"CalendarID": "gte.0"}
        )

        if delete_response.status_code not in [200, 204]:
            print(f"❌ Delete failed: {delete_response.status_code} {delete_response.text}")
            return False

        print("✅ Existing rows deleted")
        print(f"\n📥 Inserting {len(rows)} new rows...")

        inserted  = 0
        errors    = 0
        batch_size = 500

        for i in range(0, len(rows), batch_size):
            batch   = rows[i:i + batch_size]
            payload = []

            for row in batch:
                payload.append({
                    "FYE":               to_date(row.get("FYE")),
                    "TaxYear":           row.get("TaxYear"),
                    "FormType":          row.get("FormType"),
                    "EntityType":        row.get("EntityType"),
                    "Country":           row.get("Country"),
                    "Jurisdiction":      "Federal",
                    "StateProvince":     row.get("State/Province"),
                    "HolidayLocation":   row.get("HolidayLocation"),
                    "HolidayEligible":   row.get("HolidayEligible", "No"),
                    "DisasterName":      row.get("DisasterName"),
                    "DisasterEligible":  row.get("DisasterEligible", "No"),
                    "DisasterLocation":  row.get("DisasterLocation"),
                    "DisasterCounties":  row.get("DisasterCounties"),
                    "DisasterDeadline":  to_date(row.get("DisasterDeadline")),
                    "OriginalDeadline":  to_date(row.get("OriginalDeadline")),
                    "ExtensionDeadline": to_date(row.get("ExtensionDeadline")),
                    "SourceType":        row.get("SourceType"),
                    "SourceURL":         row.get("SourceURL"),
                })

            insert_response = requests.post(
                f"{SUPABASE_URL}/rest/v1/TblTaxCalendar",
                headers=headers,
                json=payload
            )

            if insert_response.status_code in [200, 201]:
                inserted += len(batch)
                print(f"   ✅ Batch {i//batch_size + 1}: {len(batch)} rows inserted")
            else:
                errors += len(batch)
                print(f"   ❌ Batch {i//batch_size + 1} failed: {insert_response.status_code} {insert_response.text[:200]}")

        print(f"\n✅ Insert complete:")
        print(f"   Inserted: {inserted} rows")
        print(f"   Errors:   {errors} rows")
        print(f"   Total:    {len(rows)} rows")
        print(f"   Time:     {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True

    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False


if result:
    print(f"\n{'='*60}")
    print(f"STARTING DATABASE INSERT")
    print(f"{'='*60}")
    print(f"Total rows to insert: {len(result)}")
    insert_to_supabase(result)
else:
    print("❌ No results generated — skipping database insert")