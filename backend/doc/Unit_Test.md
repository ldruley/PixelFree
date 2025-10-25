# Testing Instructions

Run the unit tests in the **Backend** folder.

---

## 1. Prerequisites

- **Make sure you are in the backend directory of the project**
   ```bash
  cd backend

- Ensure dependencies are installed by running:
  ```bash
  npm i

---

## 2. Running Tests

You can run tests in multiple ways:

* Run all tests:

  ```bash
  npm test
  ```
* Run a specific test file:

  ```bash
  npm test <test-file-name>
  ```

If there are errors related to **package.json**, check that it includes:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```


---

## 3. Test Purpose & Expectations *(Future Section)*

| Test Name / File            | Purpose                                         | Expected Outcome                                     | Example Input            | Example Output     |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------- | ------------------------ | ------------------ |
| `accounts.test.js`        |  |     | ``           |  |
| `albumScheduler.test.js`       |  |  | `` |           |
| `auth.test.js`       |  |  | `` |           |
| `cache.test.js`       |  |  | `` |           |
| `errors.test.js`       |  |  | `` |           |
| `health.test.js`       |  |  | `` |           |
| `photoService.test.js`       |  |  | `` |           |
| `settings.test.js`       |  |  | `` |           |

---

## 4. Test Outcome Summary 

Document the **results** of test runs here.

| Date       | Environment | Tests Run | Passed | Failed | Notes                        |
| ---------- | ----------- | --------- | ------ | ------ | ---------------------------- |
| 2025-10-15 | Local   | 22        | 22     | 0      | All tests successful         |

---

## 5. Additional Notes *(Future Section)*

Use this space for:

* Testing frameworks/configurations (Vitest, Jest)
* Environment variables required for tests
* Known test caveats or skipped tests

---
