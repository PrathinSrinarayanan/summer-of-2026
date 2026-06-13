const STORAGE_KEY = 'fake-stock-simulator-state';


const defaultState = {
  cash: 750,
  stocks: [
    { ticker: 'RTCH', name: 'Rocket Chain', price: 24.75, previousPrice: 24.75 },
    { ticker: 'LUMN', name: 'Lumen Bio', price: 54.12, previousPrice: 54.12 },
    { ticker: 'NOVA', name: 'Nova Energy', price: 13.57, previousPrice: 13.57 },
  ],
  portfolio: {},
  activity: [],
  lastUpdate: Date.now(),
};


const state = loadState();


let utcTimeOffset = 0;
let lastFetchedTime = null;


const elements = {
  cashBalance: document.getElementById('cashBalance'),
  portfolioValue: document.getElementById('portfolioValue'),
  netWorth: document.getElementById('netWorth'),
  stockTable: document.querySelector('#stockTable tbody'),
  portfolioTable: document.querySelector('#portfolioTable tbody'),
  buyTicker: document.getElementById('buyTicker'),
  buyShares: document.getElementById('buyShares'),
  sellTicker: document.getElementById('sellTicker'),
  sellShares: document.getElementById('sellShares'),
  marketClock: document.getElementById('marketClock'),
  marketStatus: document.getElementById('marketStatus'),
  activityFeed: document.getElementById('activityFeed'),
  createForm: document.getElementById('createForm'),
  buyForm: document.getElementById('buyForm'),
  sellForm: document.getElementById('sellForm'),
  resetButton: document.getElementById('resetButton'),
};


function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return JSON.parse(JSON.stringify(defaultState));
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('bad state');
    return parsed;
  } catch (error) {
    console.warn('Could not load saved state, resetting.', error);
    return JSON.parse(JSON.stringify(defaultState));
  }
}


function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}


function formatNumber(value) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}


async function fetchUTCTime() {
  try {
    const response = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC');
    const data = await response.json();
    lastFetchedTime = new Date(data.datetime);
    utcTimeOffset = lastFetchedTime.getTime() - Date.now();
    return lastFetchedTime;
  } catch (error) {
    console.warn('Failed to fetch UTC time from API, using local time:', error);
    lastFetchedTime = new Date();
    utcTimeOffset = 0;
    return lastFetchedTime;
  }
}


function getCurrentUTCTime() {
  const now = new Date(Date.now() + utcTimeOffset);
  return now;
}


function getUTCMarketStatus() {
  const now = getCurrentUTCTime();
  const utcHour = now.getUTCHours();
  const open = utcHour >= 5 && utcHour < 22;
  return {
    open,
    label: open ? 'Market is OPEN (5:00–22:00 UTC)' : 'Market is CLOSED (5:00–22:00 UTC)',
  };
}


function formatUTCTime(date) {
  return date.toISOString().slice(11, 19);
}


function renderMarketStatus() {
  if (!elements.marketStatus) return;
  const status = getUTCMarketStatus();
  elements.marketStatus.textContent = status.label;
  elements.marketStatus.className = status.open ? 'market-open' : 'market-closed';
}


function renderClock() {
  if (!elements.marketClock) return;
  const now = getCurrentUTCTime();
  const status = getUTCMarketStatus();
  const timeText = `UTC ${formatUTCTime(now)} • ${status.open ? 'OPEN' : 'CLOSED'}`;
  const timeSpan = elements.marketClock.querySelector('.market-clock-time');
  if (timeSpan) {
    timeSpan.textContent = timeText;
  }
  elements.marketClock.className = `market-clock ${status.open ? 'open' : 'closed'}`;
  renderMarketStatus();
  setMarketControls();
}


function setMarketControls() {
  const status = getUTCMarketStatus();
  const disabled = !status.open;
  if (elements.buyForm) {
    Array.from(elements.buyForm.querySelectorAll('input, select, button')).forEach((control) => {
      control.disabled = disabled;
    });
  }
  if (elements.sellForm) {
    Array.from(elements.sellForm.querySelectorAll('input, select, button')).forEach((control) => {
      control.disabled = disabled;
    });
  }
}


function addActivity(message) {
  const now = new Date();
  state.activity.unshift({ message, timestamp: now.toISOString() });
  if (state.activity.length > 30) state.activity.pop();
  saveState();
  renderActivity();
}


