'use strict';

const { Router } = require('express');
const axios = require('axios');

const { asyncHandler, ValidationError, validate } = require('../../../utils/validation');
const { sendSuccessResponse, sendErrorResponse } = require('../../../config/apikeyConfig');

const router = Router();

const HOLIDAY_EVENTS = [
  { date: "01-01", event: "Tahun Baru" },
  { date: "02-14", event: "Hari Valentine" },
  { date: "03-08", event: "Hari Wanita Internasional" },
  { date: "05-01", event: "Hari Buruh Sedunia" },
  { date: "06-01", event: "Lahir Pancasila" },
  { date: "08-17", event: "Hari Kemerdekaan RI" },
  { date: "12-25", event: "Hari Natal" },
];

function getTodayDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function getDayDifference(date1, date2) {
  const [month1, day1] = date1.split("-").map(Number);
  const [month2, day2] = date2.split("-").map(Number);

  const currentYear = new Date().getFullYear();
  const d1 = new Date(currentYear, month1 - 1, day1);
  let d2 = new Date(currentYear, month2 - 1, day2);

  if (d2 < d1) {
    d2 = new Date(currentYear + 1, month2 - 1, day2);
  }

  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function isHoliday(event) {
  const holidayKeywords = [
    "libur",
    "natal",
    "nyepi",
    "waisak",
    "idul",
    "imlek",
    "tahun baru",
    "cuti bersama",
  ];

  const eventLower = event.toLowerCase();
  return holidayKeywords.some((keyword) => eventLower.includes(keyword));
}

function isNationalDay(event) {
  const nationalKeywords = [
    "nasional",
    "indonesia",
    "kemerdekaan",
    "pancasila",
    "pahlawan",
  ];

  const eventLower = event.toLowerCase();
  return nationalKeywords.some((keyword) => eventLower.includes(keyword));
}

async function scrapeAndCombineEvents() {
  try {
    const allEvents = [];
    const holidays = [];
    const nationalDays = [];

    HOLIDAY_EVENTS.forEach((event) => {
      allEvents.push(event);

      if (isHoliday(event.event)) {
        holidays.push(event);
      }

      if (isNationalDay(event.event)) {
        nationalDays.push(event);
      }
    });

    const today = getTodayDate();

    function sortEventsByDate(events) {
      return events.sort((a, b) => {
        const [aMonth, aDay] = a.date.split("-").map(Number);
        const [bMonth, bDay] = b.date.split("-").map(Number);
        return aMonth === bMonth ? aDay - bDay : aMonth - bMonth;
      });
    }

    function getUpcomingEvents(events, count = 5) {
      return events
        .map((event) => ({
          ...event,
          daysUntil: getDayDifference(today, event.date),
        }))
        .filter((event) => event.daysUntil >= 0)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, count);
    }

    const sortedAllEvents = sortEventsByDate(allEvents);
    const sortedHolidays = sortEventsByDate(holidays);
    const sortedNationalDays = sortEventsByDate(nationalDays);

    const responseData = {
      hari_ini: {
        tanggal: today,
        events: sortedAllEvents.filter((event) => event.date === today),
      },
      mendatang: {
        event_nasional: getUpcomingEvents(sortedNationalDays),
        hari_libur: getUpcomingEvents(sortedHolidays),
      },
      data: {
        hari_libur: sortedHolidays,
        hari_nasional: sortedNationalDays,
        semua_event: sortedAllEvents,
      },
      statistik: {
        total_event: sortedAllEvents.length,
        total_hari_libur: sortedHolidays.length,
        total_hari_nasional: sortedNationalDays.length,
      },
    };

    return responseData;
  } catch (error) {
    throw new ValidationError(
      error.message || "Failed to retrieve holiday data",
      500
    );
  }
}

router.get("/api/info/event-Indonesia", asyncHandler(async (req, res) => {
  const result = await scrapeAndCombineEvents();

  sendSuccessResponse(res, result);
}));

router.post("/api/info/event-Indonesia", asyncHandler(async (req, res) => {
  const result = await scrapeAndCombineEvents();

  sendSuccessResponse(res, result);
}));

router.metadata = {
  name: "Indonesian Holidays & Events",
  path: "/api/info/event-Indonesia",
  methods: ['GET', 'POST'],
  category: "INFO",
  description: "Get information about Indonesian national holidays, special days, and important events. Returns today's events, upcoming events, and complete calendar of holidays and national days.",
  params: [
  ],
};

module.exports = router;