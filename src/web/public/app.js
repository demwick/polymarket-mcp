async function fetchDashboard() {
  try {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error("Failed to fetch dashboard:", err);
  }
}

function render(data) {
  const badge = document.getElementById("mode-badge");
  badge.textContent = data.mode.toUpperCase();
  badge.className = data.mode === "live" ? "live" : "";

  document.getElementById("budget-text").textContent =
    "$" + data.budget.spent.toFixed(2) + " / $" + data.budget.limit.toFixed(2);
  document.getElementById("pnl-text").textContent =
    "$" + data.stats.totalPnl.toFixed(2);
  document.getElementById("winrate-text").textContent =
    data.stats.winRate.toFixed(1) + "%";
  document.getElementById("trades-text").textContent =
    data.stats.total + " (W:" + data.stats.wins + " L:" + data.stats.losses + ")";
  document.getElementById("monitor-text").textContent =
    data.monitor.running ? "Active" : "Stopped";
  var btn = document.getElementById("monitor-btn");
  if (data.monitor.running) {
    btn.textContent = "Stop";
    btn.className = "running";
  } else {
    btn.textContent = "Start";
    btn.className = "";
  }

  var tbody = document.getElementById("trades-body");
  var noTrades = document.getElementById("no-trades");
  if (data.recentTrades.length > 0) {
    noTrades.style.display = "none";
    tbody.innerHTML = data.recentTrades.map(function(t) {
      var time = "-";
      if (t.created_at) {
        var parts = t.created_at.includes("T") ? t.created_at.split("T") : t.created_at.split(" ");
        time = parts[1] ? parts[1].slice(0, 5) : "-";
      }
      var addr = t.trader_address ? t.trader_address.slice(0, 6) + ".." : "-";
      return "<tr>" +
        "<td>" + time + "</td>" +
        "<td>" + addr + "</td>" +
        "<td>" + (t.market_slug || "-").slice(0, 30) + "</td>" +
        "<td>$" + (t.price || 0).toFixed(2) + "</td>" +
        "<td>$" + (t.amount || 0).toFixed(2) + "</td>" +
        "<td>" + (t.status || "-") + "</td>" +
        "</tr>";
    }).join("");
  } else {
    noTrades.style.display = "block";
    tbody.innerHTML = "";
  }

  var cards = document.getElementById("watchlist-cards");
  var noWatchlist = document.getElementById("no-watchlist");
  if (data.watchlist.length > 0) {
    noWatchlist.style.display = "none";
    cards.innerHTML = data.watchlist.map(function(w) {
      var addr = w.address.slice(0, 6) + ".." + w.address.slice(-4);
      var escapedAlias = escapeHtml(w.alias || "Unknown");
      return '<div class="wallet-card">' +
        '<div class="alias">' + escapedAlias + '</div>' +
        '<div class="addr">' + addr + '</div>' +
        '<div class="meta">Vol: $' + (w.volume || 0).toLocaleString() + ' | PnL: $' + (w.pnl || 0).toLocaleString() + '</div>' +
        '<button class="remove-btn" onclick="removeFromWatchlist(\'' + w.address + '\')">Remove</button>' +
        '</div>';
    }).join("");
  } else {
    noWatchlist.style.display = "block";
    cards.innerHTML = "";
  }

  var logDiv = document.getElementById("log-stream");
  if (data.logs.length > 0) {
    logDiv.innerHTML = data.logs.map(function(l) {
      var parts = l.timestamp.includes("T") ? l.timestamp.split("T") : l.timestamp.split(" ");
      var time = parts[1] ? parts[1].slice(0, 8) : "";
      return '<div class="log-entry ' + l.level + '">[' + time + '] <b>' + l.level + '</b>: ' + l.message + '</div>';
    }).join("");
    logDiv.scrollTop = logDiv.scrollHeight;
  } else {
    logDiv.innerHTML = '<div class="log-entry info">No events yet</div>';
  }
}

async function toggleMonitor() {
  var btn = document.getElementById("monitor-btn");
  var action = btn.textContent === "Start" ? "start" : "stop";
  btn.disabled = true;
  try {
    await fetch("/api/monitor/" + action, { method: "POST" });
    await fetchDashboard();
  } catch (err) {
    console.error("Monitor toggle failed:", err);
  }
  btn.disabled = false;
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openDiscover() {
  document.getElementById("discover-panel").style.display = "block";
  document.getElementById("discover-btn").style.display = "none";
}

function closeDiscover() {
  document.getElementById("discover-panel").style.display = "none";
  document.getElementById("discover-btn").style.display = "";
}

async function searchTraders() {
  var btn = document.getElementById("discover-search-btn");
  var loading = document.getElementById("discover-loading");
  var results = document.getElementById("discover-results");
  var period = document.getElementById("discover-period").value;
  var minVol = document.getElementById("discover-min-vol").value || "1000";

  btn.disabled = true;
  loading.style.display = "block";
  results.innerHTML = "";

  try {
    var res = await fetch("/api/discover-traders?period=" + period + "&min_volume=" + minVol);
    var data = await res.json();

    if (!data.ok || data.traders.length === 0) {
      results.innerHTML = '<p class="empty-state">No traders found. Try lowering minimum volume.</p>';
      return;
    }

    results.innerHTML = data.traders.map(function(t, i) {
      var addr = t.address.slice(0, 6) + ".." + t.address.slice(-4);
      var escapedName = escapeHtml(t.name);
      return '<div class="trader-row">' +
        '<div class="trader-info">' +
          '<div class="name">#' + (i + 1) + ' ' + escapedName + ' <span style="color:#555">(' + addr + ')</span></div>' +
          '<div class="stats">PnL: $' + t.pnl.toLocaleString() + ' | Vol: $' + t.volume.toLocaleString() + ' | Rank: ' + t.rank + '</div>' +
        '</div>' +
        '<button class="watch-btn" id="wb-' + i + '" onclick="addToWatchlist(\'' + t.address + '\', \'' + escapedName.replace(/'/g, "\\'") + '\', ' + t.volume + ', ' + t.pnl + ', ' + i + ')">+ Watch</button>' +
        '</div>';
    }).join("");
  } catch (err) {
    results.innerHTML = '<p class="empty-state">Error: ' + err.message + '</p>';
  } finally {
    btn.disabled = false;
    loading.style.display = "none";
  }
}

async function addToWatchlist(address, alias, volume, pnl, idx) {
  var btn = document.getElementById("wb-" + idx);
  btn.disabled = true;
  btn.textContent = "Adding...";

  try {
    await fetch("/api/watchlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address, alias: alias, volume: volume, pnl: pnl })
    });
    btn.textContent = "Added";
    btn.className = "watch-btn added";
    fetchDashboard();
  } catch (err) {
    btn.textContent = "Failed";
    btn.disabled = false;
  }
}

async function removeFromWatchlist(address) {
  try {
    await fetch("/api/watchlist/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address })
    });
    fetchDashboard();
  } catch (err) {
    console.error("Remove failed:", err);
  }
}

fetchDashboard();
setInterval(fetchDashboard, 10000);
