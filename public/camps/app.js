const MONTHS = [4, 5, 6, 7];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_YEAR = 2026;

const state = {
  rows: [],
  stateSummary: [],
  currentState: "",
  flyerManifest: {},
  paths: {
    dataBase: "",
    flyerBase: "",
  },
};

const elements = {
  overview: document.querySelector("#overview"),
  calendarGrid: document.querySelector("#calendar-grid"),
  issuesPanel: document.querySelector("#issues-panel"),
  stateSelect: document.querySelector("#state-select"),
  metricTemplate: document.querySelector("#metric-template"),
};

boot();

async function boot() {
  renderLoading();

  try {
    state.paths = await resolveDataPaths();

    const [masterCsv, summaryCsv] = await Promise.all([
      fetchCsv(`${state.paths.dataBase}/master_events.csv`),
      fetchCsv(`${state.paths.dataBase}/state_summary.csv`),
    ]);
    state.flyerManifest = await fetchOptionalJson("./flyer_manifest.json");

    state.rows = parseCsv(masterCsv).map((row, index) => normalizeRow(row, index));
    state.stateSummary = parseCsv(summaryCsv).map((row) => ({
      school_state: (row.school_state || "").trim(),
      event_count: Number(row.event_count || 0),
      school_count: Number(row.school_count || 0),
    }));
    state.currentState = parseHashState();

    populateStateSelector();
    elements.stateSelect.value = state.currentState;
    elements.stateSelect.addEventListener("change", handleStateChange);
    window.addEventListener("hashchange", syncHashState);

    render();
  } catch (error) {
    renderError(error);
  }
}

async function fetchCsv(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status})`);
  }

  return response.text();
}

async function resolveDataPaths() {
  const candidates = [
    { dataBase: "./data", flyerBase: "./flyers" },
    { dataBase: "../output", flyerBase: ".." },
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate.dataBase}/master_events.csv`, { cache: "no-store" });
      if (response.ok) {
        return candidate;
      }
    } catch (error) {
      // Try the next known layout.
    }
  }

  throw new Error("No readable CSV source was found in ./data or ../output.");
}

async function fetchOptionalJson(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      return {};
    }
    return response.json();
  } catch (error) {
    return {};
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          value += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift() || [];

  return rows
    .filter((currentRow) => currentRow.some((cell) => cell !== ""))
    .map((currentRow) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = currentRow[index] ?? "";
      });
      return record;
    });
}

function normalizeRow(row, index) {
  const eventDate = (row.event_date || "").trim();
  const placement = parseEventDate(eventDate);

  return {
    id: index,
    division: (row.division || "").trim(),
    school: (row.school || "").trim(),
    schoolState: (row.school_state || "").trim(),
    eventName: (row.event_name || "").trim(),
    campType: (row.camp_type || "").trim(),
    eventDate,
    sourceFile: normalizePath(row.source_file || ""),
    placement,
  };
}

function normalizePath(input) {
  return input.trim().replace(/\\/g, "/");
}

function parseEventDate(raw) {
  if (!raw || raw.toLowerCase() === "date unknown") {
    return { status: "unknown", dates: [] };
  }

  const cleaned = raw
    .trim()
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ");

  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const monthIndex = Number(slashMatch[1]) - 1;
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = safeDate(year, monthIndex, day);

    return date ? { status: "scheduled", dates: [date] } : { status: "unparsed", dates: [] };
  }

  const normalized = cleaned
    .toUpperCase()
    .replace(/(\d)(ST|ND|RD|TH)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const singleTextMatch = normalized.match(/^([A-Z]+)\s+(\d{1,2})(?:,)?\s*(\d{4})$/);
  if (singleTextMatch) {
    const date = buildNamedDate(singleTextMatch[1], singleTextMatch[2], singleTextMatch[3]);
    return date ? { status: "scheduled", dates: [date] } : { status: "unparsed", dates: [] };
  }

  const rangeTextMatch = normalized.match(/^([A-Z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})(?:,)?\s*(\d{4})$/);
  if (rangeTextMatch) {
    const monthIndex = monthToIndex(rangeTextMatch[1]);
    const startDay = Number(rangeTextMatch[2]);
    const endDay = Number(rangeTextMatch[3]);
    const year = Number(rangeTextMatch[4]);

    if (monthIndex === null || endDay < startDay) {
      return { status: "unparsed", dates: [] };
    }

    const dates = [];
    for (let day = startDay; day <= endDay; day += 1) {
      const date = safeDate(year, monthIndex, day);
      if (!date) {
        return { status: "unparsed", dates: [] };
      }
      dates.push(date);
    }

    return { status: dates.length ? "scheduled" : "unparsed", dates };
  }

  const andMatch = normalized.match(/^([A-Z]+)\s+(\d{1,2})\s*&\s*(\d{1,2})(?:,)?\s*(\d{4})?$/);
  if (andMatch) {
    const monthIndex = monthToIndex(andMatch[1]);
    const year = andMatch[4] ? Number(andMatch[4]) : DEFAULT_YEAR;
    const firstDate = monthIndex === null ? null : safeDate(year, monthIndex, Number(andMatch[2]));
    const secondDate = monthIndex === null ? null : safeDate(year, monthIndex, Number(andMatch[3]));

    if (!firstDate || !secondDate) {
      return { status: "unparsed", dates: [] };
    }

    return { status: "scheduled", dates: [firstDate, secondDate] };
  }

  return { status: "unparsed", dates: [] };
}

