![PixelFree Dark](../doc/images/PixelFreeDark.png)

# PixelFree Backend

## Overview
The PixelFree backend is a Node.js application that acts as the controller for the PixelFree digital photo frame project. It handles authentication with the Pixelfed API, retrieves images, and serves them to a frontend display application. Images can be queried based on hashtags, users, or both. It also has the notion of "virtual albums" that correspond to queries such as:

* Retrieve images from any of the specified users regardless of how or if they are tagged.
* Retrieve images with any|all of the specified hashtags, regardless of which users posted them.
* Retrieve images with any|all of the specified hashtags, but only from the specified users.

A Pixelfed client ID (public) and corresponding client secret have already been obtained for the project.

Work in progress:

* Virtual albums (see [separate document with thoughts on virtual albums](doc/VirtAlbums.md))
* Image caching (see [separate caching strategy document](doc/Caching.md))

Future work:

* "Favorites" albums
* Time-based queries (e.g. new photos since)
* Full-coverage unit tests


## Features
- **Pixelfed OAuth 2.0 Authentication** — Securely authenticate and store access/refresh tokens for a Pixelfed account.
- **Media Retrieval** — Fetches photos from Pixelfed based on user queries (hashtags, usernames).
- **Query Flexibility** — Currently supports searching by tags, usernames, or various combinations.
- **Token Management** — Securely stores and refreshes access tokens.
- **API Wrapper** — Encapsulates Pixelfed API calls for easy reuse in other modules.
- **Static Frontend Support** — Serves a simple HTML/CSS/JS test frontend for development and testing.

## Tech Stack
- **Node.js** — Core runtime environment.
- **Express.js** — Web framework for API endpoints and static content.
- **Axios / Fetch** — HTTP requests to Pixelfed API.
- **dotenv** — Environment variable management.
- **File System** — Local storage for cached tokens and future image caching.

## Directory Overview

| Directory  | Purpose |
|------------|---------|
| `api`    | Defines HTTP API endpoints and their routing logic. Handles request/response processing for frontend interactions. |
| `db`     | The persistence layer that supports caching, virtual albums, and metadata storage (SQLite) |
| `modules`| Holds self-contained feature modules, each responsible for a specific business domain or functionality. |
| `public` | A small test UI for the backend. Not intended for roduction use. |
| `scripts` | Test scripts for various aspects of the functionality |
| `services`| Encapsulates core business logic and external service integrations (e.g., database queries, API calls). |
| `utils`  | Shared utility functions and helper classes that can be reused across multiple parts of the backend. |

### Key Files
- `server.js`: Main entry point; initializes Express server and routes.
- `.token.json`: Stores OAuth tokens (ignored by Git for security).
- `.env`: Environment variables (ignored by Git; see `example.env`).
- `pixelfree.db*`: SQLite database files

## Security Notes
- **Never commit `.token.json`** — This file contains active OAuth tokens that allow access to a Pixelfed account.
- **Never commit `.env`** — This file contains API credentials and must be kept private.
- A `.gitignore` is provided to ensure sensitive files are not pushed to the repository.

## Setup Instructions

Notes:

* You will need a Pixelfed account for this project. Please create one on the `pixelfed.social` instance as described here: [Getting Started](https://pixelfed.social/site/kb/getting-started)
* The instructions below are to be run in Windows `Terminal`. Note that after installing `git` you may use `bash` instead of `Terminal`. Of course you may also do all of this in an IDE.
* If running on a Mac or Linux, you can skip the Windows-specific steps.

0. **Install tools**

   ```bash
   # Install git using the command below. You will be prompted for input along the way.
   winget install --id Git.Git -e --source winget
   # Now install Node. You will be propted for input along the way.
   winget install --id OpenJS.NodeJS.LTS -e
   # The next command is critical in order for `npm` to work:
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   #
   # Important: Close and re-open your Terminal or the commands won't be found!
   #
   ```
 
1. **Clone the repository**
   
   ```bash
   # Navigate to a directory where you'd like the code to live (e.g. ~/Projects)
   # The git clone command will create a new subdirectory named PixelFree and
   # populate it with the project code
   git clone https://github.com/jpasqua/PixelFree.git
   cd PixelFree/backend
   ```

2. **Install dependencies**

   ```bash
   # Now return to the project directory and install the project dependencies
   npm install
   ```

3. **Create environment configuration**
   - Copy `env.example.txt` to `.env`:

     ```bash
     cp env.example.txt .env
     ```
   - Edit the `.env` file to supply your Pixelfed secret. Contact your project adminsitrator to get this.

4. Run the backend

    ```bash
    npm start
    ```
    This will start the backend server using the `start` script defined in `package.json`.

    For development with `NODE_ENV` set to `development` (useful for enabling verbose logging or dev-specific settings), run:

    ```bash
    npm run dev
    ```

5. **Access the test frontend**
   - Open `http://localhost:3000` in a browser.

Ypu may also find these notes useful for [developing/running the project with VS Code](doc/VSCodeNotes.md).

## Basic Tests of the Query API

To test query functionality from the command line, use the file `scripts/api_query_tests.sh`. It contains a series of curl commands that exercise all the various aspects of the query API including a number of error cases. Before running these scripts, you must have already authenticated using OAuth:

   - In a browser, visit: http://localhost:3000/api/auth
   - Log in to your Pixelfed account and authorize PixelFree.
   - The backend will store the authentication token in `.token.json`.
   - Once this is complete, you can run the script without errors.

This file is also provides good examples of what the API can do.

## License
This backend is part of the PixelFree project, intended for educational and non-commercial use unless otherwise specified in the main project license.
