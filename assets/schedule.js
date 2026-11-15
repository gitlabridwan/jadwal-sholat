/* Dates used by the UI are civil dates represented as UTC midnight. */
(() => {
  "use strict";

  const zones = {
    WIB: "Asia/Jakarta",
    WITA: "Asia/Makassar",
    WIT: "Asia/Jayapura",
  };

  const prayers = [
    { key: "fajr", label: "Subuh", icon: "moon-stars" },
    { key: "sunrise", label: "Terbit", icon: "sun-dim" },
    { key: "dhuhr", label: "Zuhur", icon: "sun" },
    { key: "asr", label: "Asar", icon: "cloud-sun" },
    { key: "maghrib", label: "Magrib", icon: "sun-horizon" },
    { key: "isha", label: "Isya", icon: "moon" },
  ];

  const dateByZone = {};
  const timeByZone = {};
  for (const [zone, timeZone] of Object.entries(zones)) {
    dateByZone[zone] = new Intl.DateTimeFormat("en", {
      timeZone, year: "numeric", month: "numeric", day: "numeric",
    });
    timeByZone[zone] = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
  }

  const fullDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const monthName = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC", month: "long", year: "numeric",
  });
  const shortDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  });

  function dateInZone(instant, zone) {
    const fields = {};
    for (const part of dateByZone[zone].formatToParts(instant)) {
      fields[part.type] = Number(part.value);
    }
    return new Date(Date.UTC(fields.year, fields.month - 1, fields.day));
  }

  function addDays(date, days) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
  }

  function monthStart(date, offset = 0) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  }

  function timeInZone(instant, zone) {
    return timeByZone[zone].format(instant);
  }

  function prayerTimes(city, date) {
    const { CalculationMethod, Coordinates, Madhab, PrayerTimes } = window.adhan;
    const parameters = CalculationMethod.Other();
    parameters.fajrAngle = 20;
    parameters.ishaAngle = 18;
    parameters.madhab = Madhab.Shafi;
    parameters.adjustments = { fajr: 2, sunrise: -2, dhuhr: 2, asr: 2, maghrib: 2, isha: 2 };

    // Adhan reads the supplied Date's local calendar fields before returning UTC instants.
    const adhanDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
    const results = new PrayerTimes(new Coordinates(city.latitude, city.longitude), adhanDate, parameters);

    return prayers.map((prayer) => {
      const instant = results[prayer.key];
      return { ...prayer, instant, time: timeInZone(instant, city.zone) };
    });
  }

  window.salatSchedule = { dateInZone, addDays, monthStart, timeInZone, fullDate, monthName, shortDate, prayerTimes };
})();