function buildNamedDate(monthName, dayText, yearText) {
  const monthIndex = monthToIndex(monthName);
  if (monthIndex === null) {
    return null;
  }
  return safeDate(Number(yearText), monthIndex, Number(dayText));
}

function monthToIndex(monthName) {
  const normalizedMonth = monthName.toUpperCase();
  const monthIndex = MONTH_NAMES.findIndex((entry) => entry.toUpperCase() === normalizedMonth);
  return monthIndex >= 0 ? monthIndex : null;
}

function safeDate(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseHashState() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const stateCode = (params.get("state") || "").trim().toUpperCase();
  return getStateCodes().includes(stateCode) ? stateCode : "";
}

function syncHashState() {
  const nextState = parseHashState();
  if (nextState === state.currentState) {
    return;
  }

  state.currentState = nextState;
  elements.stateSelect.value = nextState;
  render();
}

function handleStateChange(event) {
  state.currentState = event.target.value;
  window.location.hash = state.currentState ? `state=${state.currentState}` : "state=";
  render();
}

function getStateCodes() {
  return state.stateSummary
    .map((row) => row.school_state)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function populateStateSelector() {
  const existingOptions = elements.stateSelect.querySelectorAll("option");
  existingOptions.forEach((option, index) => {
    if (index > 0) {
      option.remove();
    }
  });

  state.stateSummary
    .slice()
    .sort((left, right) => left.school_state.localeCompare(right.school_state))
    .forEach((summaryRow) => {
      const option = document.createElement("option");
      option.value = summaryRow.school_state;
      option.textContent = `${summaryRow.school_state} · ${summaryRow.event_count} EVENTS`;
      elements.stateSelect.append(option);
    });
}

function render() {
  const filteredRows = getFilteredRows();
  const scheduledPlacements = filteredRows.flatMap((row) =>
    row.placement.dates
      .filter((date) => MONTHS.includes(date.getMonth()))
      .map((date) => ({
        row,
        date,
      }))
  );

  renderOverview(filteredRows, scheduledPlacements);
  renderCalendars(scheduledPlacements);
  renderIssues(filteredRows);
}

function getFilteredRows() {
  return state.rows.filter((row) => !state.currentState || row.schoolState === state.currentState);
}

function renderOverview(filteredRows, scheduledPlacements) {
  elements.overview.innerHTML = "";

  const stateSummary = state.stateSummary.find((entry) => entry.school_state === state.currentState);
  const visibleSchoolCount =
    stateSummary?.school_count ||
    new Set(filteredRows.map((row) => row.school).filter(Boolean)).size;
  const scheduledRowCount = filteredRows.filter(
    (row) =>
      row.placement.status === "scheduled" &&
      row.placement.dates.some((date) => MONTHS.includes(date.getMonth()))
  ).length;

  const issueCount = filteredRows.filter((row) => row.placement.status !== "scheduled").length;
  const outsideWindowCount = filteredRows.filter(
    (row) =>
      row.placement.status === "scheduled" &&
      !row.placement.dates.some((date) => MONTHS.includes(date.getMonth()))
  ).length;

  const metrics = [
    {
      label: state.currentState ? `${state.currentState} View` : "Calendar View",
      value: state.currentState || "MASTER",
    },
    {
      label: "May-Aug Events",
      value: String(scheduledRowCount),
    },
    {
      label: "Schools",
      value: String(visibleSchoolCount),
    },
    {
      label: "Date Issues",
      value: String(issueCount + outsideWindowCount),
    },
  ];

  metrics.forEach((metric) => {
    const fragment = elements.metricTemplate.content.cloneNode(true);
    fragment.querySelector(".metric-label").textContent = metric.label;
    fragment.querySelector(".metric-value").textContent = metric.value;
    elements.overview.append(fragment);
  });
}

function renderCalendars(placements) {
  elements.calendarGrid.innerHTML = "";

  const groupedPlacements = groupPlacementsByDay(placements);

  MONTHS.forEach((monthIndex) => {
    const card = document.createElement("article");
    card.className = "month-card";

    const monthPlacements = placements.filter((entry) => entry.date.getMonth() === monthIndex);
    const uniqueSchools = new Set(monthPlacements.map((entry) => entry.row.school)).size;

    const top = document.createElement("div");
    top.className = "month-top";
    top.innerHTML = `
      <p class="month-kicker">2026 Calendar</p>
      <h2 class="month-heading">${MONTH_NAMES[monthIndex]}</h2>
      <p class="section-note">${monthPlacements.length} scheduled placements across ${uniqueSchools} schools.</p>
    `;
    card.append(top);

    const grid = document.createElement("div");
    grid.className = "month-grid";

    WEEKDAYS.forEach((weekday) => {
      const nameCell = document.createElement("div");
      nameCell.className = "day-name";
      nameCell.textContent = weekday;
      grid.append(nameCell);
    });

    const firstDay = new Date(DEFAULT_YEAR, monthIndex, 1).getDay();
    const dayCount = new Date(DEFAULT_YEAR, monthIndex + 1, 0).getDate();

    for (let index = 0; index < firstDay; index += 1) {
      const outsideCell = document.createElement("div");
      outsideCell.className = "day-cell is-outside";
      grid.append(outsideCell);
    }

    for (let day = 1; day <= dayCount; day += 1) {
      const cell = document.createElement("div");
      const dayEntries = groupedPlacements.get(makePlacementKey(monthIndex, day)) || [];
      cell.className = `day-cell${dayEntries.length ? "" : " is-empty"}`;

      const number = document.createElement("p");
      number.className = "day-number";
      number.textContent = String(day);
      cell.append(number);

      if (dayEntries.length) {
        const eventsWrap = document.createElement("div");
        eventsWrap.className = "day-events";

        dedupeDayEntries(dayEntries).forEach((entry) => {
          const link = document.createElement(entry.href ? "a" : "span");
          link.className = "day-link";
          link.textContent = entry.school.toUpperCase();
          link.title = entry.title;

          if (entry.href) {
            link.href = entry.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }

          eventsWrap.append(link);
        });

        cell.append(eventsWrap);
      }

      grid.append(cell);
    }

    if (!monthPlacements.length) {
      const empty = document.createElement("p");
      empty.className = "empty-month";
      empty.textContent = "No scheduled camps were placed in this month for the current selection.";
      card.append(grid);
      card.append(empty);
    } else {
      card.append(grid);
    }

    elements.calendarGrid.append(card);
  });
}

function groupPlacementsByDay(placements) {
  const groups = new Map();

  placements.forEach((entry) => {
    const key = makePlacementKey(entry.date.getMonth(), entry.date.getDate());
    const items = groups.get(key) || [];
    items.push({
      school: entry.row.school,
      href: buildFlyerHref(entry.row.sourceFile),
      title: buildTooltip(entry.row),
      sourceFile: entry.row.sourceFile,
      eventName: entry.row.eventName,
    });
    groups.set(key, items);
  });

  return groups;
}

function makePlacementKey(monthIndex, day) {
  return `${monthIndex}-${day}`;
}

function dedupeDayEntries(entries) {
  const byKey = new Map();

  entries
    .slice()
    .sort((left, right) => left.school.localeCompare(right.school))
    .forEach((entry) => {
      const key = `${entry.school}::${entry.sourceFile}`;
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, {
          ...entry,
          eventNames: entry.eventName ? [entry.eventName] : [],
        });
        return;
      }

      if (entry.eventName && !existing.eventNames.includes(entry.eventName)) {
        existing.eventNames.push(entry.eventName);
        existing.title = `${existing.school}\n${existing.eventNames.join("\n")}`;
      }
    });

  return Array.from(byKey.values());
}

