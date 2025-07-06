# ⏱️ Time Tracker & Productivity Analytics Chrome Extension

## 📌 Overview

**Time Tracker & Productivity Analytics** is a Chrome extension designed to help users manage their digital time more effectively. It tracks the time spent on different websites, classifies them as **productive** or **unproductive**, and provides **detailed analytics and weekly productivity reports** via a customizable dashboard.

This tool is ideal for students, developers, remote workers, or anyone who wants to **optimize their productivity** by understanding their browsing habits.

---

## 🚀 Features

- 🔍 Tracks time spent on each website
- ✅ Categorizes websites as **Productive** or **Unproductive**
- 📊 Dashboard to view daily and weekly usage stats
- 📁 Backend integration to store user activity data
- 🧠 Smart analytics and productivity score
- 📨 Weekly productivity report summary
- 🔐 Secure local or cloud-based data storage (configurable)

---

## 🛠️ Tech Stack

| Frontend     | Backend         | Database    |
|--------------|------------------|-------------|
| HTML, CSS, JS | Node.js / Express  | MongoDB  |

> You can also use Chrome's `storage.local` for simpler versions.

---

## 🧩 Extension Components

1. **`manifest.json`** - Chrome extension configuration file.
2. **`background.js`** - Runs in the background and tracks tab activity.
3. **`content.js`** - Optional script to interact with webpages.
4. **`popup.html / popup.js`** - Quick summary popup UI.
5. **`dashboard.html`** - Detailed analytics dashboard.
6. **`server.js`** (Optional) - Node.js server to handle user data storage.
7. **`database.js`** - Database configuration file.

---

## 📦 Installation (Development Mode)

1. Clone this repo:
   ```bash
   git clone https://github.com/your-username/time-tracker-extension.git
   cd time-tracker-extension
