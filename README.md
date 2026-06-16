# BigQuery Release Notes Explorer

A modern, interactive web application built with **Python Flask** and **Vanilla HTML, CSS, and JS** to fetch, parse, search, and filter the latest BigQuery release notes.

## Features

- **Live XML Fetching**: Automatically fetches the official Google Cloud BigQuery release notes Atom feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
- **Atom XML Feed Parser**: Parses raw CDATA HTML content into structured notes categorized by release type:
  - `Feature` (New capabilities)
  - `Change` (Updates & enhancements)
  - `Breaking` (Breaking changes)
  - `Issue` (Known issues and bugs)
  - `Deprecation` (Features being deprecated)
  - `Announcement` (General announcements)
- **Live Search & Highlighting**: Instantly search titles, category labels, or note descriptions. Matches are highlighted inside the text nodes without breaking HTML tags or anchor links.
- **Advanced Category Filters**: Filter updates by their category badges with dynamic update counts.
- **Overview Dashboard & Analytics**: Dynamic summary widget showing total release updates, release days, and interactive bar charts showing category distributions.
- **Glassmorphic Theme Switcher**: Toggle between beautiful dark and light modes. Preference is remembered across sessions using `localStorage`.
- **Clipboard Utility**: Copy full, formatted markdown-compatible summaries of release notes to your clipboard in one click.
- **Export to CSV**: Export the currently filtered list of release notes directly to a `.csv` file in one click.
- **Twitter/X Composer & Live Preview Card**: Write a custom tweet, preview it in a simulated verified X card in real-time, and copy or publish it.
- **Performance Caching**: Caches parsed feed entries in-memory on the backend for 10 minutes to prevent rate-limiting and accelerate client loading speeds.

## Project Structure

```text
bq-releases-notes/
├── .venv/                  # Python virtual environment
├── app.py                  # Flask application & Atom feed parser
├── requirements.txt        # Flask & requests dependencies
├── templates/
│   └── index.html          # Main HTML structure with Dashboard layout
└── static/
    ├── css/
    │   └── style.css       # Clean styling, CSS variables (dark/light), animations
    └── js/
        └── main.js         # Interactive filtering, search highlighting, copy utilities
```

## Running the Application

1. **Activate the Virtual Environment**:
   - On Windows (PowerShell):
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - On Linux/macOS:
     ```bash
     source .venv/bin/activate
     ```

2. **Install Dependencies** (already installed in your environment):
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Flask Server**:
   ```bash
   python app.py
   ```

4. **Access the App**:
   Open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your web browser.