function buildTooltip(row) {
  const lines = [row.school, row.eventName, row.campType, row.eventDate].filter(Boolean);
  return lines.join("\n");
}

function buildFlyerHref(sourceFile) {
  if (!sourceFile) {
    return "";
  }

  const manifestHit = state.flyerManifest[sourceFile];
  if (manifestHit) {
    return manifestHit;
  }

  const firstCandidate = sourceFile
    .split(/\s*(?:\||,)\s*/)
    .map((entry) => normalizePath(entry))
    .find(Boolean);

  if (!firstCandidate) {
    return "";
  }

  const segments = firstCandidate.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment));
  return `${state.paths.flyerBase}/${segments.join("/")}`;
}

function renderIssues(filteredRows) {
  const unknownRows = filteredRows.filter((row) => row.placement.status === "unknown");
  const unparsedRows = filteredRows.filter((row) => row.placement.status === "unparsed");
  const outsideWindowRows = filteredRows.filter(
    (row) =>
      row.placement.status === "scheduled" &&
      !row.placement.dates.some((date) => MONTHS.includes(date.getMonth()))
  );

  elements.issuesPanel.innerHTML = "";
  elements.issuesPanel.append(
    buildIssueCard(
      "Date Unknown",
      "These rows stay out of the calendar because the saved CSV explicitly marks the date as unknown.",
      unknownRows,
      (row) => buildIssueMeta(row, "DATE UNKNOWN")
    ),
    buildIssueCard(
      "Not On May-Aug Calendar",
      "These rows have saved dates, but they fall outside the requested May-August calendar window.",
      outsideWindowRows,
      (row) => buildIssueMeta(row, row.eventDate)
    ),
    buildIssueCard(
      "Needs Date Review",
      "These saved date strings could not be placed confidently on the calendar, so they remain unassigned.",
      unparsedRows,
      (row) => buildIssueMeta(row, row.eventDate)
    )
  );
}

