(function () {
  "use strict";

  /* ---------------------------------------------------------------
     CONFIG — three placeholders. Fill these in once you've done the
     Google-side setup (published Roster CSV, new Attendance Form).
  --------------------------------------------------------------- */
  var CONFIG = {
    ROSTER_CSV_URL: "REPLACE_WITH_PUBLISHED_ROSTER_CSV_URL",
    FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSedQ5BduCUsT30KY1DjkGVxaPhTJFOdfoqgHW849TkG2Cr7eQ/formResponse",
    DATE_ENTRY_ID: "entry.794975521",
    NAME_ENTRY_ID: "entry.487102942"
  };

  var statusEl = document.getElementById("roster-status");
  var listEl = document.getElementById("roster-list");
  var dateInput = document.getElementById("att-date");
  var submitBtn = document.getElementById("submit-btn");
  var confirmPanel = document.getElementById("confirm-panel");

  // Default the date field to today, in the browser's local time.
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, "0");
  var dd = String(today.getDate()).padStart(2, "0");
  dateInput.value = yyyy + "-" + mm + "-" + dd;

  /* ---------------------------------------------------------------
     Roster: fetch the published, names-only CSV and render checkboxes.
  --------------------------------------------------------------- */
  function parseRosterCSV(text) {
    var lines = text.split(/\r\n|\n|\r/).filter(function (l) {
      return l.trim().length > 0;
    });
    var names = [];
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (i === 0 && raw.toLowerCase() === "name") continue; // header row
      var name = raw;
      if (name.charAt(0) === '"' && name.charAt(name.length - 1) === '"') {
        name = name.slice(1, -1).replace(/""/g, '"');
      }
      if (name.length > 0) names.push(name);
    }
    return names;
  }

  function renderRoster(names) {
    listEl.innerHTML = "";
    names.forEach(function (name, i) {
      var label = document.createElement("label");
      label.className = "roster-item";

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      checkbox.id = "roster-" + i;
      checkbox.className = "roster-checkbox";

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(name));
      listEl.appendChild(label);
    });
  }

  function loadRoster() {
    if (CONFIG.ROSTER_CSV_URL.indexOf("http") !== 0) {
      statusEl.textContent = "Roster isn't connected yet — set ROSTER_CSV_URL in script.js.";
      submitBtn.disabled = true;
      return;
    }
    fetch(CONFIG.ROSTER_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        return res.text();
      })
      .then(function (text) {
        var names = parseRosterCSV(text);
        if (names.length === 0) {
          statusEl.textContent = "Roster loaded, but no names were found in it.";
          return;
        }
        renderRoster(names);
        statusEl.textContent = names.length + " people on the roster.";
      })
      .catch(function () {
        statusEl.textContent = "Couldn't load the roster. Check the published CSV link is still valid.";
        submitBtn.disabled = true;
      });
  }

  loadRoster();

  /* ---------------------------------------------------------------
     Select all / clear all — convenience for a full-roster scan.
  --------------------------------------------------------------- */
  document.getElementById("select-all").addEventListener("click", function () {
    listEl.querySelectorAll(".roster-checkbox").forEach(function (cb) {
      cb.checked = true;
    });
  });
  document.getElementById("clear-all").addEventListener("click", function () {
    listEl.querySelectorAll(".roster-checkbox").forEach(function (cb) {
      cb.checked = false;
    });
  });

  /* ---------------------------------------------------------------
     Submit — one row per present person. Each checked name fires its
     own POST to the Attendance Form (Date, Name), the same hidden-
     iframe technique as the main site, staggered slightly so a full
     roster's worth of requests doesn't fire in one instant.
  --------------------------------------------------------------- */
  function submitOne(name, dateStr, index) {
    var iframe = document.createElement("iframe");
    iframe.name = "att-frame-" + index + "-" + Date.now();
    iframe.style.display = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    var form = document.createElement("form");
    form.action = CONFIG.FORM_ACTION_URL;
    form.method = "POST";
    form.target = iframe.name;

    var dateField = document.createElement("input");
    dateField.type = "hidden";
    dateField.name = CONFIG.DATE_ENTRY_ID;
    dateField.value = dateStr;
    form.appendChild(dateField);

    var nameField = document.createElement("input");
    nameField.type = "hidden";
    nameField.name = CONFIG.NAME_ENTRY_ID;
    nameField.value = name;
    form.appendChild(nameField);

    document.body.appendChild(form);
    form.submit();

    setTimeout(function () {
      form.remove();
      iframe.remove();
    }, 4000);
  }

  submitBtn.addEventListener("click", function () {
    if (CONFIG.FORM_ACTION_URL.indexOf("http") !== 0) {
      showConfirm("Attendance form isn't connected yet — set FORM_ACTION_URL in script.js.", true);
      return;
    }

    var checked = Array.prototype.slice
      .call(listEl.querySelectorAll(".roster-checkbox"))
      .filter(function (cb) { return cb.checked; })
      .map(function (cb) { return cb.value; });

    if (checked.length === 0) {
      showConfirm("Check at least one name first.", true);
      return;
    }

    var dateStr = dateInput.value;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    checked.forEach(function (name, i) {
      setTimeout(function () {
        submitOne(name, dateStr, i);
      }, i * 200);
    });

    var totalWait = checked.length * 200 + 2500;
    setTimeout(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit attendance";
      showConfirm("Attendance recorded for " + checked.length + " " +
        (checked.length === 1 ? "person" : "people") + " on " + dateStr + ".", false);
    }, totalWait);
  });

  function showConfirm(message, isError) {
    confirmPanel.textContent = message;
    confirmPanel.classList.toggle("is-error", !!isError);
    confirmPanel.hidden = false;
  }
})();
