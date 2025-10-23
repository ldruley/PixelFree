## 🧩 User Stories

---

### ⚙️ Setup & Connection

<details>
<summary> <b>1 – Log in to Pixelfed</b></summary>

**User Story:**  
As a user, I want to log in with my Pixelfed account credentials, so my frame can access my photos and public feeds.

**Check List:**
- [ ] The UI provides a “Connect Pixelfed” button or Sign up 
- [ ] I can authenticate using OAuth
- [ ] I can authenticate an API token  
- [ ] On success, the system stores my credentials securely  
- [ ] The page shows confirmation that login is complete  
</details>

---

### 🗂️ Album Management

<details>
<summary><b>1 – Create Album by Tags</b></summary>

**User Story:**  
As a user, I want to create an album by specifying one or more tags, so I can automatically include matching photos from any user.

**Check List:**
- [ ] I can enter one or more tags when creating an album  
- [ ] The system fetches preview photos from Pixelfed  
- [ ] The album can be saved and appears in my album list  
- [ ] New posts with those tags appear automatically over time  
</details>

<details>
<summary><b>2 – Create Album by Users</b></summary>

**User Story:**  
As a user, I want to create an album by specifying one or more users, so I can view posts from specific accounts I follow.

**Check List:**
- [ ] I can add users using the `@username@server` format  
- [ ] The system validates the format and fetches photos  
- [ ] The album can be saved and displayed  
- [ ] New posts from those users update automatically  
</details>

<details>
<summary><b>3 – Combine Tags and Users</b></summary>

**User Story:**  
As a user, I want to combine tags and users in an album, so I can focus on a specific theme from select creators.

**Check List:**
- [ ] I can include both tags and users in a single album  
- [ ] The preview includes only posts that match both filters  
- [ ] The combined album can be saved and edited later  
</details>

<details>
<summary><b>4 – Manage Albums</b></summary>

**User Story:**  
As a user, I want to rename, edit, or delete albums, so I can keep my photo selection relevant and organized.

**Check List:**
- [ ] The web UI lists existing albums with edit buttons
- [ ] The web UI lists existing albums with delete buttons  
- [ ] I can rename or update filters for an album  
- [ ] Deleting an album removes it from the frame’s rotation
- [ ] Deleting an album removes it from the user's data 
</details>

---

### 🖼️ Display & Configuration

<details>
<summary><b>1 – Choose Display Style</b></summary>

**User Story:**  
As a user, I want to choose how photos are displayed (single image, grid, etc.), so my frame matches my viewing preference.

**Check List:**
- [ ] Display options include single, tiled (2×2), and rotation speed  
- [ ] My selection updates the preview in real time  
- [ ] The frame remembers my chosen display style  
</details>

<details>
<summary><b>2 – Select Transitions</b></summary>

**User Story:**  
As a user, I want to choose a visual transition effect (fade, slide, none), so photo changes feel smooth and appealing.

**Check List:**
- [ ] Available transitions are fade, slide, and none  
- [ ] Transition timing feels smooth (<1s)
- [ ] Setting is persisted between sessions  
</details>

<details>
<summary><b>3 – Adjust Timing</b></summary>

**User Story:**  
As a user, I want to control how long each photo appears, so I can enjoy them at my own pace.

**Check List:**
- [ ] I can select a time interval (10s, 30s, 1min, custom)  
- [ ] The frame updates rotation accordingly  
- [ ] Setting persists after reboot  
</details>

<details>
<summary><b>4 – Shuffle or Fixed Order</b></summary>

**User Story:**  
As a user, I want to choose between shuffled or fixed display order, so I can keep the viewing experience fresh or predictable.

**Check List:**
- [ ] I can toggle between shuffle and fixed order  
- [ ] Shuffle randomizes image order each cycle  
- [ ] Choice is saved in my settings  
</details>

---

### 🔁 Daily Use

<details>
<summary><b>1 – Auto-Refresh Albums</b></summary>

**User Story:**  
As a user, I want the frame to automatically refresh album content, so I always see new photos without manual updates.

**Check List:**
- [ ] Albums auto-refresh at a configurable interval  
- [ ] Cached images update efficiently (no duplicates)  
- [ ] Status indicator shows last refresh time  
</details>

<details>
<summary><b>2 – Switch Albums in Real-Time</b></summary>

**User Story:**  
As a user, I want to quickly switch between albums from the web UI, so I can change what’s displayed instantly.

**Check List:**
- [ ] Albums appear in a sidebar or dropdown  
- [ ] Selecting an album changes the displayed photos within seconds  
- [ ] No reload of the entire app is required  
</details>

<details>
<summary><b>3 – Create Favorites Album</b></summary>

**User Story:**  
As a user, I want to create a “Favorites” album by selecting photos I like, so I can quickly revisit my favorite moments.

**Check List:**
- [ ] I can mark any photo as a favorite  
- [ ] Favorites appear in a dedicated album  
- [ ] Removing a favorite updates the album in real time  
</details>

---

### 🚀 Stretch Goals

<details>
<summary><b>1 – Embedded Raspberry Pi Frame</b></summary>

**User Story:**  
As a user, I want the PixelFree software to run on a Raspberry Pi in kiosk mode, so I can use it as a standalone photo frame.

**Check List:**
- [ ] Application auto-starts on boot in full-screen mode  
- [ ] Frame connects to Wi-Fi and displays photos automatically  
- [ ] Local caching supports offline viewing  
</details>

<details>
<summary><b>2 – Native Mobile App</b></summary>

**User Story:**  
As a user, I want a mobile app version of the configuration interface, so I can manage my frame natively on iOS or Android.

**Check List:**
- [ ] All web features are available in the app  
- [ ] App supports notifications for new photo updates  
- [ ] App synchronizes with frame via local network or API  
</details>