function buildIssueCard(title, note, rows, metaBuilder) {
  const card = document.createElement("article");
  card.className = "issues-card";

  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = `${title} (${rows.length})`;
  card.append(heading);

  const description = document.createElement("p");
  description.className = "section-note";
  description.textContent = note;
  card.append(description);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "Nothing to show for the current selection.";
    card.append(empty);
    return card;
  }

  const list = document.createElement("div");
  list.className = "issue-list";

  rows
    .slice()
    .sort((left, right) => left.school.localeCompare(right.school))
    .forEach((row) => {
      const item = document.createElement("div");
      item.className = "issue-item";

      const label = document.createElement("p");
      label.className = "issue-label";
      label.textContent = row.schoolState || "Unknown State";

      const school = document.createElement("p");
      school.className = "issue-school";

      if (row.sourceFile) {
        const link = document.createElement("a");
        link.className = "issue-link";
        link.href = buildFlyerHref(row.sourceFile);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = row.school.toUpperCase();
        school.append(link);
      } else {
        school.textContent = row.school.toUpperCase();
      }

      const meta = document.createElement("p");
      meta.className = "issue-meta";
      meta.textContent = metaBuilder(row);

      item.append(label, school, meta);
      list.append(item);
    });

  card.append(list);
  return card;
}

function buildIssueMeta(row, dateLabel) {
  return [row.eventName, row.campType, dateLabel].filter(Boolean).join(" • ");
}

function renderLoading() {
  elements.overview.innerHTML = "";
  elements.calendarGrid.innerHTML = '<p class="loading-text">Loading the saved camp CSV outputs...</p>';
  elements.issuesPanel.innerHTML = "";
}

function renderError(error) {
  elements.overview.innerHTML = "";
  elements.calendarGrid.innerHTML = `
    <p class="error-text">
      The site could not load the saved CSV files. Open this page through a local web server from
      <code>D:\\Camps</code>, not directly with <code>file://</code>.<br><br>
      ${escapeHtml(error.message)}
    </p>
  `;
  elements.issuesPanel.innerHTML = "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
