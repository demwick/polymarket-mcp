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

  var tbody = document.getElementById("trades-body");
  var noTrades = document.getElementById("no-trades");
  if (data.recentTrades.length > 0) {
    noTrades.style.display = "none";
    tbody.innerHTML = data.recentTrades.map(function(t) {
      var time = t.created_at ? t.created_at.split("T")[1].slice(0, 5) : "-";
      var addr = t.trader_address.slice(0, 6) + "..";
      return "<tr>" +
        "<td>" + time + "</td>" +
        "<td>" + addr + "</td>" +
        "<td>" + (t.market_slug || "-") + "</td>" +
        "<td>$" + t.price.toFixed(2) + "</td>" +
        "<td>$" + t.amount.toFixed(2) + "</td>" +
        "<td>" + t.status + "</td>" +
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
      return '<div class="wallet-card">' +
        '<div class="alias">' + (w.alias || "Unknown") + '</div>' +
        '<div class="addr">' + addr + '</div>' +
        '<div class="meta">Vol: $' + (w.volume || 0).toLocaleString() + ' | PnL: $' + (w.pnl || 0).toLocaleString() + '</div>' +
        '</div>';
    }).join("");
  } else {
    noWatchlist.style.display = "block";
    cards.innerHTML = "";
  }

  var logDiv = document.getElementById("log-stream");
  if (data.logs.length > 0) {
    logDiv.innerHTML = data.logs.map(function(l) {
      var time = l.timestamp.split("T")[1].slice(0, 8);
      return '<div class="log-entry ' + l.level + '">[' + time + '] <b>' + l.level + '</b>: ' + l.message + '</div>';
    }).join("");
    logDiv.scrollTop = logDiv.scrollHeight;
  } else {
    logDiv.innerHTML = '<div class="log-entry info">No events yet</div>';
  }
}

fetchDashboard();
setInterval(fetchDashboard, 10000);