function getPortfolioValue() {
  return Object.entries(state.portfolio).reduce((sum, [ticker, holding]) => {
    const stock = state.stocks.find((stock) => stock.ticker === ticker);
    if (!stock) return sum;
    return sum + stock.price * holding.shares;
  }, 0);
}


function getNetWorth() {
  return state.cash + getPortfolioValue();
}


function renderSummary() {
  if (elements.cashBalance) {
    elements.cashBalance.textContent = formatCurrency(state.cash);
  }
  if (elements.portfolioValue) {
    elements.portfolioValue.textContent = formatCurrency(getPortfolioValue());
  }
  if (elements.netWorth) {
    elements.netWorth.textContent = formatCurrency(getNetWorth());
  }
}


function renderStockTable() {
  if (!elements.stockTable) return;
  elements.stockTable.innerHTML = '';
  if (elements.buyTicker) {
    elements.buyTicker.innerHTML = '';
  }


  const showActions = Boolean(elements.buyTicker);


  state.stocks.forEach((stock) => {
    const changeAmount = stock.price - stock.previousPrice;
    const changePercent = (changeAmount / stock.previousPrice) * 100 || 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${stock.ticker}</td>
      <td>${stock.name}</td>
      <td>${formatCurrency(stock.price)}</td>
      <td class="${changeAmount >= 0 ? 'price-up' : 'price-down'}">
        ${changeAmount >= 0 ? '+' : ''}${formatNumber(changeAmount)} (${changeAmount >= 0 ? '+' : ''}${formatNumber(changePercent)}%)
      </td>
      ${showActions ? `<td><button class="buy-now" data-ticker="${stock.ticker}">Buy</button></td>` : ''}
    `;
    elements.stockTable.appendChild(row);


    if (elements.buyTicker) {
      const option = document.createElement('option');
      option.value = stock.ticker;
      option.textContent = `${stock.ticker} — ${stock.name}`;
      elements.buyTicker.appendChild(option);
    }
  });


  if (showActions) {
    document.querySelectorAll('.buy-now').forEach((button) => {
      button.addEventListener('click', () => {
        elements.buyTicker.value = button.dataset.ticker;
        if (elements.buyShares) {
          elements.buyShares.focus();
        }
      });
    });
  }
}


function renderPortfolio() {
  if (!elements.portfolioTable) return;
  elements.portfolioTable.innerHTML = '';
  if (elements.sellTicker) {
    elements.sellTicker.innerHTML = '';
  }


  const portfolioEntries = Object.entries(state.portfolio);
  if (portfolioEntries.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="5" style="color: var(--muted);">You don\'t own any shares yet.</td>';
    elements.portfolioTable.appendChild(row);
    return;
  }


  portfolioEntries.forEach(([ticker, holding]) => {
    const stock = state.stocks.find((stock) => stock.ticker === ticker);
    if (!stock) return;
    const value = stock.price * holding.shares;
    const gainLoss = value - holding.costBasis;
    const gainPercent = gainLoss / holding.costBasis * 100 || 0;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${ticker}</td>
      <td>${holding.shares}</td>
      <td>${formatCurrency(holding.costBasis / holding.shares)}</td>
      <td>${formatCurrency(value)}</td>
      <td class="${gainLoss >= 0 ? 'price-up' : 'price-down'}">
        ${gainLoss >= 0 ? '+' : ''}${formatCurrency(gainLoss)} (${gainLoss >= 0 ? '+' : ''}${formatNumber(gainPercent)}%)
      </td>
    `;
    elements.portfolioTable.appendChild(row);


    if (elements.sellTicker) {
      const option = document.createElement('option');
      option.value = ticker;
      option.textContent = `${ticker} — ${holding.shares} shares`;
      elements.sellTicker.appendChild(option);
    }
  });
}


function renderActivity() {
  if (!elements.activityFeed) return;
  elements.activityFeed.innerHTML = '';
  state.activity.forEach((item) => {
    const element = document.createElement('div');
    element.className = 'feed-item';
    const time = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    element.innerHTML = `<div>${item.message}</div><time>${time}</time>`;
    elements.activityFeed.appendChild(element);
  });
}


function renderAll() {
  renderSummary();
  renderStockTable();
  renderPortfolio();
  renderClock();
  renderActivity();
}


