# PixelFree Onboarding – VS Code Setup

## 1. Install VS Code
- Download from [https://code.visualstudio.com](https://code.visualstudio.com)  
- Install with default options (both Windows and macOS).



## 2. Open the Project
- Open **VS Code**.  
- Use `File → Open Folder…` and select the root PixelFree repo (the folder containing `backend`, `doc`, `LICENSE`, etc.).
- When you first open any project folder, VS Code will ask:

  “*Do you trust the authors of the files in this folder?*”
  
  Since this is your code, select the option: "*Yes, I trust the authors*"

- You should now see the full repo structure in the **Explorer** sidebar.



## 3. Built-in Terminal
- VS Code includes an integrated terminal.  
- Open it with:  
  - **Windows/Linux**: <kbd>Ctrl</kbd> + <kbd>`</kbd>  
  - **macOS**: <kbd>Ctrl</kbd> + <kbd>SHIFT</kbd> + <kbd>`</kbd>  
- You’ll be able to run commands (`git`, `npm`, `node server.js`, etc.) without leaving the editor.



## 4. Recommended Extensions
You may wish to install these from the **Extensions Marketplace** (left sidebar, square icon):

1. **ESLint** (dbaeumer.vscode-eslint)  
   - Lints JavaScript/Node code and enforces style consistency.
2. **Prettier – Code Formatter** (esbenp.prettier-vscode)  
   - Automatic code formatting for consistency across the team.
3. **SQLite Viewer** (alexcvzz.vscode-sqlite)  
   - Lets you open and inspect the `pixelfree.db` file directly inside VS Code.
4. **REST Client** (humao.rest-client)  
   - Send HTTP requests (like `POST /api/photos/query`) directly from VS Code, without Postman or curl.
5. **GitLens** (eamodio.gitlens)  
   - Enhances Git integration with blame, history, and visual diffs.

Other optional extentsions:

- **Markdown All in One** (yzhang.markdown-all-in-one) → For editing `README.md`, `Caching.md`, etc.
- **Material Icon Theme** (PKief.material-icon-theme) → Makes the folder structure easier to scan.



## 5. Running the Backend
Run the following commands in the Terminal pane:

- Navigate to the backend folder:

  ```bash
  cd backend
  ```

- Install dependencies (only required the first time):

  ```bash
  npm install
  ```

- Run the backend:

  ```bash
  npm start
  ```

The backend should now be serving routes on [http://localhost:3000](http://localhost:3000).



## 6. Debugging with Breakpoints
1. In VS Code, open `backend/server.js` (or any module).  
2. Click left of the line number to set a red breakpoint dot.  
3. Go to the **Run and Debug** panel (left sidebar, play/bug icon).  
4. Select **“Node.js”** and hit **Run**.  
5. The app will start under the debugger, and pause execution at breakpoints.
