(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const ui = {
    cityPicker: byId("open-cities"),
    cityLabel: byId("city-label"),
    localDate: byId("local-date"),
    localClock: byId("local-clock"),
    nextName: byId("next-name"),
    nextMeta: byId("next-meta"),
    hours: byId("count-hours"),
    minutes: byId("count-minutes"),
    seconds: byId("count-seconds"),
    daily: byId("daily-panel"),
    dailyButton: byId("show-daily"),
    dailyHeading: byId("daily-heading"),
    dailyDate: byId("daily-date"),
    dailyTimes: byId("daily-times"),
    resetDay: byId("reset-day"),
    monthly: byId("monthly-panel"),
    monthlyButton: byId("show-monthly"),
    monthLabel: byId("month-label"),
    monthlyTimes: byId("monthly-times"),
    resetMonth: byId("reset-month"),
    cityDialog: byId("city-dialog"),
    citySearch: byId("city-search"),
    cityList: byId("city-list"),
    noCities: byId("no-cities"),
  };

  const cities = window.salatCities;
  const schedule = window.salatSchedule;

  function showError(error) {
    console.error(error);
    byId("calculation-error").hidden = false;
    byId("next-panel").hidden = true;
    ui.daily.hidden = true;
    ui.monthly.hidden = true;
    ui.dailyButton.disabled = true;
    ui.monthlyButton.disabled = true;
    ui.cityPicker.disabled = true;
  }

  if (!cities || !schedule || !window.adhan) {
    showError(new Error("Data atau pustaka jadwal salat tidak tersedia."));
    return;
  }

  const storageKey = "waktu-salat-city";
  const defaultCity = "Jakarta";
  const { dateInZone, addDays, monthStart, timeInZone, fullDate, monthName, shortDate, prayerTimes } = schedule;
  const cache = new Map();
  const storedCityName = loadCity();
  let city = cities.find((item) => item.name === storedCityName) || cities.find((item) => item.name === defaultCity);
  let today;
  let selectedDay;
  let selectedMonth;
  let nextPrayer;
  let nextDay;
  let view = "daily";

  function loadCity() {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function storeCity() {
    try {
      localStorage.setItem(storageKey, city.name);
    } catch {
      // The current selection still works when storage is unavailable.
    }
  }

  function node(tag, className, label) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (label) element.textContent = label;
    return element;
  }

  function icon(name) {
    const element = node("i", "icon ph-" + name);
    element.setAttribute("aria-hidden", "true");
    return element;
  }

  function isoDay(date) {
    return date.toISOString().slice(0, 10);
  }

  function sameDay(left, right) {
    return left?.getTime() === right?.getTime();
  }

  function timings(date) {
    const key = date.getTime();
    if (!cache.has(key)) {
      if (cache.size >= 124) cache.clear();
      cache.set(key, prayerTimes(city, date));
    }
    return cache.get(key);
  }

  function renderDay() {
    const current = sameDay(selectedDay, today);
    ui.dailyHeading.textContent = current ? "Jadwal hari ini" : "Jadwal harian";
    ui.dailyDate.hidden = current;
    ui.dailyDate.textContent = current ? "" : fullDate.format(selectedDay);
    ui.resetDay.disabled = current;

    const items = timings(selectedDay).map((prayer) => {
      const upcoming = sameDay(selectedDay, nextDay) && prayer.key === nextPrayer.key;
      const card = node("li", "prayer-card");
      card.dataset.next = String(upcoming);
      const top = node("div", "prayer-card-top");
      const symbol = node("span", "prayer-icon");
      symbol.append(icon(prayer.icon));
      top.append(symbol);
      if (upcoming) top.append(node("span", "prayer-badge caption-3", "Berikutnya"));
      const time = node("time", "prayer-time heading-4", prayer.time);
      time.dateTime = prayer.instant.toISOString();
      card.append(top, node("span", "prayer-name body-5", prayer.label), time);
      return card;
    });
    ui.dailyTimes.replaceChildren(...items);
  }

  function renderMonth() {
    const end = monthStart(selectedMonth, 1);
    ui.monthLabel.textContent = monthName.format(selectedMonth) + " · " + city.zone;
    ui.resetMonth.disabled = sameDay(selectedMonth, monthStart(today));
    const rows = [];

    for (let date = selectedMonth; date < end; date = addDays(date, 1)) {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      const dayButton = node("button", "month-date-button", shortDate.format(date));
      dayButton.type = "button";
      dayButton.dataset.date = isoDay(date);
      dayButton.setAttribute("aria-label", fullDate.format(date));
      if (sameDay(date, today)) {
        row.classList.add("current-date");
        dayButton.setAttribute("aria-current", "date");
      }

      heading.append(dayButton);
      row.append(heading);
      for (const prayer of timings(date)) {
        const cell = document.createElement("td");
        const time = node("time", "", prayer.time);
        time.dateTime = prayer.instant.toISOString();
        cell.append(time);
        row.append(cell);
      }
      rows.push(row);
    }

    ui.monthlyTimes.replaceChildren(...rows);
  }

  function setView(value) {
    view = value;
    const daily = view === "daily";
    ui.daily.hidden = !daily;
    ui.monthly.hidden = daily;
    ui.dailyButton.setAttribute("aria-pressed", String(daily));
    ui.monthlyButton.setAttribute("aria-pressed", String(!daily));
    if (daily) renderDay();
    else renderMonth();
  }

  function tick(now, cityChanged = false) {
    const civilDate = dateInZone(now, city.zone);
    const dateChanged = !sameDay(civilDate, today);
    if (dateChanged) {
      if (!selectedDay || sameDay(selectedDay, today)) selectedDay = civilDate;
      if (!selectedMonth || sameDay(selectedMonth, monthStart(today))) selectedMonth = monthStart(civilDate);
      today = civilDate;
      ui.localDate.textContent = fullDate.format(today);
      ui.localDate.dateTime = isoDay(today);
    }

    const currentClock = timeInZone(now, city.zone) + " " + city.zone;
    if (ui.localClock.textContent !== currentClock) {
      ui.localClock.textContent = currentClock;
      ui.localClock.dateTime = now.toISOString();
    }

    const nextToday = timings(today).find((prayer) => prayer.key !== "sunrise" && prayer.instant > now);
    const upcoming = nextToday || timings(addDays(today, 1)).find((prayer) => prayer.key === "fajr");
    const prayerChanged = !sameDay(nextPrayer?.instant, upcoming.instant);
    nextPrayer = upcoming;
    nextDay = nextToday ? today : addDays(today, 1);

    if (cityChanged || dateChanged || prayerChanged) {
      ui.nextName.textContent = nextPrayer.label;
      ui.nextMeta.textContent = (nextToday ? "Hari ini" : "Besok") + " · " + nextPrayer.time + " " + city.zone;
      if (view === "daily") renderDay();
      else if (cityChanged || dateChanged) renderMonth();
    }

    const seconds = Math.max(0, Math.ceil((nextPrayer.instant - now) / 1000));
    ui.hours.textContent = String(Math.floor(seconds / 3600)).padStart(2, "0");
    ui.minutes.textContent = String(Math.floor(seconds / 60) % 60).padStart(2, "0");
    ui.seconds.textContent = String(seconds % 60).padStart(2, "0");
  }

  function updateCityLabel() {
    ui.cityLabel.textContent = city.name;
    ui.cityPicker.setAttribute("aria-label", "Pilih kota. " + city.name + ", " + city.zone);
  }

  function chooseCity(selection) {
    if (selection !== city) {
      city = selection;
      cache.clear();
      storeCity();
      updateCityLabel();
      tick(new Date(), true);
    }
    ui.cityDialog.close();
  }

  function renderCities() {
    const terms = ui.citySearch.value.toLocaleLowerCase("id").trim().split(/\s+/).filter(Boolean);
    const matches = cities.filter((item) => {
      const text = [item.name, item.province, item.zone, item.aliases].join(" ").toLocaleLowerCase("id");
      return terms.every((term) => text.includes(term));
    });

    const rows = matches.map((item) => {
      const row = document.createElement("li");
      const button = node("button", "city-option");
      button.type = "button";
      button.dataset.city = item.name;
      const title = node("span", "city-option-title");
      title.append(node("span", "title-3", item.name));
      if (item.province !== item.name) title.append(node("span", "caption-4", item.province));
      const zone = node("span", "city-option-zone caption-3", item.zone);
      if (item === city) {
        button.setAttribute("aria-current", "true");
        zone.append(icon("check"));
      }
      button.append(title, zone);
      row.append(button);
      return row;
    });

    ui.cityList.replaceChildren(...rows);
    ui.cityList.scrollTop = 0;
    ui.noCities.hidden = rows.length > 0;
  }

  ui.cityPicker.addEventListener("click", () => {
    ui.citySearch.value = "";
    renderCities();
    ui.cityDialog.showModal();
    ui.citySearch.focus();
  });
  byId("close-cities").addEventListener("click", () => ui.cityDialog.close());
  ui.cityDialog.addEventListener("close", () => ui.cityPicker.focus());
  ui.cityDialog.addEventListener("click", (event) => {
    if (event.target !== ui.cityDialog) return;
    const { left, right, top, bottom } = ui.cityDialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      ui.cityDialog.close();
    }
  });
  ui.citySearch.addEventListener("input", renderCities);
  ui.citySearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && ui.cityList.children.length === 1) {
      event.preventDefault();
      ui.cityList.querySelector("button").click();
    }
  });
  ui.cityList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-city]");
    if (button) chooseCity(cities.find((item) => item.name === button.dataset.city));
  });

  ui.dailyButton.addEventListener("click", () => setView("daily"));
  ui.monthlyButton.addEventListener("click", () => setView("monthly"));
  byId("previous-day").addEventListener("click", () => {
    selectedDay = addDays(selectedDay, -1);
    renderDay();
  });
  byId("next-day").addEventListener("click", () => {
    selectedDay = addDays(selectedDay, 1);
    renderDay();
  });
  ui.resetDay.addEventListener("click", () => {
    selectedDay = today;
    renderDay();
    byId("next-day").focus();
  });
  byId("previous-month").addEventListener("click", () => {
    selectedMonth = monthStart(selectedMonth, -1);
    renderMonth();
  });
  byId("next-month").addEventListener("click", () => {
    selectedMonth = monthStart(selectedMonth, 1);
    renderMonth();
  });
  ui.resetMonth.addEventListener("click", () => {
    selectedMonth = monthStart(today);
    renderMonth();
    byId("next-month").focus();
  });
  ui.monthlyTimes.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-date]");
    if (!button) return;
    selectedDay = new Date(button.dataset.date + "T00:00:00Z");
    setView("daily");
    ui.dailyHeading.tabIndex = -1;
    ui.dailyHeading.focus();
  });

  try {
    updateCityLabel();
    tick(new Date());
    const timer = setInterval(() => {
      try {
        tick(new Date());
      } catch (error) {
        clearInterval(timer);
        showError(error);
      }
    }, 1000);
  } catch (error) {
    showError(error);
  }
})();