function createStock(ticker, name, price) {
  ticker = ticker.toUpperCase().trim();
  if (!ticker || !name || price <= 0) {
    return false;
  }
  if (state.stocks.some((stock) => stock.ticker === ticker)) {
    alert('A stock with that ticker already exists.');
    return false;
  }
  state.stocks.push({ ticker, name, price, previousPrice: price });
  addActivity(`Created stock ${ticker} (${name}) at ${formatCurrency(price)}.`);
  saveState();
  renderAll();
  return true;
}


function buyStock(ticker, shares) {
  if (!getUTCMarketStatus().open) {
    alert('The market is closed. Trading is available from 05:00 to 22:00 UTC.');
    return;
  }
  const stock = state.stocks.find((stock) => stock.ticker === ticker);
  if (!stock || shares < 1) return;
  const cost = stock.price * shares;
  if (cost > state.cash) {
    alert('Not enough cash to complete this purchase.');
    return;
  }
  state.cash -= cost;
  const holding = state.portfolio[ticker] || { shares: 0, costBasis: 0 };
  holding.costBasis += cost;
  holding.shares += shares;
  state.portfolio[ticker] = holding;
  addActivity(`Bought ${shares} share${shares === 1 ? '' : 's'} of ${ticker} for ${formatCurrency(cost)}.`);
  saveState();
  renderAll();
}


function sellStock(ticker, shares) {
  if (!getUTCMarketStatus().open) {
    alert('The market is closed. Trading is available from 05:00 to 22:00 UTC.');
    return;
  }
  const holding = state.portfolio[ticker];
  const stock = state.stocks.find((stock) => stock.ticker === ticker);
  if (!holding || !stock || shares < 1) return;
  if (shares > holding.shares) {
    alert('You do not own that many shares.');
    return;
  }
  const revenue = stock.price * shares;
  state.cash += revenue;
  const averageCost = holding.costBasis / holding.shares;
  holding.shares -= shares;
  holding.costBasis -= averageCost * shares;
  if (holding.shares === 0) {
    delete state.portfolio[ticker];
  } else {
    state.portfolio[ticker] = holding;
  }
  addActivity(`Sold ${shares} share${shares === 1 ? '' : 's'} of ${ticker} for ${formatCurrency(revenue)}.`);
  saveState();
  renderAll();
}


function randomizePrices() {
  if (!getUTCMarketStatus().open) return;
  state.stocks = state.stocks.map((stock) => {
    const changePercent = (Math.random() * 6 - 3) / 100;
    const newPrice = Math.max(0.25, stock.price * (1 + changePercent));
    return {
      ...stock,
      previousPrice: stock.price,
      price: Math.round(newPrice * 100) / 100,
    };
  });
  renderAll();
}


function resetSimulator() {
  if (!confirm('Reset the simulator and clear all progress?')) return;
  Object.assign(state, JSON.parse(JSON.stringify(defaultState)));
  saveState();
  addActivity('Simulator reset to default state.');
  renderAll();
}


function wireEvents() {
  if (elements.createForm) {
    elements.createForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const ticker = document.getElementById('newTicker').value;
      const name = document.getElementById('newName').value;
      const price = parseFloat(document.getElementById('newPrice').value);
      if (createStock(ticker, name, price)) {
        event.target.reset();
        document.getElementById('newPrice').value = '10';
      }
    });
  }


  if (elements.buyForm) {
    elements.buyForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const ticker = elements.buyTicker.value;
      const shares = parseInt(elements.buyShares.value, 10);
      buyStock(ticker, shares);
      if (elements.buyShares) elements.buyShares.value = '1';
    });
  }


  if (elements.sellForm) {
    elements.sellForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const ticker = elements.sellTicker.value;
      const shares = parseInt(elements.sellShares.value, 10);
      sellStock(ticker, shares);
      if (elements.sellShares) elements.sellShares.value = '1';
    });
  }


  if (elements.resetButton) {
    elements.resetButton.addEventListener('click', resetSimulator);
  }
}


function init() {
  fetchUTCTime();
  wireEvents();
  renderAll();
  setInterval(renderClock, 1000);
  setInterval(fetchUTCTime, 30000);
  setInterval(() => {
    randomizePrices();
  }, 5000);
}


init();
