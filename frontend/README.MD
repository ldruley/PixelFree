# 💻 PixelFree Frontend

The **PixelFree Frontend** provides the user-facing experience for the open digital photo frame.
It includes both the **web configuration interface** and the **display UI**, allowing users to manage albums, connect to **Pixelfed**, and control how images appear on the digital frame.

---

## 📘 Overview

**PixelFree** is an open-source, decentralized digital photo frame that connects to **Pixelfed**, a privacy-friendly photo-sharing platform in the Fediverse.

Unlike commercial frames tied to closed ecosystems, PixelFree gives users full control over their data, display preferences, and connected accounts.

### The frontend handles:
- 👤 User setup and authentication through the web UI
- 🖼️ Album management (tags, users, filters)
- ⚙️ Display configuration (layout, transitions, timing)
- 🧭 Real-time photo display in full-screen mode

---

## 🧩 Architecture Role

| Component | Description | Technology |
|------------|--------------|-------------|
| **Settings UI** | Configuration and settings interface (setup, styling, preferences, theme selection) | React + JavaScript (Vite), Tailwind |
| **Display UI** | Full-screen photo carousel running on the frame (layouts & transitions) | React + JavaScript, Tailwind |

Both frontend layers communicate with backend APIs to fetch photos, manage authentication, and update display settings dynamically.

---

## 🚀 Features

- 🔐 **Pixelfed Login** — OAuth2 authentication flow
- 🖼️ **Album Management** — create albums by tags, users, or both
- ⚙️ **Display Controls** — adjust layout, transitions, timing, shuffle
- 📱 **Responsive UI** — optimized for desktop and mobile
- 🧭 **Real-Time Sync** — updates photos automatically as new posts appear
- 🎨 **Theming** — choose visual themes and transition styles

---

## 🧭 User Flow

1. **Setup**
   - Connect the frame to Wi-Fi and open the web interface via QR or local IP.
   - Complete guided setup and connect to Pixelfed via OAuth2 or personal access token.

2. **Configuration**
   - Create albums using hashtags, usernames, or both.
   - Preview, tweak, and save album settings.

3. **Display Control**
   - Choose layout (single image, grid, split-screen).
   - Set transitions, timing, and shuffle behavior.

4. **Viewing**
   - The frame displays photos full-screen and refreshes content automatically.
   - Switch albums or edit preferences from the web interface.

---

## 🧰 Tech Stack
- React + Js
- Vite (bundler/dev server)
- Tailwind CSS (styling)
