# 💻 PixelFree Frontend Frame

The **PixelFree Frontend Frame** provides the user-facing experience for the open digital photo frame.
This section only includes the **frame UI** ,connects to **Pixelfed**, and shows images from you albums on the digital frame.

---

## 📘 Overview

**PixelFree** is an open-source, decentralized digital photo frame that connects to **Pixelfed**, a privacy-friendly photo-sharing platform in the Fediverse.

### This frontend handles:
- ⚙️ Display configuration (layout, transitions, timing)
- 🧭 Real-time photo display in full-screen mode

---

## 🧩 Architecture Role

| Component | Description | Technology |
|------------|--------------|-------------|
| **Display UI** | Full-screen photo carousel running on the frame (layouts & transitions) | React + JavaScript, Tailwind |

Frontend Frame communicate with backend APIs to fetch photos, manage authentication, and update display settings dynamically.

---

## 🚀 Features

- 🔐 **Pixelfed Login** — OAuth2 authentication flow
- ⚙️ **Display Controls** — adjust layout, transitions, timing, shuffle
- 📱 **Responsive UI** — optimized for raspberry-pi
- 🧭 **Real-Time Sync** — updates photos automatically as new posts appear

---

## 🧭 User Flow

(Option for User). **Display Control**
   - Choose layout (single image, grid, split-screen).
   - Set transitions, timing, and shuffle behavior.

1. **Viewing**
   - The frame displays photos full-screen and refreshes content automatically.
   - Switch albums or edit preferences from the web interface.

---

## 🧰 Tech Stack
- React + Js
- Vite (bundler/dev server)
- Tailwind CSS (styling)
